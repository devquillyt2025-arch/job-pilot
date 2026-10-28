'use client';
import PageLayout from '../components/PageLayout';
import { useDashboard } from '../lib/DashboardContext';
import JobTable from '../components/JobTable';

export default function AppliedPage() {
  const d = useDashboard();
  const applied = d.jobs.filter((j) => j.status === 'applied');
  return (
    <PageLayout title="Applied" sub={<>Jobs you&apos;ve applied to, either by the bot or marked by hand.</>}>
      <JobTable
        fill
        title="Applied"
        jobs={applied}
        showStatusFilter={false}
        onSelect={d.setSelectedJob}
        onApprove={d.approve}
        onReject={d.reject}
        onManualStatus={d.setJobStatus}
      />
    </PageLayout>
  );
}
