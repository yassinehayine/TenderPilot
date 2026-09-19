import { useEffect, useState } from 'react';
import { generateProposal, getProposal, reviewProposalSection, type ProposalSection } from '../../lib/api';

interface Props { tenderId: string | null; reviewMode?: boolean; }

export function ProposalView({ tenderId, reviewMode = false }: Props) {
  const [sections, setSections] = useState<ProposalSection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => { if (tenderId) void getProposal(tenderId).then((loaded) => { setSections(loaded); setDrafts(Object.fromEntries(loaded.map((section) => [section.id, section.correctedContent ?? section.content]))); }).catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not load proposal.')); }, [tenderId]);

  async function createProposal() {
    if (!tenderId) return;
    setBusy(true); setError(null);
    try { const generated = await generateProposal(tenderId); setSections(generated); setDrafts(Object.fromEntries(generated.map((section) => [section.id, section.content]))); } catch (generationError) { setError(generationError instanceof Error ? generationError.message : 'Proposal generation failed.'); } finally { setBusy(false); }
  }

  async function saveReview(section: ProposalSection, status: 'approved' | 'changes_requested') {
    setBusy(true); setError(null);
    try { const saved = await reviewProposalSection(section.id, status, drafts[section.id]); setSections((current) => current.map((item) => item.id === saved.id ? saved : item)); setSavedMessage(`Saved: ${saved.title}`); } catch (reviewError) { setError(reviewError instanceof Error ? reviewError.message : 'Could not save review.'); } finally { setBusy(false); }
  }

  if (!tenderId) return <section className="empty-state"><p className="eyebrow">EX-05 · Technical proposal</p><h2>Upload a tender first</h2><p>The proposal will be generated only from persisted requirements and company evidence.</p></section>;
  return <section className="proposal-view"><div className="proposal-heading"><div><p className="eyebrow">{reviewMode ? 'EX-06 · Human review' : 'EX-05 · Writer agent'}</p><h2>{reviewMode ? 'Review proposal' : 'Technical proposal'}</h2><p>{reviewMode ? 'Corrections are persisted and remain available after reload.' : 'Every section includes the evidence used by the writer.'}</p></div>{!reviewMode && <div className="proposal-actions"><button className="primary-button" onClick={() => void createProposal()} disabled={busy}>{busy ? 'Writing…' : sections.length ? 'Regenerate proposal' : 'Generate proposal'}</button>{sections.length > 0 && <a className="secondary-button" href={`/api/tenders/${tenderId}/proposal.docx`}>Download DOCX</a>}</div>}</div>{error && <div className="upload-feedback error"><strong>Proposal unavailable</strong><span>{error}</span></div>}{savedMessage && <div className="review-confirmation">{savedMessage}. Reloading this view will keep the correction.</div>}{sections.length === 0 && !error && <div className="empty-state compact"><h3>No proposal generated yet</h3><p>Run the writer after extraction and qualification are available.</p></div>}<div className="proposal-sections">{sections.map((section) => <article className="proposal-section" key={section.id}><div className="section-header"><h3>{section.title}</h3><span className={`review-badge ${section.reviewStatus}`}>{section.reviewStatus.replace('_', ' ')}</span></div>{reviewMode ? <textarea value={drafts[section.id] ?? ''} onChange={(event) => setDrafts((current) => ({ ...current, [section.id]: event.target.value }))} /> : <p className="proposal-content">{section.correctedContent ?? section.content}</p>}<div className="section-sources"><span>Sources:</span>{section.sourceReferences.map((source) => <span className="source-chip" key={`${source.kind}-${source.id}`}>{source.label}</span>)}</div>{reviewMode && <div className="review-actions"><button className="secondary-button" onClick={() => void saveReview(section, 'changes_requested')} disabled={busy}>Save correction</button><button className="primary-button" onClick={() => void saveReview(section, 'approved')} disabled={busy}>Approve section</button></div>}</article>)}</div></section>;
}