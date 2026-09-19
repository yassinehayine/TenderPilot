import type { ProposalSectionDetail, ProposalSourceReference, Tender, TenderRequirement } from '@tenderpilot/shared';
import { completeAzureJson as completeJson } from '../../services/llm-client.js';

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }

const sourceKinds = new Set<ProposalSourceReference['kind']>(['requirement', 'company_profile', 'reference', 'team', 'attestation', 'previous_proposal']);

export async function writeProposal(tender: Tender, requirements: TenderRequirement[], companyProfile: Record<string, unknown>): Promise<Array<Omit<ProposalSectionDetail, 'id' | 'tenderId'>>> {
  const response = await completeJson(`Draft a concise technical proposal grounded only in the provided tender requirements and company profile. Return exactly {"sections":[{"title":"...","content":"...","sourceReferences":[{"kind":"requirement|company_profile|reference|team|attestation|previous_proposal","id":"...","label":"..."}]}]}. Use 3 to 5 useful sections. Do not invent facts, references, certifications, people, dates, amounts, or capabilities. When evidence is missing, write [À COMPLÉTER - validation humaine requise]. Every section must include sourceReferences that point only to supplied IDs or clearly named supplied profile facts.\n\nTENDER\n${JSON.stringify(tender)}\n\nREQUIREMENTS\n${JSON.stringify(requirements)}\n\nCOMPANY PROFILE\n${JSON.stringify(companyProfile)}`, process.env.WRITER_MODEL ?? 'gpt-4.1');
  if (!isRecord(response) || !Array.isArray(response.sections)) throw new Error('Writer returned an invalid proposal payload.');
  const allowedSourceIds = new Set<string>([
    ...requirements.map((requirement) => requirement.id),
    ...Object.keys(companyProfile),
    ...(Array.isArray(companyProfile.references) ? companyProfile.references.flatMap((reference) => isRecord(reference) && typeof reference.id === 'string' ? [reference.id] : []) : []),
    ...(Array.isArray(companyProfile.equipe) ? companyProfile.equipe.flatMap((member) => isRecord(member) && typeof member.id === 'string' ? [member.id] : []) : []),
    ...(Array.isArray(companyProfile.attestations_documents) ? companyProfile.attestations_documents.filter((item): item is string => typeof item === 'string') : []),
    ...(Array.isArray(companyProfile.offres_passees) ? companyProfile.offres_passees.filter((item): item is string => typeof item === 'string') : [])
  ]);
  return response.sections.flatMap((item): Array<Omit<ProposalSectionDetail, 'id' | 'tenderId'>> => {
    if (!isRecord(item) || typeof item.title !== 'string' || typeof item.content !== 'string' || !Array.isArray(item.sourceReferences)) return [];
    const sources = item.sourceReferences.flatMap((source): ProposalSourceReference[] => {
      if (!isRecord(source) || !sourceKinds.has(source.kind as ProposalSourceReference['kind']) || typeof source.id !== 'string' || typeof source.label !== 'string' || !allowedSourceIds.has(source.id)) return [];
      return [{ kind: source.kind as ProposalSourceReference['kind'], id: source.id, label: source.label }];
    });
    if (sources.length === 0) return [];
    return [{ title: item.title.trim(), status: 'in_review', content: item.content.trim(), correctedContent: undefined, reviewStatus: 'pending', sourceReferences: sources }];
  });
}