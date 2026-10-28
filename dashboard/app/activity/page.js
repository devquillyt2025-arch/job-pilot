'use client';
import PageLayout from '../components/PageLayout';
import { useDashboard } from '../lib/DashboardContext';
import LogFeed from '../components/LogFeed';

export default function ActivityPage() {
  const d = useDashboard();
  return (
    <PageLayout title="Live activity" sub={<>Streams the current run. Cleared when a new run starts.</>}>
      <LogFeed lines={d.log} tall />
    </PageLayout>
  );
}
