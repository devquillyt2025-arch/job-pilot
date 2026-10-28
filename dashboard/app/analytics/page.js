'use client';
import PageLayout from '../components/PageLayout';
import { useMemo } from 'react';
import { useDashboard } from '../lib/DashboardContext';
import { ColumnChart, HBarList } from '../components/charts';

const STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  applying: 'Applying',
  applied: 'Applied',
  skipped_external: 'External',
  needs_review: 'Needs review',
  rejected: 'Rejected',
  failed: 'Failed',
};

// Case-insensitive, so "RPA Developer" / "Rpa Developer" and "Python" / "python"
// land in one bucket; the first spelling seen is the one displayed.
function countBy(values, limit) {
  const counts = new Map();
  for (const v of values) {
    if (!v) continue;
    const key = v.toLowerCase().replace(/\s+/g, ' ');
    const entry = counts.get(key) || { label: v, value: 0 };
    entry.value += 1;
    counts.set(key, entry);
  }
  const items = [...counts.values()].sort((a, b) => b.value - a.value);
  return limit ? items.slice(0, limit) : items;
}

function workMode(location) {
  const loc = String(location || '').toLowerCase();
  if (loc.startsWith('hybrid')) return 'Hybrid';
  if (loc.includes('remote')) return 'Remote';
  if (!loc) return null;
  return 'Office / not stated';
}

function cities(location) {
  return String(location || '')
    .replace(/^(hybrid|remote)\s*-\s*/i, '')
    .split(/[,/(]/)
    .map((c) => c.replace(/\)/g, '').trim())
    .filter((c) => c && !/^remote$/i.test(c))
    .map((c) => (/^bangalore$/i.test(c) ? 'Bengaluru' : c));
}

function runLabels(runs) {
  const day = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  // Several runs on one day would all read "8 Sept" - add the time in that case.
  return runs.map((r) => (runs.filter((o) => day(o.startedAt) === day(r.startedAt)).length > 1 ? `${day(r.startedAt)} ${time(r.startedAt)}` : day(r.startedAt)));
}

function StatTile({ label, value, note }) {
  return (
    <div className="stat-tile">
      <div className="l">{label}</div>
      <div className="n">{value}</div>
      {note && <div className="l">{note}</div>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { jobs, runs } = useDashboard();

  const a = useMemo(() => {
    const by = (s) => jobs.filter((j) => j.status === s).length;
    const applied = by('applied');
    const decided = applied + by('approved') + by('rejected') + by('skipped_external') + by('failed') + by('needs_review');
    const avgScore = jobs.length ? Math.round(jobs.reduce((s, j) => s + (j.match_score || 0), 0) / jobs.length) : 0;

    const bins = [
      { label: '<60', test: (s) => s < 60 },
      { label: '60–69', test: (s) => s >= 60 && s < 70 },
      { label: '70–79', test: (s) => s >= 70 && s < 80 },
      { label: '80–89', test: (s) => s >= 80 && s < 90 },
      { label: '90+', test: (s) => s >= 90 },
    ];

    const finished = runs.filter((r) => r.finishedAt).slice().sort((x, y) => new Date(x.startedAt) - new Date(y.startedAt)).slice(-12);

    return {
      applied,
      pending: by('pending'),
      applyRate: decided ? Math.round((applied / decided) * 100) : 0,
      avgScore,
      status: Object.keys(STATUS_LABELS)
        .map((s) => ({ label: STATUS_LABELS[s], value: by(s) }))
        .filter((i) => i.value > 0),
      scoreBins: bins.map((b) => jobs.filter((j) => b.test(j.match_score || 0)).length),
      binLabels: bins.map((b) => b.label),
      runLabels: runLabels(finished),
      runFound: finished.map((r) => r.counts?.search?.added ?? 0),
      runApplied: finished.map((r) => r.counts?.apply?.applied ?? 0),
      companies: countBy(jobs.map((j) => j.company), 8),
      appliedCompanies: countBy(jobs.filter((j) => j.status === 'applied').map((j) => j.company), 8),
      locations: countBy(jobs.flatMap((j) => cities(j.location)), 8),
      modes: countBy(jobs.map((j) => workMode(j.location))),
      skills: countBy(jobs.flatMap((j) => (j.skills || []).map((s) => s.trim())), 10),
      roles: countBy(jobs.map((j) => j.role), 8),
    };
  }, [jobs, runs]);

  return (
    <PageLayout title="Analytics" sub={<>How the search and applications are doing across every run so far.</>}>

      <div className="card">
        <div className="stats-grid">
          <StatTile label="Jobs found" value={jobs.length} />
          <StatTile label="Applied" value={a.applied} />
          <StatTile label="Apply rate" value={`${a.applyRate}%`} note="of jobs you acted on" />
          <StatTile label="Awaiting approval" value={a.pending} />
          <StatTile label="Avg match score" value={a.avgScore} />
          <StatTile label="Runs" value={runs.length} />
        </div>
      </div>

      <div className="card">
        <h2>Found vs applied per run</h2>
        {a.runLabels.length === 0 ? (
          <div className="empty">No finished runs yet.</div>
        ) : (
          <ColumnChart
            categories={a.runLabels}
            series={[
              { name: 'New jobs found', color: 'var(--series-1)', values: a.runFound },
              { name: 'Applied', color: 'var(--series-2)', values: a.runApplied },
            ]}
          />
        )}
      </div>

      <div className="viz-grid-2">
        <div className="card">
          <h2>Jobs by status</h2>
          <HBarList items={a.status} />
        </div>
        <div className="card">
          <h2>Match score distribution</h2>
          <ColumnChart categories={a.binLabels} series={[{ name: 'Jobs', color: 'var(--series-1)', values: a.scoreBins }]} height={200} />
        </div>
        <div className="card">
          <h2>Work mode</h2>
          <HBarList items={a.modes} />
        </div>
        <div className="card">
          <h2>Top locations</h2>
          {/* A listing can name several cities, so shares wouldn't sum to 100%. */}
          <HBarList items={a.locations.map((l) => ({ ...l, share: false }))} unit="listings" />
        </div>
        <div className="card">
          <h2>Top hiring companies</h2>
          <HBarList items={a.companies} />
        </div>
        <div className="card">
          <h2>Companies applied to</h2>
          <HBarList items={a.appliedCompanies} unit="applications" empty="No applications yet." />
        </div>
        <div className="card">
          <h2>Most common roles</h2>
          <HBarList items={a.roles} />
        </div>
        <div className="card">
          <h2>Most requested skills</h2>
          <HBarList items={a.skills.map((s) => ({ ...s, share: false }))} unit="listings" />
        </div>
      </div>
    </PageLayout>
  );
}
