import { useEffect, useState } from 'react';
import {
  getComplianceReport,
  getQualification,
  getTenderRequirements,
  getTenderStatus,
  type ComplianceReport,
  type QualificationResult,
  type TenderRequirement,
  type TenderStatus
} from '../../lib/api';

interface Props { tenderId: string | null; onStart: () => void; }

const pipeline = [
  { title: 'Extract', detail: 'Requirements are read from the PDF with a verbatim excerpt and page number.', model: 'GPT-5.5' },
  { title: 'Qualify', detail: 'Go / No-Go decision grounded only in the official company profile.', model: 'GPT-5.5' },
  { title: 'Compliance', detail: 'Per-requirement verdict derived from persisted data. No model call.', model: 'Deterministic' },
  { title: 'Write', detail: 'Technical proposal drafted from requirements and company evidence.', model: 'GPT-4.1' },
  { title: 'Human Review', detail: 'Every section is corrected and approved by a person before export.', model: 'Human' }
];

export function DashboardView({ tenderId, onStart }: Props) {
  const [status, setStatus] = useState<TenderStatus | null>(null);
  const [requirements, setRequirements] = useState<TenderRequirement[]>([]);
  const [qualification, setQualification] = useState<QualificationResult | null>(null);
  const [compliance, setCompliance] = useState<ComplianceReport | null>(null);

  useEffect(() => {
    if (!tenderId) { setStatus(null); setRequirements([]); setQualification(null); setCompliance(null); return; }
    let active = true;
    void getTenderStatus(tenderId).then((value) => { if (active) setStatus(value); }).catch(() => undefined);
    void getTenderRequirements(tenderId).then((value) => { if (active) setRequirements(value); }).catch(() => undefined);
    void getQualification(tenderId).then((value) => { if (active) setQualification(value); }).catch(() => undefined);
    void getComplianceReport(tenderId).then((value) => { if (active) setCompliance(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [tenderId]);

  const eliminatory = requirements.filter((item) => item.type === 'éliminatoire').length;

  return <>
    <section className="page-heading">
      <div>
        <p className="eyebrow">Tender response workspace</p>
        <h1>{status ? status.title : 'TenderPilot'}</h1>
        <p>
          {status
            ? 'Current tender under analysis. Every requirement, decision and proposal section below is traceable to the source document.'
            : 'TenderPilot reads a Moroccan public tender, extracts every requirement with its source page, decides Go / No-Go against your company profile, and drafts a technical proposal for human review.'}
        </p>
      </div>
      <button className="primary-button" onClick={onStart}>{status ? 'Analyse another tender' : 'Analyse a tender'}</button>
    </section>

    {status && <div className="metric-grid">
      <article className="metric-card">
        <div className="metric-label">Requirements extracted</div>
        <div className="metric-value">{requirements.length}</div>
        <div className="metric-detail">{eliminatory} eliminatory · all with a source excerpt</div>
      </article>
      <article className="metric-card">
        <div className="metric-label">Compliance assessed</div>
        <div className="metric-value">{compliance ? compliance.assessments.length : '—'}</div>
        <div className="metric-detail">{compliance ? `${compliance.summary.compliant} compliant · ${compliance.summary.non_compliant} non compliant` : 'Run qualification to assess'}</div>
      </article>
      <article className="metric-card">
        <div className="metric-label">Qualification</div>
        <div className="metric-value">{qualification ? (qualification.decision === 'no_go' ? 'NO-GO' : qualification.decision.toUpperCase()) : '—'}</div>
        <div className="metric-detail">{qualification ? `${Math.round(qualification.score * 100)}% fit score` : 'Not assessed yet'}</div>
      </article>
      <article className="metric-card">
        <div className="metric-label">Open blockers</div>
        <div className="metric-value">{qualification ? qualification.blockers.length : '—'}</div>
        <div className="metric-detail">{qualification ? `${qualification.blockers.filter((item) => item.severity === 'high').length} high severity` : 'Not assessed yet'}</div>
      </article>
    </div>}

    <div className="dashboard-grid">
      <article className="panel pipeline-explainer">
        <div className="panel-heading"><h2>How TenderPilot works</h2></div>
        <ol>
          {pipeline.map((step) => <li key={step.title}>
            <span>
              <strong>{step.title}</strong> — {step.detail} <span className="model-tag">({step.model})</span>
            </span>
          </li>)}
        </ol>
      </article>

      <article className="panel">
        <div className="panel-heading"><h2>{status ? 'Current tender' : 'Getting started'}</h2></div>
        {status ? <>
          <div className="summary-row"><span>Document</span><strong>{status.title}</strong></div>
          <div className="summary-row"><span>Pages</span><strong>{status.pageCount}</strong></div>
          <div className="summary-row"><span>Unreadable pages</span><strong>{status.unreadablePages.length > 0 ? status.unreadablePages.join(', ') : 'None'}</strong></div>
          <div className="summary-row"><span>Processing status</span><span className={`badge ${status.processingStatus === 'needs_review' || status.processingStatus === 'failed' ? 'danger' : status.processingStatus === 'ready' ? 'ok' : 'info'}`}>{status.processingStatus.replace('_', ' ')}</span></div>
          <div className="summary-row"><span>Current stage</span><strong>{status.processingStage.replace(/_/g, ' ')}</strong></div>
        </> : <>
          <p className="empty-state" style={{ padding: 0 }}>
            <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: 'var(--fs-base)', lineHeight: 1.6 }}>
              No tender is loaded. Start from the official AO-2026 dataset or upload your own PDF — the pipeline is identical either way.
            </span>
          </p>
          <div style={{ marginTop: 14 }}><button className="secondary-button" onClick={onStart}>Choose a tender</button></div>
        </>}
      </article>
    </div>
  </>;
}
