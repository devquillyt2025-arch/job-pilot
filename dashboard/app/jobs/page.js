'use client';
import PageLayout from '../components/PageLayout';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useDashboard } from '../lib/DashboardContext';
import JobTable from '../components/JobTable';

function AllJobs() {
  const d = useDashboard();
  const runFilter = useSearchParams().get('run');
  const jobs = runFilter ? d.jobs.filter((j) => j.found_in_run === runFilter || j.applied_in_run === runFilter) : d.jobs;

  return (
    <PageLayout title="All jobs" sub={<>Every job the search has found. Click a row for details.</>}>
      {runFilter && (
        <div className="card" style={{ padding: '10px 18px' }}>
          Filtering to run <strong>{runFilter}</strong>.{' '}
          <Link href="/jobs" className="small-link">
            clear filter
          </Link>
        </div>
      )}
      <JobTable
        fill
        jobs={jobs}
        onSelect={d.setSelectedJob}
        onApprove={d.approve}
        onReject={d.reject}
        onManualStatus={d.setJobStatus}
      />
    </PageLayout>
  );
}

// useSearchParams needs a Suspense boundary or `next build` bails out.
export default function JobsPage() {
  return (
    <Suspense fallback={null}>
      <AllJobs />
    </Suspense>
  );
}
