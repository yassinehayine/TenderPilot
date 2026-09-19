import type { ComplianceReport, ProposalSectionDetail, QualificationResult, Tender, TenderRequirement } from '@tenderpilot/shared';
import { assessCompliance } from '../compliance/index.js';
import { extractRequirements } from '../extractor/extractor-agent.js';
import { qualifyTender } from '../qualifier/qualifier-agent.js';
import { writeProposal } from '../writer/writer-agent.js';
import { loadCompanyProfile } from '../../services/company-profile.js';
import { replaceComplianceResults, replaceProposalSections, saveQualification } from '../../db/repository.js';
import { runStage } from './orchestrator.js';

/**
 * Concrete stage sequences for a tender. Each function delegates the transition,
 * retry and escalation handling to `runStage`, and delegates the actual work to
 * the agent that owns it. The orchestrator adds no reasoning of its own.
 */

/** Stage 1 - extract. Stays on the extract stage: the caller decides ready vs needs_review. */
export async function runExtractionStage(
  tenderId: string,
  pages: Array<{ page: number; text: string }>
): Promise<Array<Omit<TenderRequirement, 'id' | 'tenderId'>>> {
  return runStage(tenderId, 'extract', () => extractRequirements(pages), { advanceTo: null });
}

/** Stage 2 - qualify. Runs the GPT-5.5 qualifier and persists the go/no-go result. */
export async function runQualificationStage(
  tenderId: string,
  requirements: TenderRequirement[],
  companyProfile: Record<string, unknown>
): Promise<QualificationResult> {
  return runStage(tenderId, 'qualify', async () => {
    const qualification = await qualifyTender(tenderId, requirements, companyProfile);
    await saveQualification(qualification);
    return qualification;
  }, { advanceTo: 'compliance' });
}

/**
 * Stage 3 - compliance. Deterministic: it reuses the persisted requirements,
 * the qualification blockers and the company profile. No LLM call.
 */
export async function runComplianceStage(
  tenderId: string,
  requirements: TenderRequirement[],
  qualification: QualificationResult | null,
  companyProfile: Record<string, unknown>
): Promise<ComplianceReport> {
  return runStage(tenderId, 'compliance', async () => {
    const report = assessCompliance(tenderId, requirements, qualification, companyProfile);
    await replaceComplianceResults(tenderId, report.assessments);
    return report;
  }, { advanceTo: 'human_review' });
}

/** Stage 4 - write. Runs the Azure GPT-4.1 writer and persists the proposal sections. */
export async function runWritingStage(
  tenderId: string,
  tender: Tender,
  requirements: TenderRequirement[],
  companyProfile: Record<string, unknown>
): Promise<Array<Omit<ProposalSectionDetail, 'id' | 'tenderId'>>> {
  return runStage(tenderId, 'write', async () => {
    const sections = await writeProposal(tender, requirements, companyProfile);
    if (sections.length === 0) throw new Error('Writer returned no traceable proposal sections.');
    await replaceProposalSections(tenderId, sections);
    return sections;
  }, { advanceTo: 'human_review' });
}

/** Stages 2 and 3 as the API exposes them: qualification is always followed by compliance. */
export async function runQualificationAndCompliance(
  tenderId: string,
  requirements: TenderRequirement[]
): Promise<{ qualification: QualificationResult; compliance: ComplianceReport }> {
  const companyProfile = await loadCompanyProfile();
  const qualification = await runQualificationStage(tenderId, requirements, companyProfile);
  const compliance = await runComplianceStage(tenderId, requirements, qualification, companyProfile);
  return { qualification, compliance };
}
