import { useEffect, useState } from 'react';
import { getTenderStatus, type TenderStatus } from '../../lib/api';

interface Props { tenderId: string | null; }

const stages = [
  { key: 'extract', label: 'Extract', agent: 'GPT-5.5' },
  { key: 'qualify', label: 'Qualify', agent: 'GPT-5.5' },
  { key: 'compliance', label: 'Compliance', agent: 'Deterministic' },
  { key: 'write', label: 'Write', agent: 'GPT-4.1' },
  { key: 'human_review', label: 'Human Review', agent: 'Human' }
] as const;

/** The API persists a finer-grained label for the extract stage. */
export function toWorkflowStage(persistedStage: string): string {
  return persistedStage === 'extracting_pdf' || persistedStage === 'extracting_requirements' ? 'extract' : persistedStage;
}

type StageState = 'done' | 'active' | 'blocked' | 'pending';

/**
 * Stages before the current one have already run, so they are reported as
 * completed. Only the current stage reflects the live processing status.
 */
export function stageStateFor(stageIndex: number, currentIndex: number, processingStatus: string): StageState {
  if (currentIndex < 0) return 'pending';
  if (stageIndex < currentIndex) return 'done';
  if (stageIndex > currentIndex) return 'pending';
  if (processingStatus === 'needs_review' || processingStatus === 'failed') return 'blocked';
  if (processingStatus === 'ready') return 'done';
  return 'active';
}

const stateLabels: Record<StageState, string> = {
  done: 'Completed',
  active: 'Running',
  blocked: 'Needs review',
  pending: 'Pending'
};

export function AgentExecutionPanel({ tenderId }: Props) {
  const [status, setStatus] = useState<TenderStatus | null>(null);
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    if (!tenderId) { setStatus(null); setIsStale(false); return; }
    let active = true;
    const load = () => void getTenderStatus(tenderId)
      .then((next) => { if (active) { setStatus(next); setIsStale(false); } })
      .catch(() => { if (active) setIsStale(true); });
    load();
    const timer = window.setInterval(load, 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, [tenderId]);

  if (!status) return null;

  const currentStage = toWorkflowStage(status.processingStage);
  const currentIndex = stages.findIndex((stage) => stage.key === currentStage);
  const isUnreadable = status.unreadablePages.length > 0;
  const isBlocked = status.processingStatus === 'needs_review' || status.processingStatus === 'failed';

  return <section className="agent-panel" aria-label="Agent execution status">
    <div className="agent-panel-heading">
      <div>
        <p className="eyebrow">Agent orchestration</p>
        <h2>{status.title}</h2>
      </div>
      <div className="agent-panel-meta">
        {isStale && <span className="badge warn" title="The API did not respond to the last status poll.">Reconnecting…</span>}
        <span className={`badge ${isBlocked ? 'danger' : status.processingStatus === 'ready' ? 'ok' : 'info'}`}>
          {status.processingStatus.replace('_', ' ')}
        </span>
      </div>
    </div>

    <ol className="agent-stage-list">
      {stages.map((stage, index) => {
        const state = stageStateFor(index, currentIndex, status.processingStatus);
        const showAttempt = index === currentIndex && status.processingAttempt > 1;
        return <li className={`agent-stage ${state}`} key={stage.key}>
          <span className="agent-stage-marker" aria-hidden="true">
            {state === 'done' ? '✓' : state === 'blocked' ? '!' : index + 1}
          </span>
          <strong>{stage.label}</strong>
          <span className="agent-stage-status">{stateLabels[state]}</span>
          {showAttempt
            ? <span className="attempt-chip">Attempt {status.processingAttempt}</span>
            : <span className="agent-stage-status">{stage.agent}</span>}
        </li>;
      })}
    </ol>

    {isUnreadable && <p className="agent-escalation">
      <strong>Human action required:</strong>
      <span>Page{status.unreadablePages.length > 1 ? 's' : ''} {status.unreadablePages.join(', ')} could not be read as text. No requirements were generated from {status.unreadablePages.length > 1 ? 'them' : 'it'}.</span>
    </p>}
    {status.processingError && <p className="agent-escalation is-error">
      <strong>Processing stopped:</strong>
      <span>{status.processingError}</span>
    </p>}
  </section>;
}
