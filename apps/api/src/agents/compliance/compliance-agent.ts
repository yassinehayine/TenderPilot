import type {
  ComplianceAssessment,
  ComplianceEvidence,
  ComplianceReport,
  ComplianceVerdict,
  QualificationResult,
  TenderRequirement
} from '@tenderpilot/shared';

/**
 * Deterministic compliance agent.
 *
 * It derives a per-requirement verdict from data that is already persisted: the
 * extracted requirements, the qualification blockers and the official company
 * profile. It performs no LLM call and never asserts an evidence item that is
 * absent from the profile - every `compliant` verdict names the exact profile
 * entry it matched.
 */

const genericTerms = new Set([
  'avec', 'dans', 'des', 'les', 'une', 'pour', 'par', 'sur', 'aux', 'est', 'sont', 'doit', 'doivent',
  'plus', 'moins', 'tout', 'tous', 'toute', 'toutes', 'cette', 'leur', 'leurs', 'que', 'qui', 'dont',
  'soumissionnaire', 'concurrent', 'candidat', 'titulaire', 'marche', 'marches', 'offre', 'offres',
  'article', 'annexe', 'present', 'presente', 'conformement', 'notamment', 'ainsi', 'etre', 'avoir'
]);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text).split(' ').filter((token) => token.length >= 3 && !genericTerms.has(token));
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null) : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Builds the evidence index from the official company profile. Nothing is synthesised. */
export function buildEvidenceIndex(companyProfile: Record<string, unknown>): ComplianceEvidence[] {
  const evidence: ComplianceEvidence[] = [];
  for (const certification of asStringArray(companyProfile.certifications)) {
    evidence.push({ kind: 'certification', id: certification, label: certification });
  }
  for (const attestation of asStringArray(companyProfile.attestations_disponibles)) {
    evidence.push({ kind: 'attestation', id: attestation, label: attestation });
  }
  for (const document of asStringArray(companyProfile.attestations_documents)) {
    evidence.push({ kind: 'attestation', id: document, label: document.replace(/\.pdf$/i, '').replace(/-/g, ' ') });
  }
  for (const sector of asStringArray(companyProfile.secteurs_couverts)) {
    evidence.push({ kind: 'sector', id: sector, label: `secteur ${sector}` });
  }
  for (const reference of asRecordArray(companyProfile.references)) {
    const id = typeof reference.id === 'string' ? reference.id : '';
    const objet = typeof reference.objet === 'string' ? reference.objet : '';
    const client = typeof reference.client === 'string' ? reference.client : '';
    if (id && objet) evidence.push({ kind: 'reference', id, label: `${id} - ${objet} (${client})` });
  }
  for (const member of asRecordArray(companyProfile.equipe)) {
    const id = typeof member.id === 'string' ? member.id : '';
    const poste = typeof member.poste === 'string' ? member.poste : '';
    const diplome = typeof member.diplome === 'string' ? member.diplome : '';
    const certifications = asStringArray(member.certifications).join(' ');
    if (id && poste) evidence.push({ kind: 'team', id, label: `${id} - ${poste} ${diplome} ${certifications}`.trim() });
  }
  if (typeof companyProfile.effectif === 'number') {
    evidence.push({ kind: 'capacity', id: 'effectif', label: `effectif ${companyProfile.effectif} personnes` });
  }
  const revenue = companyProfile.chiffre_affaires_ht_mad;
  if (typeof revenue === 'object' && revenue !== null) {
    evidence.push({ kind: 'capacity', id: 'chiffre_affaires', label: `chiffre affaires ht ${Object.keys(revenue as Record<string, unknown>).join(' ')}` });
  }
  return evidence;
}

/**
 * Document frequency across the evidence index. A term shared by many entries
 * (for example "ingenieur") carries no discriminating power, so on its own it
 * cannot justify a compliant verdict.
 */
export function evidenceTokenFrequency(evidence: ComplianceEvidence[]): Map<string, number> {
  const frequency = new Map<string, number>();
  for (const item of evidence) {
    for (const token of new Set(tokenize(item.label))) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }
  return frequency;
}

const minimumMatchScore = 2;

export function matchEvidence(
  requirement: Pick<TenderRequirement, 'title' | 'sourceExcerpt'>,
  evidence: ComplianceEvidence[],
  frequency: Map<string, number>
): ComplianceEvidence[] {
  const requirementTokens = new Set(tokenize(`${requirement.title} ${requirement.sourceExcerpt}`));
  return evidence
    .map((item) => {
      let score = 0;
      for (const token of new Set(tokenize(item.label))) {
        if (!requirementTokens.has(token)) continue;
        const documentFrequency = frequency.get(token) ?? 1;
        // Rare terms (9001, qualiopi, cnss) score high; ubiquitous ones barely count.
        score += documentFrequency <= 2 ? 2 : documentFrequency <= 5 ? 1 : 0.25;
      }
      return { item, score };
    })
    .filter((entry) => entry.score >= minimumMatchScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => entry.item);
}

const lowConfidenceFloor = 0.5;

export function assessCompliance(
  tenderId: string,
  requirements: TenderRequirement[],
  qualification: QualificationResult | null,
  companyProfile: Record<string, unknown>
): ComplianceReport {
  const evidenceIndex = buildEvidenceIndex(companyProfile);
  const frequency = evidenceTokenFrequency(evidenceIndex);
  const blockers = new Map((qualification?.blockers ?? []).map((blocker) => [blocker.requirementId, blocker]));

  const assessments = requirements.map((requirement): ComplianceAssessment => {
    const base = {
      requirementId: requirement.id,
      requirementTitle: requirement.title,
      type: requirement.type,
      sourcePage: requirement.sourcePage,
      sourceExcerpt: requirement.sourceExcerpt
    };
    const blocker = blockers.get(requirement.id);
    if (blocker) {
      // The qualifier already established that the profile does not support this requirement.
      const verdict: ComplianceVerdict = blocker.severity === 'high' ? 'non_compliant' : 'missing_evidence';
      return { ...base, verdict, notes: `Qualification blocker (${blocker.severity}): ${blocker.reason}`, evidence: [] };
    }
    if (requirement.confidence < lowConfidenceFloor) {
      return { ...base, verdict: 'needs_review', notes: `Extraction confidence ${requirement.confidence.toFixed(2)} is below ${lowConfidenceFloor}; a human must confirm the requirement before it is judged.`, evidence: [] };
    }
    const matched = matchEvidence(requirement, evidenceIndex, frequency);
    if (matched.length === 0) {
      return { ...base, verdict: 'needs_review', notes: 'No company profile evidence matched this requirement; compliance cannot be asserted either way.', evidence: [] };
    }
    if (requirement.type === 'éliminatoire') {
      // An eliminatory requirement is never auto-cleared on a text match alone.
      return { ...base, verdict: 'needs_review', notes: `Eliminatory requirement. Candidate evidence: ${matched.map((item) => item.label).join('; ')}. Human confirmation required.`, evidence: matched };
    }
    return { ...base, verdict: 'compliant', notes: `Supported by company profile evidence: ${matched.map((item) => item.label).join('; ')}.`, evidence: matched };
  });

  const summary: Record<ComplianceVerdict, number> = { compliant: 0, non_compliant: 0, missing_evidence: 0, needs_review: 0 };
  for (const assessment of assessments) summary[assessment.verdict] += 1;
  return { tenderId, assessments, summary };
}

/** Maps the richer verdict onto the persisted requirement status union, preserving the existing API contract. */
export function verdictToRequirementStatus(verdict: ComplianceVerdict): TenderRequirement['status'] {
  if (verdict === 'compliant') return 'compliant';
  if (verdict === 'non_compliant') return 'non_compliant';
  if (verdict === 'missing_evidence') return 'partial';
  return 'unknown';
}
