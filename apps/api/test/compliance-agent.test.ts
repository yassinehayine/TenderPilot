import assert from 'node:assert/strict';
import test from 'node:test';
import type { QualificationResult, TenderRequirement } from '@tenderpilot/shared';
import { assessCompliance, buildEvidenceIndex, verdictToRequirementStatus } from '../src/agents/compliance/compliance-agent.js';

const companyProfile: Record<string, unknown> = {
  certifications: ['ISO 9001:2015', 'ISO 27001:2022', 'Qualiopi'],
  attestations_disponibles: ['Attestation fiscale', 'Attestation CNSS'],
  secteurs_couverts: ['santé', 'éducation'],
  effectif: 84,
  references: [{ id: 'REF-01', client: 'Agence Urbaine', objet: "L'audit et la sécurisation du système d'information" }],
  equipe: [{ id: 'CV-01', poste: 'Chef de projet', diplome: 'Ingénieur télécoms', certifications: ['PMP'] }]
};

function requirement(overrides: Partial<TenderRequirement>): TenderRequirement {
  return {
    id: 'req-1',
    tenderId: 'tender-1',
    title: 'Requirement',
    type: 'obligatoire',
    status: 'unknown',
    sourcePage: 2,
    sourceExcerpt: 'Excerpt from the tender document.',
    confidence: 0.9,
    ...overrides
  };
}

test('evidence index is built only from profile facts', () => {
  const evidence = buildEvidenceIndex(companyProfile);
  const labels = evidence.map((item) => item.label);
  assert.ok(labels.includes('ISO 9001:2015'));
  assert.ok(labels.includes('Attestation CNSS'));
  assert.ok(labels.some((label) => label.startsWith('REF-01')));
  assert.equal(evidence.filter((item) => item.kind === 'certification').length, 3);
  // Nothing invented: every label traces back to a supplied profile entry.
  assert.ok(!labels.some((label) => label.includes('undefined')));
});

test('a high severity qualification blocker yields non_compliant', () => {
  const requirements = [requirement({ id: 'req-1', title: 'Quatre références secteur éducation' })];
  const qualification = {
    tenderId: 'tender-1',
    decision: 'no_go',
    score: 0.5,
    justification: 'x',
    blockers: [{ id: 'b1', title: 'Références insuffisantes', reason: 'Only two references supplied.', severity: 'high', requirementId: 'req-1', sourcePage: 2, sourceExcerpt: 'Excerpt' }]
  } as QualificationResult;
  const report = assessCompliance('tender-1', requirements, qualification, companyProfile);
  assert.equal(report.assessments[0].verdict, 'non_compliant');
  assert.match(report.assessments[0].notes, /Only two references supplied/);
  assert.equal(report.summary.non_compliant, 1);
});

test('a medium severity blocker yields missing_evidence', () => {
  const requirements = [requirement({ id: 'req-1' })];
  const qualification = {
    tenderId: 'tender-1',
    decision: 'pending',
    score: 0.5,
    justification: 'x',
    blockers: [{ id: 'b1', title: 'CNSS', reason: 'Quarterly slip absent.', severity: 'medium', requirementId: 'req-1', sourcePage: 2, sourceExcerpt: 'Excerpt' }]
  } as QualificationResult;
  const report = assessCompliance('tender-1', requirements, qualification, companyProfile);
  assert.equal(report.assessments[0].verdict, 'missing_evidence');
});

test('matched profile evidence yields compliant and names the evidence', () => {
  const requirements = [requirement({ title: 'Certification ISO 9001 exigée', sourceExcerpt: 'Le soumissionnaire doit disposer de la certification ISO 9001 en cours de validité.' })];
  const report = assessCompliance('tender-1', requirements, null, companyProfile);
  const assessment = report.assessments[0];
  assert.equal(assessment.verdict, 'compliant');
  assert.ok(assessment.evidence.length > 0);
  assert.match(assessment.notes, /ISO 9001:2015/);
});

test('an unmatched requirement is never asserted compliant', () => {
  const requirements = [requirement({ title: 'Fourniture de véhicules blindés', sourceExcerpt: 'Le titulaire fournira des véhicules blindés homologués.' })];
  const report = assessCompliance('tender-1', requirements, null, companyProfile);
  assert.equal(report.assessments[0].verdict, 'needs_review');
  assert.deepEqual(report.assessments[0].evidence, []);
});

test('eliminatory requirements are never auto-cleared on a text match', () => {
  const requirements = [requirement({ type: 'éliminatoire', title: 'Certification ISO 9001 obligatoire', sourceExcerpt: 'La certification ISO 9001 est exigée sous peine de rejet.' })];
  const report = assessCompliance('tender-1', requirements, null, companyProfile);
  assert.equal(report.assessments[0].verdict, 'needs_review');
  assert.match(report.assessments[0].notes, /Human confirmation required/);
});

test('low extraction confidence defers to a human', () => {
  const requirements = [requirement({ confidence: 0.3, title: 'Certification ISO 9001 exigée' })];
  const report = assessCompliance('tender-1', requirements, null, companyProfile);
  assert.equal(report.assessments[0].verdict, 'needs_review');
  assert.match(report.assessments[0].notes, /confidence/);
});

test('source traceability is preserved on every assessment', () => {
  const requirements = [requirement({ sourcePage: 5, sourceExcerpt: 'Traceable excerpt from page five.' })];
  const report = assessCompliance('tender-1', requirements, null, companyProfile);
  assert.equal(report.assessments[0].sourcePage, 5);
  assert.equal(report.assessments[0].sourceExcerpt, 'Traceable excerpt from page five.');
});

test('verdicts map onto the existing requirement status contract', () => {
  assert.equal(verdictToRequirementStatus('compliant'), 'compliant');
  assert.equal(verdictToRequirementStatus('non_compliant'), 'non_compliant');
  assert.equal(verdictToRequirementStatus('missing_evidence'), 'partial');
  assert.equal(verdictToRequirementStatus('needs_review'), 'unknown');
});

test('summary counts every assessment exactly once', () => {
  const requirements = [
    requirement({ id: 'a', title: 'Certification ISO 9001 exigée' }),
    requirement({ id: 'b', title: 'Fourniture de véhicules blindés' }),
    requirement({ id: 'c', type: 'éliminatoire', title: 'Attestation CNSS exigée' })
  ];
  const report = assessCompliance('tender-1', requirements, null, companyProfile);
  const total = Object.values(report.summary).reduce((sum, count) => sum + count, 0);
  assert.equal(total, requirements.length);
});
