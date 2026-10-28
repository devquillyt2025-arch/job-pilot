'use client';
import Link from 'next/link';
import { useDashboard } from './lib/DashboardContext';
import StatsPanel from './components/StatsPanel';
import LogFeed from './components/LogFeed';
import JobTable from './components/JobTable';
import Icon from './components/Icon';
import PageLayout from './components/PageLayout';

export default function OverviewPage() {
  const d = useDashboard();
  const pending = d.jobs.filter((j) => j.status === 'pending');
  const needsReview = d.jobs.filter((j) => j.status === 'needs_review').length;
  const topPending = [...pending].sort((a, b) => b.match_score - a.match_score).slice(0, 5);

  return (
    <PageLayout
      title="Overview"
      sub={d.running ? 'A run is in progress. Progress is shown above.' : 'Idle. Click Run to search for new matches and apply to any approved jobs.'}
    >

      {(pending.length > 0 || needsReview > 0) && (
        <div className="callouts">
          {pending.length > 0 && (
            <Link href="/pending" className="callout">
              <Icon name="clock" />
              <span>
                <strong>{pending.length}</strong> jobs waiting for your approval
              </span>
              <Icon name="arrowRight" className="go" />
            </Link>
          )}
          {needsReview > 0 && (
            <Link href="/review" className="callout alert">
              <Icon name="alert" />
              <span>
                <strong>{needsReview}</strong> jobs need your input
              </span>
              <Icon name="arrowRight" className="go" />
            </Link>
          )}
        </div>
      )}

      <StatsPanel stats={d.stats} />
      {topPending.length > 0 && (
        <JobTable
          title="Top pending matches"
          jobs={topPending}
          showStatusFilter={false}
          onSelect={d.setSelectedJob}
          onApprove={d.approve}
          onReject={d.reject}
          onManualStatus={d.setJobStatus}
        />
      )}
      <LogFeed lines={d.log} />
    </PageLayout>
  );
}
