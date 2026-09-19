export type RequirementType = 'obligatoire' | 'optionnelle' | 'éliminatoire';
export type ComplianceStatus = 'unknown' | 'compliant' | 'partial' | 'non_compliant';
export interface Tender { id: string; title: string; reference?: string; status: 'draft' | 'in_review' | 'submitted' | 'archived'; createdAt: string; }
export interface TenderRequirement {
	id: string;
	tenderId: string;
	title: string;
	type: RequirementType;
	status: ComplianceStatus;
	sourcePage: number;
	sourceExcerpt: string;
	confidence: number;
}
export interface GoNoGoResult { decision: 'go' | 'no_go' | 'pending'; rationale?: string; }
export interface QualificationBlocker {
	id: string;
	title: string;
	reason: string;
	severity: 'high' | 'medium' | 'low';
	requirementId: string;
	sourcePage: number;
	sourceExcerpt: string;
}
export interface QualificationResult extends GoNoGoResult {
	tenderId: string;
	score: number;
	justification: string;
	blockers: QualificationBlocker[];
}
export interface ProposalSection { id: string; tenderId: string; title: string; status: 'draft' | 'in_review' | 'approved'; }
export interface HumanReview { id: string; targetId: string; status: 'pending' | 'approved' | 'changes_requested'; reviewer?: string; }