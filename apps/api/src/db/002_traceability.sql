ALTER TABLE tenders ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'uploaded';
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS processing_error TEXT;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS processing_stage TEXT NOT NULL DEFAULT 'intake';
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS processing_attempt INTEGER NOT NULL DEFAULT 0;

ALTER TABLE tender_requirements ADD COLUMN IF NOT EXISTS source_page INTEGER;
ALTER TABLE tender_requirements ADD COLUMN IF NOT EXISTS source_excerpt TEXT;
ALTER TABLE tender_requirements ADD COLUMN IF NOT EXISTS confidence NUMERIC(5, 4);

ALTER TABLE internal_documents ADD COLUMN IF NOT EXISTS embedding JSONB;
ALTER TABLE human_reviews ADD COLUMN IF NOT EXISTS corrected_content TEXT;
ALTER TABLE human_reviews ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE proposal_sections ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE proposal_sections ADD COLUMN IF NOT EXISTS source_references JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE proposal_sections ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE proposal_sections ADD COLUMN IF NOT EXISTS corrected_content TEXT;
ALTER TABLE proposal_sections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS tender_documents (
  id UUID PRIMARY KEY,
  tender_id UUID NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  page_count INTEGER,
  unreadable_pages INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qualification_results (
  id UUID PRIMARY KEY,
  tender_id UUID NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  decision TEXT NOT NULL,
  score NUMERIC(5, 4) NOT NULL,
  justification TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qualification_blockers (
  id UUID PRIMARY KEY,
  result_id UUID NOT NULL REFERENCES qualification_results(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES tender_requirements(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  severity TEXT NOT NULL,
  source_page INTEGER NOT NULL,
  source_excerpt TEXT NOT NULL
);