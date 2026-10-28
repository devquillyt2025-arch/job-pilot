'use client';

const ORDER = ['pending', 'approved', 'applying', 'applied', 'skipped_external', 'needs_review', 'rejected', 'failed'];
const LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  applying: 'Applying',
  applied: 'Applied',
  skipped_external: 'External',
  needs_review: 'Needs Review',
  rejected: 'Rejected',
  failed: 'Failed',
};

export default function StatsPanel({ stats }) {
  if (!stats) return null;
  const { byStatus, totalJobs, trend } = stats;

  return (
    <div className="card">
      <h2>Stats</h2>
      <div className="stats-grid">
        <div className="stat-tile">
          <div className="n">{totalJobs}</div>
          <div className="l">Total jobs</div>
        </div>
        {ORDER.filter((s) => byStatus[s]).map((s) => (
          <div className="stat-tile" key={s}>
            <div className="n">{byStatus[s]}</div>
            <div className="l">{LABELS[s]}</div>
          </div>
        ))}
      </div>

      {trend && trend.length > 0 && (
        <>
          <h2 className="subhead">Success rate by run</h2>
          <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Finished</th>
                <th>Applied</th>
                <th>External</th>
                <th>Needs review</th>
                <th>Failed</th>
              </tr>
            </thead>
            <tbody>
              {trend
                .slice()
                .reverse()
                .map((t) => (
                  <tr key={t.runId}>
                    <td>{new Date(t.finishedAt).toLocaleString()}</td>
                    <td>{t.applied}</td>
                    <td>{t.skipped_external}</td>
                    <td>{t.needs_review}</td>
                    <td>{t.failed}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}
