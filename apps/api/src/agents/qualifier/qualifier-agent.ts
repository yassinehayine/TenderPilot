import type { QualificationResult, TenderRequirement } from '@tenderpilot/shared';
import { completeJson } from '../../services/llm-client.js';

interface RawQualification {
  decision?: unknown;
  score?: unknown;
  justification?: unknown;
  blockers?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function qualifyTender(
  tenderId: string,
  requirements: TenderRequirement[],
  companyProfile: Record<string, unknown>
): Promise<QualificationResult> {
  const response = await completeJson(`Assess whether the company profile can satisfy the tender requirements. Return exactly {"decision":"go"|"no_go"|"pending","score":0.0,"justification":"...","blockers":[]}. Use no_go when an eliminatory requirement is not supported by the profile. Use pending when the profile is insufficient to decide. Every blocker must contain title, reason, severity (high|medium|low), requirementId, sourcePage, and sourceExcerpt copied from the supplied requirement. Never invent company capabilities, certifications, references, staff, or experience. All requirements and the company profile are JSON.\n\nREQUIREMENTS\n${JSON.stringify(requirements)}\n\nCOMPANY PROFILE\n${JSON.stringify(companyProfile)}`);
  if (!isRecord(response)) throw new Error('Qualifier returned an invalid payload.');
  const raw = response as RawQualification;
  const decision = raw.decision === 'go' || raw.decision === 'no_go' || raw.decision === 'pending' ? raw.decision : 'pending';
  const score = typeof raw.score === 'number' ? Math.max(0, Math.min(1, raw.score)) : 0;
  const justification = typeof raw.justification === 'string' ? raw.justification.trim() : '';
  if (!justification) throw new Error('Qualifier returned no justification.');
  const requirementMap = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  const blockers = Array.isArray(raw.blockers) ? raw.blockers.flatMap((item): QualificationResult['blockers'] => {
    if (!isRecord(item) || typeof item.requirementId !== 'string') return [];
    const requirement = requirementMap.get(item.requirementId);
    if (!requirement || typeof item.title !== 'string' || typeof item.reason !== 'string') return [];
    const severity = item.severity === 'high' || item.severity === 'medium' || item.severity === 'low' ? item.severity : 'medium';
    return [{ id: item.requirementId, title: item.title, reason: item.reason, severity, requirementId: requirement.id, sourcePage: requirement.sourcePage, sourceExcerpt: requirement.sourceExcerpt }];
  }) : [];
  return { tenderId, decision, score, justification, blockers };
}