'use client';
import { useState } from 'react';

function formatDuration(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return '—';
  const secs = Math.round((new Date(finishedAt) - new Date(startedAt)) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

export default function RunHistory({ runs, onViewJobs, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card">
      <div className="section-title-row">
        <h2>Run history ({runs.length})</h2>
        <button className="small" onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open &&
        (runs.length === 0 ? (
          <div className="empty">No runs yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Started</th>
                <th>Duration</th>
                <th>Found</th>
                <th>Applied</th>
                <th>External</th>
                <th>Needs review</th>
                <th>Failed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.startedAt).toLocaleString()}</td>
                  <td>{formatDuration(r.startedAt, r.finishedAt)}</td>
                  <td>{r.counts?.search?.added ?? '—'}</td>
                  <td>{r.counts?.apply?.applied ?? '—'}</td>
                  <td>{r.counts?.apply?.skipped_external ?? '—'}</td>
                  <td>{r.counts?.apply?.needs_review ?? '—'}</td>
                  <td>{r.counts?.apply?.failed ?? '—'}</td>
                  <td>
                    <button className="small" onClick={() => onViewJobs(r.id)}>
                      view jobs
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
    </div>
  );
}
