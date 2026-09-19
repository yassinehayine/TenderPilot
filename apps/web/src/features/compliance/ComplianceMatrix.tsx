import { useEffect, useMemo, useState } from 'react';
import { getComplianceReport, getQualification, getTenderRequirements, type ComplianceAssessment, type ComplianceVerdict, type QualificationResult, type TenderRequirement } from '../../lib/api';
import { TenderRadar } from './TenderRadar';

interface Props { tenderId: string | null; }

const typeLabels: Record<TenderRequirement['type'], string> = {
  obligatoire: 'Obligatoire',
  optionnelle: 'Optionnelle',
  'éliminatoire': 'Éliminatoire'
};
const typeTone: Record<TenderRequirement['type'], string> = {
  obligatoire: 'info',
  optionnelle: '',
  'éliminatoire': 'danger'
};

const verdictLabels: Record<ComplianceVerdict, string> = {
  compliant: 'Compliant',
  non_compliant: 'Non compliant',
  missing_evidence: 'Missing evidence',
  needs_review: 'Needs review'
};
const verdictTone: Record<ComplianceVerdict, string> = {
  compliant: 'ok',
  non_compliant: 'danger',
  missing_evidence: 'warn',
  needs_review: 'info'
};

export function ComplianceMatrix({ tenderId }: Props) {
  const [requirements, setRequirements] = useState<TenderRequirement[]>([]);
  const [assessments, setAssessments] = useState<Map<string, ComplianceAssessment>>(new Map());
  const [summary, setSummary] = useState<Record<ComplianceVerdict, number> | null>(null);
  const [assessmentList, setAssessmentList] = useState<ComplianceAssessment[]>([]);
  const [qualification, setQualification] = useState<QualificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<ComplianceVerdict | null>(null);

  useEffect(() => {
    if (!tenderId) return;
    let active = true;
    setIsLoading(true);
    setError(null);
    void Promise.allSettled([getTenderRequirements(tenderId), getComplianceReport(tenderId), getQualification(tenderId)])
      .then(([requirementResult, complianceResult, qualificationResult]) => {
        if (!active) return;
        if (requirementResult.status === 'fulfilled') setRequirements(requirementResult.value);
        else setError(requirementResult.reason instanceof Error ? requirementResult.reason.message : 'Could not load the compliance matrix.');
        if (complianceResult.status === 'fulfilled' && complianceResult.value) {
          setAssessments(new Map(complianceResult.value.assessments.map((item) => [item.requirementId, item])));
          setAssessmentList(complianceResult.value.assessments);
          setSummary(complianceResult.value.summary);
        } else {
          setAssessments(new Map());
          setAssessmentList([]);
          setSummary(null);
        }
        setQualification(qualificationResult.status === 'fulfilled' ? qualificationResult.value : null);
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [tenderId]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requirements.filter((requirement) => {
      const assessment = assessments.get(requirement.id);
      if (verdictFilter && assessment?.verdict !== verdictFilter) return false;
      if (!term) return true;
      return requirement.title.toLowerCase().includes(term)
        || requirement.sourceExcerpt.toLowerCase().includes(term)
        || String(requirement.sourcePage) === term;
    });
  }, [requirements, assessments, search, verdictFilter]);

  if (!tenderId) return <section className="empty-state">
    <p className="eyebrow">Compliance matrix</p>
    <h2>No tender loaded</h2>
    <p>Upload or select a tender first. Every extracted requirement will appear here with its source page and a verdict against your company profile.</p>
  </section>;

  return <section className="matrix-view">
    <div className="page-heading">
      <div>
        <p className="eyebrow">EX-02 + EX-03 · Traceable extraction</p>
        <h2>Compliance matrix</h2>
        <p>Every row is grounded in a verbatim excerpt from the original tender. Nothing is asserted without evidence.</p>
      </div>
      <span className="badge">{requirements.length} requirements</span>
    </div>

    {error && <div className="alert error" role="alert"><strong>Matrix unavailable</strong><span>{error}</span></div>}

    {summary && <TenderRadar
      tenderId={tenderId}
      assessments={assessmentList}
      summary={summary}
      qualification={qualification}
      activeVerdict={verdictFilter}
      onSelectVerdict={setVerdictFilter}
    />}

    {requirements.length > 0 && <div className="matrix-toolbar">
      <input
        className="matrix-search"
        type="search"
        value={search}
        placeholder="Search requirements, excerpts or a page number…"
        aria-label="Search requirements"
        onChange={(event) => setSearch(event.target.value)}
      />
      {(verdictFilter || search) && <>
        <span className="matrix-filter-note">{visible.length} of {requirements.length} shown</span>
        <button className="secondary-button" onClick={() => { setSearch(''); setVerdictFilter(null); }}>Clear</button>
      </>}
    </div>}

    {isLoading && requirements.length === 0 && <div className="skeleton-list" aria-busy="true">
      <p className="loading-note">Loading extracted requirements…</p>
      <div className="skeleton" /><div className="skeleton" /><div className="skeleton" />
    </div>}

    {!isLoading && !error && requirements.length === 0 && <div className="empty-state compact">
      <h3>No requirements were extracted</h3>
      <p>The extractor persists a requirement only when it is backed by a verbatim excerpt from a readable page. Unsupported claims are never stored.</p>
    </div>}

    {!summary && requirements.length > 0 && <div className="alert info">
      <strong>Compliance not assessed yet</strong>
      <span>Run the qualification on the Go / No-Go screen — the compliance agent runs immediately after it and will fill the verdict column.</span>
    </div>}

    {visible.length === 0 && requirements.length > 0 && <div className="empty-state compact">
      <h3>No requirement matches this filter</h3>
      <p>Clear the search or verdict filter to see all {requirements.length} requirements.</p>
    </div>}

    <div className="requirement-list">
      {visible.map((requirement) => {
        const assessment = assessments.get(requirement.id);
        return <article className="requirement-row" key={requirement.id}>
          <div className="requirement-main">
            <div className="requirement-tags">
              <span className={`badge ${typeTone[requirement.type]}`}>{typeLabels[requirement.type]}</span>
              {assessment && <span className={`badge ${verdictTone[assessment.verdict]}`}>{verdictLabels[assessment.verdict]}</span>}
            </div>
            <h3>{requirement.title}</h3>
            <p className="requirement-excerpt">{requirement.sourceExcerpt}</p>
            {assessment && <p className="compliance-note">{assessment.notes}</p>}
            {assessment && assessment.evidence.length > 0 && <div className="evidence-chips">
              {assessment.evidence.map((item) => <span className="evidence-chip" key={`${item.kind}-${item.id}`}>{item.kind}: {item.label}</span>)}
            </div>}
          </div>
          <div className="requirement-meta">
            <div className="confidence-meter">
              <div className="confidence-bar"><div className="confidence-fill" style={{ width: `${Math.round(requirement.confidence * 100)}%` }} /></div>
              <span className="confidence-label">{Math.round(requirement.confidence * 100)}% confidence</span>
            </div>
            <a className="source-link" href={`/api/tenders/${tenderId}/document#page=${requirement.sourcePage}`} target="_blank" rel="noreferrer">
              Page {requirement.sourcePage} ↗
            </a>
          </div>
        </article>;
      })}
    </div>
  </section>;
}
