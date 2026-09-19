import { useEffect, useState } from 'react';
import { getCompanyProfile, getQualification, qualifyTender, type CompanyProfileSummary, type QualificationResult } from '../../lib/api';

interface Props { tenderId: string | null; }

export function QualificationView({ tenderId }: Props) {
  const [profile, setProfile] = useState<CompanyProfileSummary | null>(null);
  const [result, setResult] = useState<QualificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!tenderId) return;
    void getCompanyProfile().then(setProfile).catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not load company profile.'));
    void getQualification(tenderId).then(setResult).catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not load qualification.'));
  }, [tenderId]);

  async function runQualification() {
    if (!tenderId) return;
    setError(null);
    try {
      setIsRunning(true);
      setResult(await qualifyTender(tenderId));
    } catch (qualificationError) {
      setError(qualificationError instanceof Error ? qualificationError.message : 'Qualification failed.');
    } finally {
      setIsRunning(false);
    }
  }

  if (!tenderId) return <section className="empty-state"><p className="eyebrow">EX-04 · Qualification</p><h2>Upload a tender first</h2><p>The Go/No-Go decision will be grounded in extracted requirements and your company profile.</p></section>;
  return <section className="qualification-view"><div className="qualification-heading"><div><p className="eyebrow">EX-04 · Eligibility reasoning</p><h2>Go / No-Go</h2><p>Only facts supplied in the official company profile may support the decision.</p></div><button className="primary-button" onClick={() => void runQualification()} disabled={isRunning || !profile}>{isRunning ? 'Assessing…' : 'Run qualification'}</button></div>{profile && <div className="profile-summary"><strong>{profile.raison_sociale}</strong><span>{profile.references.length} references · {profile.equipe.length} team profiles · {profile.attestations_documents.length} attestations · {profile.offres_passees.length} previous proposals</span></div>}{error && <div className="upload-feedback error"><strong>Qualification unavailable</strong><span>{error}</span></div>}{result && <div className="qualification-result"><div className={`decision-panel ${result.decision}`}><span className="eyebrow">Decision</span><strong>{result.decision === 'no_go' ? 'NO-GO' : result.decision.toUpperCase()}</strong><span>{Math.round(result.score * 100)}% fit score</span></div><div className="justification"><p className="eyebrow">Agent justification</p><p>{result.justification}</p></div><div className="blockers-panel"><div className="panel-heading"><div><p className="eyebrow">Traceable blockers</p><h3>{result.blockers.length} blocker(s)</h3></div></div>{result.blockers.map((blocker) => <article className="blocker-row" key={blocker.id}><div><span className={`severity ${blocker.severity}`}>{blocker.severity}</span><strong>{blocker.title}</strong><p>{blocker.reason}</p></div><a href={`/api/tenders/${tenderId}/document#page=${blocker.sourcePage}`} target="_blank" rel="noreferrer">Requirement source · p. {blocker.sourcePage} ↗</a></article>)}</div></div>}</section>;
}