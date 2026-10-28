'use client';
import PageLayout from '../components/PageLayout';
import { useRouter } from 'next/navigation';
import { useDashboard } from '../lib/DashboardContext';
import RunHistory from '../components/RunHistory';

export default function RunsPage() {
  const d = useDashboard();
  const router = useRouter();
  return (
    <PageLayout title="Run history" sub={<>Past runs and what each one found and applied to.</>}>
      <RunHistory runs={d.runs} defaultOpen onViewJobs={(id) => router.push(`/jobs?run=${encodeURIComponent(id)}`)} />
    </PageLayout>
  );
}
