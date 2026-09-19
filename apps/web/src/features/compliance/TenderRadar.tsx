import { useMemo } from 'react';
import type { ComplianceAssessment, ComplianceVerdict, QualificationResult } from '../../lib/api';

interface Props {
  tenderId: string;
  assessments: ComplianceAssessment[];
  summary: Record<ComplianceVerdict, number>;
  qualification: QualificationResult | null;
  activeVerdict: ComplianceVerdict | null;
  onSelectVerdict: (verdict: ComplianceVerdict | null) => void;
}

const readiness: Array<{ verdict: ComplianceVerdict; label: string; mark: string }> = [
  { verdict: 'compliant', label: 'Compliant', mark: '✓' },
  { verdict: 'missing_evidence', label: 'Missing evidence', mark: '!' },
  { verdict: 'non_compliant', label: 'Non compliant', mark: '×' },
  { verdict: 'needs_review', label: 'Human review', mark: '?' }
];

/** Fixed verb per verdict. Derived from the stored verdict, never generated advice. */
const actionVerb: Partial<Record<ComplianceVerdict, string>> = {
  non_compliant: 'Resolve',
  missing_evidence: 'Supply evidence for'
};

const severityRank = { high: 0, medium: 1, low: 2 } as const;
const typeRank: Record<ComplianceAssessment['type'], number> = { 'éliminatoire': 0, obligatoire: 1, optionnelle: 2 };

/**
 * Tender Risk & Evidence Radar.
 *
 * Every figure below is read from persisted API data: the compliance summary,
 * the stored per-requirement verdicts and the qualification blockers. Nothing
 * is estimated, scored or recommended by this component.
 */
export function TenderRadar({ tenderId, assessments, summary, qualification, activeVerdict, onSelectVerdict }: Props) {
  const total = assessments.length;

  const topBlockers = useMemo(
    () => [...(qualification?.blockers ?? [])]
      .sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.sourcePage - b.sourcePage)
      .slice(0, 3),
    [qualification]
  );

  const priorityActions = useMemo(
    () => assessments
      .filter((item) => item.verdict === 'non_compliant' || item.verdict === 'missing_evidence')
      .sort((a, b) =>
        (a.verdict === b.verdict ? 0 : a.verdict === 'non_compliant' ? -1 : 1)
        || typeRank[a.type] - typeRank[b.type]
        || a.sourcePage - b.sourcePage)
      .slice(0, 3),
    [assessments]
  );

  if (total === 0) return null;

  const coveragePercent = Math.round((summary.compliant / total) * 100);

  return <section className="radar" aria-label="Tender risk and evidence radar">
    <div className="radar-head">
      <div>
        <p className="eyebrow">Tender readiness</p>
        <h3>Risk &amp; evidence radar</h3>
      </div>
      {qualification && <span className={`badge ${qualification.decision === 'go' ? 'ok' : qualification.decision === 'no_go' ? 'danger' : 'warn'}`}>
        {qualification.decision === 'no_go' ? 'NO-GO' : qualification.decision.toUpperCase()}
      </span>}
    </div>

    <div className="verdict-summary">
      {readiness.map((item) => <button
        type="button"
        className={`verdict-stat ${item.verdict}${activeVerdict === item.verdict ? ' is-active' : ''}`}
        key={item.verdict}
        aria-pressed={activeVerdict === item.verdict}
        title={`Filter the matrix to ${item.label.toLowerCase()} requirements`}
        onClick={() => onSelectVerdict(activeVerdict === item.verdict ? null : item.verdict)}
      >
        <div className="verdict-stat-value"><span className="verdict-mark" aria-hidden="true">{item.mark}</span>{summary[item.verdict]}</div>
        <div className="verdict-stat-label">{item.label}</div>
      </button>)}
    </div>

    <div className="coverage">
      <div className="coverage-label">
        <span>Evidence coverage</span>
        <strong>{summary.compliant} / {total} supported by company profile evidence</strong>
      </div>
      <div className="coverage-bar" role="img" aria-label={`${summary.compliant} of ${total} requirements supported, ${coveragePercent} percent`}>
        <div className="coverage-fill" style={{ width: `${coveragePercent}%` }} />
      </div>
    </div>

    {(topBlockers.length > 0 || priorityActions.length > 0) && <div className="radar-columns">
      {topBlockers.length > 0 && <div className="radar-column">
        <p className="eyebrow">Top blockers</p>
        <ol className="radar-list">
          {topBlockers.map((blocker) => <li key={blocker.id}>
            <div className="radar-item-head">
              <strong>{blocker.title}</strong>
              <span className={`badge ${blocker.severity === 'high' ? 'danger' : blocker.severity === 'medium' ? 'warn' : ''}`}>{blocker.severity}</span>
            </div>
            <p>{blocker.reason}</p>
            <a className="source-link" href={`/api/tenders/${tenderId}/document#page=${blocker.sourcePage}`} target="_blank" rel="noreferrer">
              Source · page {blocker.sourcePage} ↗
            </a>
          </li>)}
        </ol>
      </div>}

      {priorityActions.length > 0 && <div className="radar-column">
        <p className="eyebrow">Priority actions</p>
        <ol className="radar-list">
          {priorityActions.map((action) => <li key={action.requirementId}>
            <div className="radar-item-head">
              <strong>{actionVerb[action.verdict]} {action.requirementTitle}</strong>
              {action.type === 'éliminatoire' && <span className="badge danger">éliminatoire</span>}
            </div>
            <p>{action.notes}</p>
            <a className="source-link" href={`/api/tenders/${tenderId}/document#page=${action.sourcePage}`} target="_blank" rel="noreferrer">
              Source · page {action.sourcePage} ↗
            </a>
          </li>)}
        </ol>
      </div>}
    </div>}
  </section>;
}
