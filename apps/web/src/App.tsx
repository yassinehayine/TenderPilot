import { useState } from 'react';
import { UploadTender } from './features/tenders/UploadTender';
import { ComplianceMatrix } from './features/compliance/ComplianceMatrix';
import { QualificationView } from './features/qualification/QualificationView';
import { ProposalView } from './features/proposal/ProposalView';
import { AgentExecutionPanel } from './features/workflow/AgentExecutionPanel';
import { DashboardView } from './features/dashboard/DashboardView';

interface NavItem { label: string; step?: number; }
interface NavGroup { group: string; items: NavItem[]; }

const navigation: NavGroup[] = [
  { group: 'Workspace', items: [{ label: 'Dashboard' }] },
  { group: 'Tender', items: [{ label: 'Upload Tender', step: 1 }] },
  { group: 'Analysis', items: [{ label: 'Compliance Matrix', step: 2 }, { label: 'Go / No-Go', step: 3 }] },
  { group: 'Proposal', items: [{ label: 'Technical Proposal', step: 4 }, { label: 'Human Review', step: 5 }] }
];

function App() {
  const [activePage, setActivePage] = useState('Dashboard');
  const [currentTenderId, setCurrentTenderId] = useState<string | null>(null);

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">T</span><span>TenderPilot</span></div>
      <p className="brand-tagline">Tender response workspace</p>
      {navigation.map((section) => <div className="nav-group" key={section.group}>
        <p className="nav-group-label">{section.group}</p>
        <nav aria-label={section.group}>
          {section.items.map((item) => <button
            className={`nav-item${activePage === item.label ? ' active' : ''}${item.step && currentTenderId ? ' done' : ''}`}
            key={item.label}
            aria-current={activePage === item.label ? 'page' : undefined}
            onClick={() => setActivePage(item.label)}
          >
            {item.step && <span className="nav-step" aria-hidden="true">{item.step}</span>}
            {item.label}
          </button>)}
        </nav>
      </div>)}
      <div className="sidebar-footer">
        <strong>ATLAS DIGITAL SERVICES</strong>
        <small>Official company profile loaded</small>
      </div>
    </aside>

    <main className="main-content">
      <header className="topbar">
        <div className="breadcrumb">Workspace <span>/</span> <strong>{activePage}</strong></div>
        <div className="top-actions">
          <span className="badge">{currentTenderId ? 'Tender loaded' : 'No tender loaded'}</span>
        </div>
      </header>

      <div className="content-wrap">
        <AgentExecutionPanel tenderId={currentTenderId} />
        {activePage === 'Upload Tender'
          ? <UploadTender onUploaded={(tenderId) => { setCurrentTenderId(tenderId); setActivePage('Compliance Matrix'); }} onProcessingFailure={setCurrentTenderId} />
          : activePage === 'Compliance Matrix' ? <ComplianceMatrix tenderId={currentTenderId} />
          : activePage === 'Go / No-Go' ? <QualificationView tenderId={currentTenderId} />
          : activePage === 'Technical Proposal' ? <ProposalView tenderId={currentTenderId} />
          : activePage === 'Human Review' ? <ProposalView tenderId={currentTenderId} reviewMode />
          : <DashboardView tenderId={currentTenderId} onStart={() => setActivePage('Upload Tender')} />}
      </div>
    </main>
  </div>;
}

export default App;
