'use client';
import PageLayout from '../components/PageLayout';
import { useDashboard } from '../lib/DashboardContext';
import ReviewQueue from '../components/ReviewQueue';

export default function ReviewPage() {
  const d = useDashboard();
  return (
    <PageLayout title="Needs review" sub={<>Applications that got stuck on a screening question or a page the bot couldn&apos;t read.</>}>
      <ReviewQueue jobs={d.jobs} onRefresh={d.refreshAll} />
    </PageLayout>
  );
}
