import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { extractRequirements } from '../agents/extractor/extractor-agent.js';
import { qualifyTender } from '../agents/qualifier/qualifier-agent.js';
import { writeProposal } from '../agents/writer/writer-agent.js';
import { config } from '../config.js';
import { loadCompanyProfile } from '../services/company-profile.js';
import { createTender, getQualification, getProposalSections, getTender, getTenderDocument, getTenderRequirements, markTenderNeedsReview, replaceProposalSections, replaceTenderRequirements, saveQualification, updateProposalSectionReview, updateTenderStage } from '../db/repository.js';
import { extractPdfPages } from '../services/pdf-extractor.js';
import { proposalToDocx } from '../services/proposal-export.js';
import { unreadablePageStatus, withTransientRetries } from '../workflow/policy.js';

export async function tenderRoutes(app: FastifyInstance) {
  async function processTender(filename: string, buffer: Buffer) {
    const tenderId = randomUUID();
    const documentId = randomUUID();
    const storageKey = `${tenderId}.pdf`;
    await mkdir(config.uploadDirectory, { recursive: true });
    await writeFile(join(config.uploadDirectory, storageKey), buffer);
    try {
      const extraction = await extractPdfPages(buffer);
      await createTender({
        id: tenderId,
        documentId,
        title: filename.replace(/\.pdf$/i, ''),
        originalFilename: filename,
        storageKey,
        byteSize: buffer.byteLength,
        pageCount: extraction.pageCount,
        unreadablePages: extraction.unreadablePages,
        processingStatus: 'processing'
      });
      const readablePages = extraction.pages.filter((page) => !extraction.unreadablePages.includes(page.page));
      const processingStatus = unreadablePageStatus(extraction.unreadablePages);
      await updateTenderStage(tenderId, 'extracting_requirements', 1).catch(() => undefined);
      const requirements = readablePages.length > 0 ? await withTransientRetries(
        () => extractRequirements(readablePages),
        3,
        (attempt) => updateTenderStage(tenderId, 'extracting_requirements', attempt)
      ) : [];
      await replaceTenderRequirements(tenderId, requirements, processingStatus);
      if (processingStatus === 'needs_review') await updateTenderStage(tenderId, 'human_review', 1).catch(() => undefined);
      const currentTender = await getTender(tenderId);
      return { ...currentTender, processingStatus, unreadablePages: extraction.unreadablePages, requirementCount: requirements.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown processing failure.';
      await markTenderNeedsReview(tenderId, 'human_review', message).catch(() => undefined);
      throw Object.assign(new Error(message), { tenderId });
    }
  }

  app.post('/api/tenders', async (request, reply) => {
    const file = await request.file();
    if (!file || file.mimetype !== 'application/pdf') {
      return reply.code(400).send({ error: 'A PDF file is required.' });
    }
    const buffer = await file.toBuffer();
    try {
      return reply.code(201).send(await processTender(file.filename, buffer));
    } catch (error) {
      request.log.error(error, 'Tender processing failed');
      const details = error as Error & { tenderId?: string };
      return reply.code(422).send({ error: 'The PDF could not be processed. Human review is required.', tenderId: details.tenderId, processingStatus: 'needs_review', processingStage: 'human_review', processingError: details.message });
    }
  });

  app.get('/api/fixtures/tenders', async (_request, reply) => {
    try {
      const files = (await readdir(join(config.datasetDirectory, 'avis'))).filter((file) => /^AO-2026-\d{3}\.pdf$/.test(file)).sort();
      return files.map((filename) => ({ filename, scanned: filename === 'AO-2026-004.pdf' || filename === 'AO-2026-009.pdf' }));
    } catch { return reply.code(503).send({ error: 'The official tender dataset is unavailable.' }); }
  });

  app.post<{ Params: { filename: string } }>('/api/tenders/fixtures/:filename', async (request, reply) => {
    const filename = basename(request.params.filename);
    if (!/^AO-2026-\d{3}\.pdf$/.test(filename)) return reply.code(400).send({ error: 'Unknown tender fixture.' });
    try {
      const buffer = await readFile(join(config.datasetDirectory, 'avis', filename));
      return reply.code(201).send(await processTender(filename, buffer));
    } catch (error) {
      request.log.error(error, 'Tender fixture processing failed');
      const details = error as Error & { tenderId?: string };
      return reply.code(422).send({ error: 'The tender fixture could not be processed. Human review is required.', tenderId: details.tenderId, processingStatus: 'needs_review', processingStage: 'human_review', processingError: details.message });
    }
  });

  app.get<{ Params: { id: string } }>('/api/tenders/:id', async (request, reply) => {
    const tender = await getTender(request.params.id);
    if (!tender) return reply.code(404).send({ error: 'Tender not found.' });
    return tender;
  });

  app.get<{ Params: { id: string } }>('/api/tenders/:id/requirements', async (request) => getTenderRequirements(request.params.id));

  app.get('/api/company-profile', async (_request, reply) => {
    try { return await loadCompanyProfile(); }
    catch { return reply.code(503).send({ error: 'The official company profile dataset is unavailable.' }); }
  });

  app.post<{ Params: { id: string } }>('/api/tenders/:id/qualification', async (request, reply) => {
    const requirements = await getTenderRequirements(request.params.id);
    if (requirements.length === 0) return reply.code(422).send({ error: 'No extracted requirements are available for qualification.' });
    try {
      await updateTenderStage(request.params.id, 'qualify', 1);
      const companyProfile = await loadCompanyProfile();
      const qualification = await withTransientRetries(
        () => qualifyTender(request.params.id, requirements, companyProfile),
        3,
        (attempt) => updateTenderStage(request.params.id, 'qualify', attempt)
      );
      await updateTenderStage(request.params.id, 'compliance', 1);
      const saved = await saveQualification(qualification);
      await updateTenderStage(request.params.id, 'human_review', 1);
      return saved;
    } catch (error) {
      request.log.error(error, 'Tender qualification failed');
      await markTenderNeedsReview(request.params.id, 'human_review', error instanceof Error ? error.message : 'Qualification failed.').catch(() => undefined);
      return reply.code(422).send({ error: 'Qualification failed. No go/no-go result was persisted.' });
    }
  });

  app.get<{ Params: { id: string } }>('/api/tenders/:id/qualification', async (request, reply) => {
    const qualification = await getQualification(request.params.id);
    if (!qualification) return reply.code(404).send({ error: 'No qualification result found.' });
    return qualification;
  });

  app.post<{ Params: { id: string } }>('/api/tenders/:id/proposal', async (request, reply) => {
    const tender = await getTender(request.params.id);
    const requirements = await getTenderRequirements(request.params.id);
    if (!tender || requirements.length === 0) return reply.code(422).send({ error: 'A processed tender with requirements is required.' });
    try {
      await updateTenderStage(request.params.id, 'write', 1);
      const companyProfile = await loadCompanyProfile();
      const sections = await withTransientRetries(
        () => writeProposal(tender, requirements, companyProfile),
        3,
        (attempt) => updateTenderStage(request.params.id, 'write', attempt)
      );
      if (sections.length === 0) return reply.code(422).send({ error: 'Writer returned no traceable proposal sections.' });
      await replaceProposalSections(request.params.id, sections);
      await updateTenderStage(request.params.id, 'human_review', 1);
      return await getProposalSections(request.params.id);
    } catch (error) {
      request.log.error(error, 'Proposal generation failed');
      await markTenderNeedsReview(request.params.id, 'human_review', error instanceof Error ? error.message : 'Proposal generation failed.').catch(() => undefined);
      return reply.code(422).send({ error: 'Proposal generation failed. No proposal was persisted.' });
    }
  });

  app.get<{ Params: { id: string } }>('/api/tenders/:id/proposal', async (request) => getProposalSections(request.params.id));

  app.get<{ Params: { id: string } }>('/api/tenders/:id/proposal.docx', async (request, reply) => {
    const tender = await getTender(request.params.id);
    const sections = await getProposalSections(request.params.id);
    if (!tender || sections.length === 0) return reply.code(404).send({ error: 'No proposal found.' });
    const document = await proposalToDocx(`${tender.title} - Mémoire technique`, sections);
    return reply.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document').header('content-disposition', `attachment; filename="${tender.title}-memoire-technique.docx"`).send(document);
  });

  app.patch<{ Params: { sectionId: string }; Body: { status?: 'approved' | 'changes_requested'; correctedContent?: string } }>('/api/proposal-sections/:sectionId/review', async (request, reply) => {
    const status = request.body?.status;
    if (status !== 'approved' && status !== 'changes_requested') return reply.code(400).send({ error: 'Review status must be approved or changes_requested.' });
    const section = await updateProposalSectionReview({ id: request.params.sectionId, status, correctedContent: request.body.correctedContent });
    if (!section) return reply.code(404).send({ error: 'Proposal section not found.' });
    return section;
  });

  app.get<{ Params: { id: string } }>('/api/tenders/:id/document', async (request, reply) => {
    const document = await getTenderDocument(request.params.id);
    if (!document) return reply.code(404).send({ error: 'Tender document not found.' });
    reply.type('application/pdf').header('content-disposition', `inline; filename="${document.originalFilename}"`);
    return reply.send(createReadStream(`${config.uploadDirectory}/${document.storageKey}`));
  });
}