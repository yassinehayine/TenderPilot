import { useEffect, useState } from 'react';
import {
  getCompanyProfile,
  getComplianceReport,
  getQualification,
  qualifyTender,
  type CompanyProfileSummary,
  type ComplianceReport,
  type QualificationResult
} from '../../lib/api';

interface Props { tenderId: string | null; }

const decisionLabels: Record<QualificationResult['decision'], string> = {
  go: 'GO',
  no_go: 'NO-GO',
  pending: 'PENDING'
};
const severityTone: Record<'high' | 'medium' | 'low', string> = { high: 'danger', medium: 'warn', low: '' };

export function QualificationView({ tenderId }: Props) {
  const [profile, setProfile] = useState<CompanyProfileSummary | null>(null);
  const [result, setResult] = useState<QualificationResult | null>(null);
  const [compliance, setCompliance] = useState<ComplianceReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!tenderId) return;
    let active = true;
    setIsLoading(true);
    void getCompanyProfile().then((value) => { if (active) setProfile(value); })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load company profile.'); });
    void Promise.allSettled([getQualification(tenderId), getComplianceReport(tenderId)])
      .then(([qualificationResult, complianceResult]) => {
        if (!active) return;
        if (qualificationResult.status === 'fulfilled') setResult(qualificationResult.value);
        if (complianceResult.status === 'fulfilled') setCompliance(complianceResult.value);
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [tenderId]);

  async function runQualification() {
    if (!tenderId) return;
    setError(null);
    setIsRunning(true);
    try {
      setResult(await qualifyTender(tenderId));
      setCompliance(await getComplianceReport(tenderId).catch(() => null));
    } catch (qualificationError) {
      setError(qualificationError instanceof Error ? qualificationError.message : 'Qualification failed.');
    } finally {
      setIsRunning(false);
    }
  }

  if (!tenderId) return <section className="empty-state">
    <p className="eyebrow">EX-04 · Qualification</p>
    <h2>No tender loaded</h2>
    <p>The Go / No-Go decision is grounded in the extracted requirements and your official company profile. Load a tender to begin.</p>
  </section>;

  return <section className="qualification-view">
    <div className="page-heading">
      <div>
        <p className="eyebrow">EX-04 · Eligibility reasoning</p>
        <h2>Go / No-Go</h2>
        <p>Only facts present in the official company profile may support the decision. The agent never infers a capability you have not declared.</p>
      </div>
      <button className="primary-button" onClick={() => void runQualification()} disabled={isRunning || !profile}>
        {isRunning ? 'Assessing…' : result ? 'Re-run qualification' : 'Run qualification'}
      </button>
    </div>

    {profile && <div className="profile-summary">
      <strong>{profile.raison_sociale}</strong>
      <span>{profile.references.length} references · {profile.equipe.length} team profiles · {profile.attestations_documents.length} attestations · {profile.offres_passees.length} previous proposals</span>
    </div>}

    {error && <div className="alert error" role="alert"><strong>Qualification unavailable</strong><span>{error}</span></div>}

    {isRunning && <div className="alert info"><strong>Running the qualifier…</strong><span>The qualifier reviews every extracted requirement against the company profile, then the compliance agent scores each one. This usually takes 15–35 seconds.</span></div>}

    {!isLoading && !result && !isRunning && !error && <div className="empty-state compact">
      <h3>No qualification yet</h3>
      <p>Run the qualification to produce a Go / No-Go decision with traceable blockers. The compliance verdicts are produced in the same step.</p>
    </div>}

    {result && <div className="qualification-result">
      <div className={`decision-panel ${result.decision}`}>
        <p className="eyebrow">Decision</p>
        <strong>{decisionLabels[result.decision]}</strong>
        <div className="score-meter">
          <div className="score-bar"><div className="score-fill" style={{ width: `${Math.round(result.score * 100)}%` }} /></div>
          <p className="score-caption">{Math.round(result.score * 100)}% fit score — an indicative measure of profile coverage, not a guarantee of award.</p>
        </div>
      </div>

      <div className="justification">
        <p className="eyebrow">Agent justification</p>
        <p>{result.justification}</p>
      </div>

      {compliance && <div className="blockers-panel">
        <div className="panel-heading"><h3>Compliance summary</h3><span className="badge">{compliance.assessments.length} requirements assessed</span></div>
        <div className="summary-row"><span>Compliant</span><span className="badge ok">{compliance.summary.compliant}</span></div>
        <div className="summary-row"><span>Non compliant</span><span className="badge danger">{compliance.summary.non_compliant}</span></div>
        <div className="summary-row"><span>Missing evidence</span><span className="badge warn">{compliance.summary.missing_evidence}</span></div>
        <div className="summary-row"><span>Needs human review</span><span className="badge info">{compliance.summary.needs_review}</span></div>
      </div>}

      <div className="blockers-panel">
        <div className="panel-heading">
          <h3>Traceable blockers</h3>
          <span className="badge">{result.blockers.length}</span>
        </div>
        {result.blockers.length === 0
          ? <p className="loading-note">No blocker was raised against the company profile.</p>
          : result.blockers.map((blocker) => <article className="blocker-row" key={blocker.id}>
            <div>
              <span className={`badge ${severityTone[blocker.severity]}`}>{blocker.severity}</span>
              <strong>{blocker.title}</strong>
              <p>{blocker.reason}</p>
            </div>
            <a className="source-link" href={`/api/tenders/${tenderId}/document#page=${blocker.sourcePage}`} target="_blank" rel="noreferrer">
              Source · p. {blocker.sourcePage} ↗
            </a>
          </article>)}
      </div>
    </div>}
  </section>;
}
