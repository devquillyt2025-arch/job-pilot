'use client';
import PageLayout from '../components/PageLayout';
import { useDashboard } from '../lib/DashboardContext';
import JobTable from '../components/JobTable';

export default function PendingPage() {
  const d = useDashboard();
  const pending = d.jobs.filter((j) => j.status === 'pending');

  async function approveAll() {
    if (!window.confirm(`Approve all ${pending.length} pending jobs? They will be applied to on the next run.`)) return;
    for (const job of pending) await d.approve(job.id);
  }

  return (
    <PageLayout
      title="Pending approval"
      sub="Matches found by the search. Approve the ones you want, and the next run applies to them."
      actions={
        pending.length > 0 && (
          <button className="primary" onClick={approveAll}>
            Approve all ({pending.length})
          </button>
        )
      }
    >
      <JobTable
        fill
        title="Pending"
        jobs={pending}
        showStatusFilter={false}
        onSelect={d.setSelectedJob}
        onApprove={d.approve}
        onReject={d.reject}
        onManualStatus={d.setJobStatus}
      />
    </PageLayout>
  );
}
