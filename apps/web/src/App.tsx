import { useState } from 'react';

const navigation = [
  { label: 'Dashboard', icon: '▦' }, { label: 'Upload Tender', icon: '↑' }, { label: 'Tenders', icon: '▤' },
  { label: 'Compliance Matrix', icon: '✓' }, { label: 'Go / No-Go', icon: '↗' }, { label: 'Blockers', icon: '!' },
  { label: 'Technical Proposal', icon: '✎' }, { label: 'Human Review', icon: '◎' }
];
const metrics = [
  { label: 'Active tenders', value: '04', detail: 'Across 2 workspaces', accent: 'teal' },
  { label: 'Pending review', value: '12', detail: 'Requires attention', accent: 'amber' },
  { label: 'Open blockers', value: '03', detail: '2 high priority', accent: 'coral' }
];

function App() {
  const [activePage, setActivePage] = useState('Dashboard');
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">T</span><span>TenderPilot</span></div><div className="workspace-label">Workspace</div><div className="workspace-switcher"><span className="workspace-dot" />Northstar Studio <span className="chevron">⌄</span></div><nav aria-label="Main navigation">{navigation.map((item) => <button className={activePage === item.label ? 'nav-item active' : 'nav-item'} key={item.label} onClick={() => setActivePage(item.label)}><span className="nav-icon">{item.icon}</span>{item.label}</button>)}</nav><div className="sidebar-footer"><div className="user-avatar">AM</div><div><strong>Alex Morgan</strong><small>Workspace admin</small></div><span className="more">•••</span></div></aside>
    <main className="main-content"><header className="topbar"><div className="breadcrumb">Workspace <span>/</span> {activePage}</div><div className="top-actions"><button className="icon-button" aria-label="Notifications">◌</button><button className="help-button">? <span>Help center</span></button></div></header><div className="content-wrap">
      <section className="page-heading"><div><p className="eyebrow">Friday, 18 September 2026</p><h1>{activePage}</h1><p className="subtitle">A clear view of your tender pipeline and next decisions.</p></div><button className="primary-button" onClick={() => setActivePage('Upload Tender')}><span>+</span> Upload tender</button></section>
      <section className="metric-grid">{metrics.map((metric) => <article className={`metric-card ${metric.accent}`} key={metric.label}><div className="metric-label">{metric.label}<span className="metric-arrow">↗</span></div><div className="metric-value">{metric.value}</div><div className="metric-detail">{metric.detail}</div></article>)}</section>
      <section className="dashboard-grid"><article className="panel pipeline-panel"><div className="panel-heading"><div><p className="eyebrow">At a glance</p><h2>Pipeline overview</h2></div><button className="text-button">View all <span>↗</span></button></div><div className="pipeline-list"><div className="pipeline-row"><span className="status-dot teal-dot" /><div><strong>Metro rail extension</strong><small>Technical proposal · Due 24 Sep</small></div><span className="tag teal-tag">In progress</span></div><div className="pipeline-row"><span className="status-dot amber-dot" /><div><strong>Regional energy framework</strong><small>Go / No-Go · Due 21 Sep</small></div><span className="tag amber-tag">Review</span></div><div className="pipeline-row"><span className="status-dot coral-dot" /><div><strong>City data platform</strong><small>Compliance matrix · Due 02 Oct</small></div><span className="tag coral-tag">Blocked</span></div></div></article><article className="panel focus-panel"><div className="panel-heading"><div><p className="eyebrow">Your focus</p><h2>Next actions</h2></div><span className="action-count">04</span></div><div className="action-list"><button className="action-row"><span className="action-number">01</span><span><strong>Review 6 requirements</strong><small>Metro rail extension</small></span><span className="row-arrow">→</span></button><button className="action-row"><span className="action-number">02</span><span><strong>Resolve a blocker</strong><small>Regional energy framework</small></span><span className="row-arrow">→</span></button><button className="action-row"><span className="action-number">03</span><span><strong>Approve proposal section</strong><small>City data platform</small></span><span className="row-arrow">→</span></button></div></article></section>
      <section className="bottom-note"><span className="note-icon">✦</span><div><strong>Agentic workflows are coming next</strong><p>The foundation is ready for extraction, qualification, compliance, and proposal assistance.</p></div><span className="note-status">Foundation phase</span></section>
    </div></main>
  </div>;
}
export default App;