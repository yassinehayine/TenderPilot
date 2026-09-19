import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { extractRequirements } from '../agents/extractor/extractor-agent.js';
import { qualifyTender } from '../agents/qualifier/qualifier-agent.js';
import { config } from '../config.js';
import { loadCompanyProfile } from '../services/company-profile.js';
import { createTender, getQualification, getTender, getTenderDocument, getTenderRequirements, markTenderFailed, replaceTenderRequirements, saveQualification } from '../db/repository.js';
import { extractPdfPages } from '../services/pdf-extractor.js';

export async function tenderRoutes(app: FastifyInstance) {
  async function processTender(filename: string, buffer: Buffer) {
    const tenderId = randomUUID();
    const documentId = randomUUID();
    const storageKey = `${tenderId}.pdf`;
    await mkdir(config.uploadDirectory, { recursive: true });
    await writeFile(join(config.uploadDirectory, storageKey), buffer);
    try {
      const extraction = await extractPdfPages(buffer);
      const tender = await createTender({
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
      const requirements = await extractRequirements(extraction.pages);
      await replaceTenderRequirements(tenderId, requirements);
      return { ...tender, processingStatus: extraction.unreadablePages.length > 0 ? 'needs_review' : 'ready', unreadablePages: extraction.unreadablePages, requirementCount: requirements.length };
    } catch (error) {
      await markTenderFailed(tenderId, error instanceof Error ? error.message : 'Unknown processing failure.').catch(() => undefined);
      throw error;
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
      return reply.code(422).send({ error: 'The PDF could not be processed. No requirements were generated.' });
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
      return reply.code(422).send({ error: 'The tender fixture could not be processed.' });
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
      const companyProfile = await loadCompanyProfile();
      const qualification = await qualifyTender(request.params.id, requirements, companyProfile);
      return await saveQualification(qualification);
    } catch (error) {
      request.log.error(error, 'Tender qualification failed');
      return reply.code(422).send({ error: 'Qualification failed. No go/no-go result was persisted.' });
    }
  });

  app.get<{ Params: { id: string } }>('/api/tenders/:id/qualification', async (request, reply) => {
    const qualification = await getQualification(request.params.id);
    if (!qualification) return reply.code(404).send({ error: 'No qualification result found.' });
    return qualification;
  });

  app.get<{ Params: { id: string } }>('/api/tenders/:id/document', async (request, reply) => {
    const document = await getTenderDocument(request.params.id);
    if (!document) return reply.code(404).send({ error: 'Tender document not found.' });
    reply.type('application/pdf').header('content-disposition', `inline; filename="${document.originalFilename}"`);
    return reply.send(createReadStream(`${config.uploadDirectory}/${document.storageKey}`));
  });
}