import type { ProposalSectionDetail, QualificationResult, Tender, TenderRequirement } from '@tenderpilot/shared';
import { pool } from './client.js';

export type ProcessingStatus = 'uploaded' | 'processing' | 'ready' | 'needs_review' | 'failed';

export async function createTender(input: {
  id: string;
  documentId: string;
  title: string;
  originalFilename: string;
  storageKey: string;
  byteSize: number;
  pageCount: number;
  unreadablePages: number[];
  processingStatus: ProcessingStatus;
}): Promise<Tender & { processingStatus: ProcessingStatus; unreadablePages: number[] }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tender = await client.query<Tender>(
      `INSERT INTO tenders (id, title, status, processing_status)
       VALUES ($1, $2, 'draft', $3)
       RETURNING id, title, reference, status, created_at AS "createdAt"`,
      [input.id, input.title, input.processingStatus]
    );
    await client.query(
      `INSERT INTO tender_documents
       (id, tender_id, original_filename, storage_key, mime_type, byte_size, page_count, unreadable_pages)
       VALUES ($1, $2, $3, $4, 'application/pdf', $5, $6, $7)`,
      [input.documentId, input.id, input.originalFilename, input.storageKey, input.byteSize, input.pageCount, input.unreadablePages]
    );
    await client.query('COMMIT');
    return { ...tender.rows[0], processingStatus: input.processingStatus, unreadablePages: input.unreadablePages };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getTender(id: string) {
  const result = await pool.query(
    `SELECT t.id, t.title, t.reference, t.status, t.created_at AS "createdAt",
            t.processing_status AS "processingStatus", t.processing_error AS "processingError",
            t.processing_stage AS "processingStage", t.processing_attempt AS "processingAttempt",
            d.original_filename AS "originalFilename", d.page_count AS "pageCount",
            d.unreadable_pages AS "unreadablePages", d.storage_key AS "storageKey"
     FROM tenders t LEFT JOIN tender_documents d ON d.tender_id = t.id
     WHERE t.id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function replaceTenderRequirements(
  tenderId: string,
  requirements: Array<Omit<TenderRequirement, 'id' | 'tenderId'>>,
  processingStatus: ProcessingStatus = 'ready'
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM tender_requirements WHERE tender_id = $1', [tenderId]);
    for (const requirement of requirements) {
      await client.query(
        `INSERT INTO tender_requirements
         (id, tender_id, title, requirement_type, compliance_status, source_page, source_excerpt, confidence)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
        [tenderId, requirement.title, requirement.type, requirement.status, requirement.sourcePage, requirement.sourceExcerpt, requirement.confidence]
      );
    }
    await client.query('UPDATE tenders SET processing_status = $2 WHERE id = $1', [tenderId, processingStatus]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function markTenderFailed(tenderId: string, errorMessage: string) {
  await pool.query(
    'UPDATE tenders SET processing_status = $2, processing_error = $3 WHERE id = $1',
    [tenderId, 'failed', errorMessage]
  );
}

export async function getTenderRequirements(tenderId: string) {
  const result = await pool.query<TenderRequirement>(
    `SELECT id, tender_id AS "tenderId", title,
            requirement_type AS type, compliance_status AS status,
            source_page AS "sourcePage", source_excerpt AS "sourceExcerpt",
            confidence
     FROM tender_requirements
     WHERE tender_id = $1
     ORDER BY source_page, id`,
    [tenderId]
  );
  return result.rows;
}

export async function getTenderDocument(tenderId: string) {
  const result = await pool.query<{ storageKey: string; originalFilename: string }>(
    `SELECT storage_key AS "storageKey", original_filename AS "originalFilename"
     FROM tender_documents WHERE tender_id = $1`,
    [tenderId]
  );
  return result.rows[0] ?? null;
}

export async function saveQualification(result: QualificationResult) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM qualification_results WHERE tender_id = $1', [result.tenderId]);
    const saved = await client.query<{ id: string }>(
      `INSERT INTO qualification_results (id, tender_id, decision, score, justification)
       VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING id`,
      [result.tenderId, result.decision, result.score, result.justification]
    );
    for (const blocker of result.blockers) {
      await client.query(
        `INSERT INTO qualification_blockers
         (id, result_id, requirement_id, title, reason, severity, source_page, source_excerpt)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
        [saved.rows[0].id, blocker.requirementId, blocker.title, blocker.reason, blocker.severity, blocker.sourcePage, blocker.sourceExcerpt]
      );
    }
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getQualification(tenderId: string): Promise<QualificationResult | null> {
  const result = await pool.query(
    `SELECT id, tender_id AS "tenderId", decision, score, justification
     FROM qualification_results WHERE tender_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [tenderId]
  );
  const row = result.rows[0];
  if (!row) return null;
  const blockers = await pool.query(
    `SELECT id, title, reason, severity, requirement_id AS "requirementId", source_page AS "sourcePage", source_excerpt AS "sourceExcerpt"
     FROM qualification_blockers WHERE result_id = $1 ORDER BY severity, source_page`,
    [row.id]
  );
  return { ...row, blockers: blockers.rows } as QualificationResult;
}

export async function replaceProposalSections(tenderId: string, sections: Array<Omit<ProposalSectionDetail, 'id' | 'tenderId'>>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM proposal_sections WHERE tender_id = $1', [tenderId]);
    for (const section of sections) {
      await client.query(
        `INSERT INTO proposal_sections
         (id, tender_id, title, status, content, source_references, review_status)
         VALUES (gen_random_uuid(), $1, $2, 'in_review', $3, $4, $5)`,
        [tenderId, section.title, section.content, JSON.stringify(section.sourceReferences), section.reviewStatus]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getProposalSections(tenderId: string): Promise<ProposalSectionDetail[]> {
  const result = await pool.query(
    `SELECT id, tender_id AS "tenderId", title, status, content,
            corrected_content AS "correctedContent", review_status AS "reviewStatus",
            source_references AS "sourceReferences"
     FROM proposal_sections WHERE tender_id = $1 ORDER BY id`,
    [tenderId]
  );
  return result.rows as ProposalSectionDetail[];
}

export async function updateProposalSectionReview(input: { id: string; status: 'approved' | 'changes_requested'; correctedContent?: string }) {
  const result = await pool.query(
    `UPDATE proposal_sections
     SET review_status = $2, status = CASE WHEN $2 = 'approved' THEN 'approved' ELSE 'in_review' END,
         corrected_content = $3, updated_at = NOW()
     WHERE id = $1
     RETURNING id, tender_id AS "tenderId", title, status, content,
       corrected_content AS "correctedContent", review_status AS "reviewStatus",
       source_references AS "sourceReferences"`,
    [input.id, input.status, input.correctedContent ?? null]
  );
  return (result.rows[0] as ProposalSectionDetail | undefined) ?? null;
}

export async function updateTenderStage(tenderId: string, stage: string, attempt: number) {
  await pool.query('UPDATE tenders SET processing_stage = $2, processing_attempt = $3 WHERE id = $1', [tenderId, stage, attempt]);
}