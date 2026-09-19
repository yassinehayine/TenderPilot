import { useEffect, useRef, useState } from 'react';
import { getTenderFixtures, uploadTender, uploadTenderFixture, type TenderFixture, type TenderUploadResult } from '../../lib/api';

interface Props { onUploaded: (tenderId: string) => void; onProcessingFailure: (tenderId: string) => void; }

const demoFixture = 'AO-2026-001.pdf';

export function UploadTender({ onUploaded, onProcessingFailure }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<TenderUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [fixtures, setFixtures] = useState<TenderFixture[]>([]);

  useEffect(() => { void getTenderFixtures().then(setFixtures).catch(() => undefined); }, []);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    if (file.type !== 'application/pdf') {
      setError('Please choose a PDF tender document.');
      return;
    }
    setIsUploading(true);
    setPendingLabel(file.name);
    try {
      const uploaded = await uploadTender(file);
      setResult(uploaded);
      onUploaded(uploaded.id);
    } catch (uploadError) {
      if (uploadError instanceof Error && 'tenderId' in uploadError && typeof uploadError.tenderId === 'string') onProcessingFailure(uploadError.tenderId);
      setError(uploadError instanceof Error ? uploadError.message : 'Tender upload failed.');
    } finally {
      setIsUploading(false);
      setPendingLabel(null);
    }
  }

  async function handleFixture(filename: string) {
    setError(null);
    setResult(null);
    setIsUploading(true);
    setPendingLabel(filename);
    try {
      const uploaded = await uploadTenderFixture(filename);
      setResult(uploaded);
      onUploaded(uploaded.id);
    } catch (uploadError) {
      if (uploadError instanceof Error && 'tenderId' in uploadError && typeof uploadError.tenderId === 'string') onProcessingFailure(uploadError.tenderId);
      setError(uploadError instanceof Error ? uploadError.message : 'Tender fixture processing failed.');
    } finally {
      setIsUploading(false);
      setPendingLabel(null);
    }
  }

  const needsHumanReview = result?.processingStatus === 'needs_review';

  return <section className="upload-view">
    <div className="page-heading">
      <div>
        <p className="eyebrow">EX-01 · Tender intake</p>
        <h2>Load a tender</h2>
        <p>TenderPilot keeps the original PDF as the single source of truth. Every requirement it extracts stays linked to the page it came from.</p>
      </div>
    </div>

    <button className="upload-dropzone" onClick={() => inputRef.current?.click()} disabled={isUploading}>
      <span className="upload-symbol" aria-hidden="true">↑</span>
      <strong>{isUploading ? `Processing ${pendingLabel ?? 'document'}…` : 'Choose a tender PDF'}</strong>
      <small>{isUploading ? 'Extraction runs on the real document — this takes up to a minute.' : 'PDF files up to 25 MB'}</small>
      <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={(event) => void handleFile(event.target.files?.[0])} />
    </button>

    {fixtures.length > 0 && <div className="card fixture-picker">
      <div>
        <strong>Official AO-2026 dataset</strong>
        <p className="loading-note" style={{ margin: '4px 0 0' }}>Every document runs through the identical extraction and traceability pipeline.</p>
      </div>
      <div className="fixture-list">
        {fixtures.map((fixture) => <button
          key={fixture.filename}
          className={fixture.filename === demoFixture ? 'is-primary' : undefined}
          disabled={isUploading}
          onClick={() => void handleFixture(fixture.filename)}
        >
          {fixture.filename.replace('.pdf', '')}
          {fixture.scanned && <span className="badge warn">Scanned</span>}
        </button>)}
      </div>
    </div>}

    {isUploading && <div className="alert info" role="status">
      <strong>Extraction in progress</strong>
      <span>The extractor is reading each page and recording a verbatim excerpt for every requirement it finds.</span>
    </div>}

    {error && <div className="alert error" role="alert">
      <strong>Processing stopped</strong>
      <span>{error}</span>
    </div>}

    {result && <div className={`alert ${needsHumanReview ? 'warning' : 'success'}`} role="status">
      <strong>{needsHumanReview ? 'Document requires human intervention' : 'Document ready'}</strong>
      <span>{result.title} · {result.pageCount} pages · {result.requirementCount} requirements extracted</span>
      {result.unreadablePages.length > 0 && <span>
        Page{result.unreadablePages.length > 1 ? 's' : ''} {result.unreadablePages.join(', ')} contain no extractable text — this is a scanned document that needs OCR or manual entry.
        TenderPilot deliberately generated <strong>no requirements</strong> from {result.unreadablePages.length > 1 ? 'them' : 'it'} rather than guessing.
      </span>}
      {result.processingError && <span>Reason: {result.processingError}</span>}
    </div>}
  </section>;
}
