'use client';
import { useMemo, useState } from 'react';
import StatusBadge from './StatusBadge';

const STATUSES = ['pending', 'approved', 'applying', 'applied', 'skipped_external', 'needs_review', 'rejected', 'failed'];
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

function SortHeader({ label, sortKey, activeKey, dir, onClick }) {
  const active = sortKey === activeKey;
  return (
    <th onClick={onClick} className={active ? 'active-sort' : ''}>
      {label}
      {active && <span className="sort-arrow">{dir === 'asc' ? ' ▲' : ' ▼'}</span>}
    </th>
  );
}

export default function JobTable({ jobs, onSelect, onApprove, onReject, onManualStatus }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState('updated_at');
  const [sortDir, setSortDir] = useState('desc');

  const counts = useMemo(() => {
    const c = {};
    for (const j of jobs) c[j.status] = (c[j.status] || 0) + 1;
    return c;
  }, [jobs]);

  const filtered = useMemo(() => {
    const list = statusFilter === 'all' ? jobs : jobs.filter((j) => j.status === statusFilter);
    return [...list].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [jobs, statusFilter, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  return (
    <div className="card">
      <div className="section-title-row">
        <h2>Jobs ({filtered.length})</h2>
      </div>

      <div className="filter-pills">
        <button className={`pill ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>
          All <span className="pill-count">{jobs.length}</span>
        </button>
        {STATUSES.filter((s) => counts[s]).map((s) => (
          <button key={s} className={`pill ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
            {LABELS[s]} <span className="pill-count">{counts[s]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">No jobs in this view.</div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <SortHeader label="Company" sortKey="company" activeKey={sortKey} dir={sortDir} onClick={() => toggleSort('company')} />
                <SortHeader label="Role" sortKey="role" activeKey={sortKey} dir={sortDir} onClick={() => toggleSort('role')} />
                <SortHeader label="Score" sortKey="match_score" activeKey={sortKey} dir={sortDir} onClick={() => toggleSort('match_score')} />
                <SortHeader label="Status" sortKey="status" activeKey={sortKey} dir={sortDir} onClick={() => toggleSort('status')} />
                <th>Reason</th>
                <SortHeader label="Updated" sortKey="updated_at" activeKey={sortKey} dir={sortDir} onClick={() => toggleSort('updated_at')} />
                <th className="actions-col"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job, index) => (
                <tr key={job.id} onClick={() => onSelect(job)}>
                  <td className="muted">{index + 1}</td>
                  <td className="ellipsis" title={job.company}>
                    {job.company}
                  </td>
                  <td className="ellipsis" title={job.role}>
                    {job.role}
                  </td>
                  <td>
                    <span className={`score-pill ${job.match_score >= 75 ? 'high' : job.match_score >= 55 ? 'mid' : 'low'}`}>
                      {job.match_score}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="ellipsis" title={job.reason || ''}>
                    {job.reason || '—'}
                  </td>
                  <td className="muted">{new Date(job.updated_at).toLocaleString()}</td>
                  <td className="actions-col" onClick={(e) => e.stopPropagation()}>
                    <div className="row-actions">
                      <button className="small" onClick={() => window.open(job.url, '_blank', 'noopener,noreferrer')}>
                        Naukri ↗
                      </button>
                      {job.status === 'pending' && (
                        <>
                          <button className="small primary" onClick={() => onApprove(job.id)}>
                            Approve
                          </button>
                          <button className="small" onClick={() => onReject(job.id)}>
                            Reject
                          </button>
                        </>
                      )}
                      {(job.status === 'pending' || job.status === 'approved') && (
                        <button
                          className="small"
                          onClick={() => onManualStatus(job.id, 'applied')}
                          title="Already applied by hand outside the bot? Flag it here."
                        >
                          Mark applied
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
