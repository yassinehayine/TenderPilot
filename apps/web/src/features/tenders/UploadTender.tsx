import { useEffect, useRef, useState } from 'react';
import { getTenderFixtures, uploadTender, uploadTenderFixture, type TenderFixture, type TenderUploadResult } from '../../lib/api';

interface Props { onUploaded: (tenderId: string) => void; onProcessingFailure: (tenderId: string) => void; }

export function UploadTender({ onUploaded, onProcessingFailure }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<TenderUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
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
    try {
      const uploaded = await uploadTender(file);
      setResult(uploaded);
      onUploaded(uploaded.id);
    } catch (uploadError) {
      if (uploadError instanceof Error && 'tenderId' in uploadError && typeof uploadError.tenderId === 'string') onProcessingFailure(uploadError.tenderId);
      setError(uploadError instanceof Error ? uploadError.message : 'Tender upload failed.');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleFixture(filename: string) {
    setError(null);
    setResult(null);
    setIsUploading(true);
    try {
      const uploaded = await uploadTenderFixture(filename);
      setResult(uploaded);
      onUploaded(uploaded.id);
    } catch (uploadError) {
      if (uploadError instanceof Error && 'tenderId' in uploadError && typeof uploadError.tenderId === 'string') onProcessingFailure(uploadError.tenderId);
      setError(uploadError instanceof Error ? uploadError.message : 'Tender fixture processing failed.');
    } finally {
      setIsUploading(false);
    }
  }

  return <section className="upload-view">
    <div className="upload-intro"><p className="eyebrow">EX-01 · Tender intake</p><h2>Start with the original PDF</h2><p>Upload the source document and TenderPilot will preserve its pages while preparing it for review.</p></div>
    <button className="upload-dropzone" onClick={() => inputRef.current?.click()} disabled={isUploading}>
      <span className="upload-symbol">↑</span><strong>{isUploading ? 'Processing document…' : 'Choose a tender PDF'}</strong><small>PDF files up to 25 MB</small>
      <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={(event) => void handleFile(event.target.files?.[0])} />
    </button>
    {fixtures.length > 0 && <div className="fixture-picker"><div><strong>Official demo fixtures</strong><small>Each AO uses the same extraction and traceability pipeline.</small></div><div className="fixture-list">{fixtures.map((fixture) => <button key={fixture.filename} disabled={isUploading} onClick={() => void handleFixture(fixture.filename)}>{fixture.filename.replace('.pdf', '')}{fixture.scanned && <span>OCR</span>}</button>)}</div></div>}
    {error && <div className="upload-feedback error"><strong>Processing stopped</strong><span>{error}</span></div>}
    {result && <div className={`upload-feedback ${result.processingStatus === 'needs_review' ? 'warning' : 'success'}`}><strong>{result.processingStatus === 'needs_review' ? 'Human review required' : 'Document ready'}</strong><span>{result.title} · stage: {result.processingStage ?? (result.processingStatus === 'ready' ? 'extract' : 'human_review')}</span>{result.unreadablePages.length > 0 && <span>Unreadable pages: {result.unreadablePages.join(', ')}. No requirements were generated from them.</span>}{result.processingError && <span>Reason: {result.processingError}</span>}</div>}
  </section>;
}