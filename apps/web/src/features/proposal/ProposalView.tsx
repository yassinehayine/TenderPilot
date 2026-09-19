import { useEffect, useState } from 'react';
import { generateProposal, getProposal, reviewProposalSection, type ProposalSection } from '../../lib/api';

interface Props { tenderId: string | null; reviewMode?: boolean; }

const placeholderMarker = '[À COMPLÉTER';

const reviewTone: Record<ProposalSection['reviewStatus'], string> = {
  pending: '',
  approved: 'ok',
  changes_requested: 'warn'
};
const reviewLabels: Record<ProposalSection['reviewStatus'], string> = {
  pending: 'Awaiting review',
  approved: 'Approved',
  changes_requested: 'Corrected'
};

export function ProposalView({ tenderId, reviewMode = false }: Props) {
  const [sections, setSections] = useState<ProposalSection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!tenderId) return;
    let active = true;
    setIsLoading(true);
    void getProposal(tenderId)
      .then((loaded) => {
        if (!active) return;
        setSections(loaded);
        setDrafts(Object.fromEntries(loaded.map((section) => [section.id, section.correctedContent ?? section.content])));
      })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load proposal.'); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [tenderId]);

  async function createProposal() {
    if (!tenderId) return;
    setBusy(true); setError(null); setSavedMessage(null);
    try {
      const generated = await generateProposal(tenderId);
      setSections(generated);
      setDrafts(Object.fromEntries(generated.map((section) => [section.id, section.correctedContent ?? section.content])));
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Proposal generation failed.');
    } finally { setBusy(false); }
  }

  async function saveReview(section: ProposalSection, status: 'approved' | 'changes_requested') {
    setBusy(true); setError(null);
    try {
      const saved = await reviewProposalSection(section.id, status, drafts[section.id]);
      setSections((current) => current.map((item) => item.id === saved.id ? saved : item));
      setDrafts((current) => ({ ...current, [saved.id]: saved.correctedContent ?? saved.content }));
      setSavedMessage(`“${saved.title}” saved. The correction is persisted and will survive a reload.`);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Could not save review.');
    } finally { setBusy(false); }
  }

  if (!tenderId) return <section className="empty-state">
    <p className="eyebrow">{reviewMode ? 'EX-06 · Human review' : 'EX-05 · Technical proposal'}</p>
    <h2>No tender loaded</h2>
    <p>The proposal is drafted only from persisted requirements and company evidence. Load a tender to begin.</p>
  </section>;

  const docxLink = <a className="secondary-button" href={`/api/tenders/${tenderId}/proposal.docx`}>Download DOCX</a>;

  return <section className="proposal-view">
    <div className="page-heading">
      <div>
        <p className="eyebrow">{reviewMode ? 'EX-06 · Human review' : 'EX-05 · Writer agent'}</p>
        <h2>{reviewMode ? 'Human review' : 'Technical proposal'}</h2>
        <p>{reviewMode
          ? 'Edit any section, then save or approve it. Corrections are persisted and replace the generated draft in the DOCX export.'
          : 'Drafted by GPT-4.1 from the extracted requirements and your company profile. Every section lists the evidence it used.'}</p>
      </div>
      <div className="proposal-actions">
        {!reviewMode && <button className="primary-button" onClick={() => void createProposal()} disabled={busy}>
          {busy ? 'Writing…' : sections.length ? 'Regenerate proposal' : 'Generate proposal'}
        </button>}
        {sections.length > 0 && docxLink}
      </div>
    </div>

    {error && <div className="alert error" role="alert"><strong>Proposal unavailable</strong><span>{error}</span></div>}
    {savedMessage && <div className="alert success" role="status"><strong>Correction saved</strong><span>{savedMessage}</span></div>}
    {busy && !reviewMode && <div className="alert info"><strong>The writer agent is drafting…</strong><span>Sections are grounded strictly in the supplied requirements and company evidence. This usually takes 10–20 seconds.</span></div>}

    {isLoading && sections.length === 0 && <div className="skeleton-list" aria-busy="true">
      <p className="loading-note">Loading proposal…</p>
      <div className="skeleton" /><div className="skeleton" />
    </div>}

    {!isLoading && sections.length === 0 && !error && <div className="empty-state compact">
      <h3>No proposal generated yet</h3>
      <p>{reviewMode
        ? 'Generate the proposal from the Technical Proposal screen first, then return here to review and correct it.'
        : 'Run the writer once extraction and qualification are complete.'}</p>
    </div>}

    <div className="proposal-sections">
      {sections.map((section) => {
        const draft = drafts[section.id] ?? '';
        const displayed = section.correctedContent ?? section.content;
        const isEdited = reviewMode && draft !== displayed;
        const hasPlaceholder = displayed.includes(placeholderMarker);
        return <article className="proposal-section" key={section.id}>
          <div className="section-header">
            <h3>{section.title}</h3>
            <div className="section-header-meta">
              {section.correctedContent && <span className="badge info">Human corrected</span>}
              <span className={`badge ${reviewTone[section.reviewStatus]}`}>{reviewLabels[section.reviewStatus]}</span>
            </div>
          </div>

          {reviewMode
            ? <textarea
                value={draft}
                aria-label={`${section.title} content`}
                onChange={(event) => setDrafts((current) => ({ ...current, [section.id]: event.target.value }))}
              />
            : <p className="proposal-content">{displayed}</p>}

          {isEdited && <p className="edited-hint">Unsaved changes — click “Save correction” to persist them.</p>}
          {hasPlaceholder && <p className="placeholder-flag">
            The writer found no supporting evidence for part of this section and inserted a placeholder instead of inventing a fact. A human must complete it.
          </p>}

          <div className="section-sources">
            <span>Evidence used:</span>
            {section.sourceReferences.length === 0
              ? <span className="source-chip">none declared</span>
              : section.sourceReferences.map((source) => <span className="source-chip" key={`${source.kind}-${source.id}`}>{source.label}</span>)}
          </div>

          {reviewMode && <div className="review-actions">
            <button className="secondary-button" onClick={() => void saveReview(section, 'changes_requested')} disabled={busy}>Save correction</button>
            <button className="primary-button" onClick={() => void saveReview(section, 'approved')} disabled={busy}>Approve section</button>
          </div>}
        </article>;
      })}
    </div>
  </section>;
}
