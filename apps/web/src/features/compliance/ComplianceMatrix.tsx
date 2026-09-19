import { useEffect, useState } from 'react';
import { getComplianceReport, getTenderRequirements, type ComplianceAssessment, type ComplianceVerdict, type TenderRequirement } from '../../lib/api';

interface Props { tenderId: string | null; }

const typeLabels = { obligatoire: 'Obligatoire', optionnelle: 'Optionnelle', éliminatoire: 'Éliminatoire' };
const verdictLabels: Record<ComplianceVerdict, string> = {
  compliant: 'Compliant',
  non_compliant: 'Non compliant',
  missing_evidence: 'Missing evidence',
  needs_review: 'Needs review'
};
const verdictOrder: ComplianceVerdict[] = ['compliant', 'non_compliant', 'missing_evidence', 'needs_review'];

export function ComplianceMatrix({ tenderId }: Props) {
  const [requirements, setRequirements] = useState<TenderRequirement[]>([]);
  const [assessments, setAssessments] = useState<Map<string, ComplianceAssessment>>(new Map());
  const [summary, setSummary] = useState<Record<ComplianceVerdict, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!tenderId) return;
    void getTenderRequirements(tenderId).then(setRequirements).catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not load the compliance matrix.'));
    void getComplianceReport(tenderId).then((report) => {
      setAssessments(new Map((report?.assessments ?? []).map((item) => [item.requirementId, item])));
      setSummary(report?.summary ?? null);
    }).catch(() => undefined);
  }, [tenderId]);

  if (!tenderId) return <section className="empty-state"><p className="eyebrow">EX-02 · Compliance matrix</p><h2>Upload a tender first</h2><p>The extracted requirements and their source pages will appear here after processing.</p></section>;
  return <section className="matrix-view"><div className="matrix-heading"><div><p className="eyebrow">EX-02 + EX-03 · Traceable extraction</p><h2>Compliance matrix</h2><p>Every row is grounded in an excerpt from the original tender.</p></div><span className="matrix-count">{requirements.length} requirements</span></div>{summary && <div className="compliance-summary">{verdictOrder.map((verdict) => <span className={`verdict-tag ${verdict}`} key={verdict}>{verdictLabels[verdict]}: {summary[verdict]}</span>)}</div>}{error && <div className="upload-feedback error"><strong>Matrix unavailable</strong><span>{error}</span></div>}{!error && requirements.length === 0 && <div className="empty-state compact"><h3>No supported requirements found</h3><p>The extractor did not persist unsupported or unverifiable claims.</p></div>}<div className="requirement-list">{requirements.map((requirement) => { const assessment = assessments.get(requirement.id); return <article className="requirement-row" key={requirement.id}><div className="requirement-main"><span className={`type-tag ${requirement.type}`}>{typeLabels[requirement.type]}</span>{assessment && <span className={`verdict-tag ${assessment.verdict}`}>{verdictLabels[assessment.verdict]}</span>}<h3>{requirement.title}</h3><p>{requirement.sourceExcerpt}</p>{assessment && <p className="compliance-note">{assessment.notes}</p>}</div><div className="requirement-meta"><span className="confidence">{Math.round(requirement.confidence * 100)}% confidence</span><a href={`/api/tenders/${tenderId}/document#page=${requirement.sourcePage}`} target="_blank" rel="noreferrer">Page {requirement.sourcePage} ↗</a></div></article>; })}</div></section>;
}
