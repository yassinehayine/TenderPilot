export interface TenderUploadResult {
  id: string;
  title: string;
  processingStatus: 'ready' | 'needs_review' | 'failed';
  pageCount: number;
  unreadablePages: number[];
  requirementCount: number;
  processingStage?: string;
  processingError?: string | null;
}

export interface TenderRequirement {
  id: string;
  tenderId: string;
  title: string;
  type: 'obligatoire' | 'optionnelle' | 'éliminatoire';
  status: 'unknown' | 'compliant' | 'partial' | 'non_compliant';
  sourcePage: number;
  sourceExcerpt: string;
  confidence: number;
}

export async function uploadTender(file: File): Promise<TenderUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch('/api/tenders', { method: 'POST', body: formData });
  const payload = await response.json() as TenderUploadResult & { error?: string; processingError?: string };
  if (!response.ok) throw new Error(payload.processingError ?? payload.error ?? 'Tender upload failed.');
  return payload;
}

export async function getTenderRequirements(tenderId: string): Promise<TenderRequirement[]> {
  const response = await fetch(`/api/tenders/${tenderId}/requirements`);
  if (!response.ok) throw new Error('Could not load the compliance matrix.');
  return response.json() as Promise<TenderRequirement[]>;
}

export interface QualificationBlocker {
  id: string;
  title: string;
  reason: string;
  severity: 'high' | 'medium' | 'low';
  requirementId: string;
  sourcePage: number;
  sourceExcerpt: string;
}

export interface QualificationResult {
  tenderId: string;
  decision: 'go' | 'no_go' | 'pending';
  score: number;
  justification: string;
  blockers: QualificationBlocker[];
}

export async function qualifyTender(tenderId: string): Promise<QualificationResult> {
  const response = await fetch(`/api/tenders/${tenderId}/qualification`, {
    method: 'POST'
  });
  const payload = await response.json() as QualificationResult & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'Qualification failed.');
  return payload;
}

export async function getQualification(tenderId: string): Promise<QualificationResult | null> {
  const response = await fetch(`/api/tenders/${tenderId}/qualification`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Could not load the qualification result.');
  return response.json() as Promise<QualificationResult>;
}

export interface CompanyProfileSummary {
  raison_sociale: string;
  references: unknown[];
  equipe: unknown[];
  attestations_documents: string[];
  offres_passees: string[];
}

export async function getCompanyProfile(): Promise<CompanyProfileSummary> {
  const response = await fetch('/api/company-profile');
  if (!response.ok) throw new Error('Could not load the official company profile.');
  return response.json() as Promise<CompanyProfileSummary>;
}

export interface TenderFixture { filename: string; scanned: boolean; }

export async function getTenderFixtures(): Promise<TenderFixture[]> {
  const response = await fetch('/api/fixtures/tenders');
  if (!response.ok) throw new Error('Could not load tender fixtures.');
  return response.json() as Promise<TenderFixture[]>;
}

export async function uploadTenderFixture(filename: string): Promise<TenderUploadResult> {
  const response = await fetch(`/api/tenders/fixtures/${encodeURIComponent(filename)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  const payload = await response.json() as TenderUploadResult & { error?: string; processingError?: string };
  if (!response.ok) throw new Error(payload.processingError ?? payload.error ?? 'Tender fixture processing failed.');
  return payload;
}

export interface ProposalSourceReference { kind: string; id: string; label: string; }
export interface ProposalSection { id: string; tenderId: string; title: string; content: string; correctedContent?: string; reviewStatus: 'pending' | 'approved' | 'changes_requested'; sourceReferences: ProposalSourceReference[]; }

export async function getProposal(tenderId: string): Promise<ProposalSection[]> {
  const response = await fetch(`/api/tenders/${tenderId}/proposal`);
  if (!response.ok) throw new Error('Could not load the technical proposal.');
  return response.json() as Promise<ProposalSection[]>;
}

export async function generateProposal(tenderId: string): Promise<ProposalSection[]> {
  const response = await fetch(`/api/tenders/${tenderId}/proposal`, { method: 'POST' });
  const payload = await response.json() as ProposalSection[] & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'Proposal generation failed.');
  return payload;
}

export async function reviewProposalSection(sectionId: string, status: 'approved' | 'changes_requested', correctedContent?: string): Promise<ProposalSection> {
  const response = await fetch(`/api/proposal-sections/${sectionId}/review`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status, correctedContent }) });
  const payload = await response.json() as ProposalSection & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'Could not save review.');
  return payload;
}