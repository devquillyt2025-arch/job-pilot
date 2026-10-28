'use client';
import { DashboardProvider, useDashboard } from '../lib/DashboardContext';
import Sidebar from './Sidebar';
import RunControl from './RunControl';
import StatusStrip from './StatusStrip';
import DetailDrawer from './DetailDrawer';

function TopBar() {
  const d = useDashboard();
  return (
    <>
      <div className="header">
        <div>
          <h1>Naukri Job Dashboard</h1>
          <div className="sub">Finds matching jobs and applies to the ones you approve. Nothing applies without your review first.</div>
        </div>
        <RunControl
          connected={d.connected}
          running={d.running}
          starting={d.starting}
          onStart={d.startRun}
          onStop={d.stopRun}
          rechecking={d.rechecking}
          onRecheck={d.startRecheck}
        />
      </div>
      {d.running && (
        <StatusStrip
          running={d.running}
          phase={d.phase}
          currentJob={d.currentJob}
          progress={d.progress}
          startedAt={d.startedAt}
          now={d.now}
        />
      )}
    </>
  );
}

function Drawer() {
  const { selectedJob, setSelectedJob } = useDashboard();
  return <DetailDrawer job={selectedJob} onClose={() => setSelectedJob(null)} />;
}

export default function AppShell({ children }) {
  return (
    <DashboardProvider>
      <div className="shell">
        <Sidebar />
        <main className="main" id="main" tabIndex={-1}>
          <TopBar />
          {children}
        </main>
      </div>
      <Drawer />
    </DashboardProvider>
  );
}
