CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenders (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_status TEXT NOT NULL DEFAULT 'uploaded',
  processing_error TEXT
);

CREATE TABLE IF NOT EXISTS tender_requirements (
  id UUID PRIMARY KEY,
  tender_id UUID NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  requirement_type TEXT NOT NULL,
  compliance_status TEXT NOT NULL DEFAULT 'unknown'
);

CREATE TABLE IF NOT EXISTS company_profile (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS internal_documents (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliance_results (
  id UUID PRIMARY KEY,
  requirement_id UUID NOT NULL REFERENCES tender_requirements(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS proposal_sections (
  id UUID PRIMARY KEY,
  tender_id UUID NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  content TEXT
);

CREATE TABLE IF NOT EXISTS human_reviews (
  id UUID PRIMARY KEY,
  target_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewer TEXT,
  notes TEXT
);