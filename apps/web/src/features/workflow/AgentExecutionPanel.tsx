import { useEffect, useState } from 'react';
import { getTenderStatus, type TenderStatus } from '../../lib/api';

interface Props { tenderId: string | null; }

const stages = [
  ['extract', 'Extract'],
  ['qualify', 'Qualify'],
  ['compliance', 'Compliance'],
  ['write', 'Write'],
  ['human_review', 'Human Review']
] as const;

function statusFor(stage: string, current: TenderStatus) {
  if (stage !== current.processingStage) return { label: 'Not executed', className: 'pending' };
  if (current.processingStatus === 'needs_review' || current.processingStatus === 'failed') return { label: 'Needs review', className: 'blocked' };
  if (current.processingStatus === 'ready') return { label: 'Recorded', className: 'complete' };
  return { label: 'In progress', className: 'active' };
}

export function AgentExecutionPanel({ tenderId }: Props) {
  const [status, setStatus] = useState<TenderStatus | null>(null);
  useEffect(() => {
    if (!tenderId) { setStatus(null); return; }
    let active = true;
    const load = () => void getTenderStatus(tenderId).then((next) => { if (active) setStatus(next); }).catch(() => undefined);
    load();
    const timer = window.setInterval(load, 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, [tenderId]);

  if (!status) return null;
  const isUnreadable = status.unreadablePages.length > 0;
  return <section className="agent-panel" aria-label="Agent execution status"><div className="agent-panel-heading"><div><p className="eyebrow">Agent execution</p><h2>{status.title}</h2></div><span className={`agent-overall ${status.processingStatus}`}>{status.processingStatus.replace('_', ' ')}</span></div><div className="agent-stage-list">{stages.map(([key, label]) => { const item = statusFor(key, status); return <div className={`agent-stage ${item.className}`} key={key}><span className="agent-stage-marker">{item.className === 'complete' ? '✓' : item.className === 'blocked' ? '!' : item.className === 'active' ? '•' : '·'}</span><strong>{label}</strong><span>{item.label}</span>{key === status.processingStage && <small>Attempt {status.processingAttempt}</small>}</div>; })}</div>{isUnreadable && <p className="agent-escalation"><strong>Human action required:</strong> pages {status.unreadablePages.join(', ')} are unreadable. Requirements were not generated from those pages.</p>}{status.processingError && <p className="agent-escalation"><strong>Processing stopped:</strong> {status.processingError}</p>}</section>;
}