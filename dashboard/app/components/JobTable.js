'use client';
import { useMemo, useState } from 'react';
import StatusBadge from './StatusBadge';
import Icon from './Icon';

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

// The header is a real <button> so sorting works from the keyboard, and
// aria-sort tells screen readers which column is active.
function SortHeader({ label, sortKey, activeKey, dir, onSort }) {
  const active = sortKey === activeKey;
  return (
    <th
      className={`sortable${active ? ' active-sort' : ''}`}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" onClick={() => onSort(sortKey)}>
        {label}
        {active && <span className="sort-arrow">{dir === 'asc' ? ' ▲' : ' ▼'}</span>}
      </button>
    </th>
  );
}

function matchesQuery(job, q) {
  return [job.company, job.role, job.location, job.reason].some((v) => v && v.toLowerCase().includes(q));
}

// `fill`: the card takes the remaining viewport height and only the job list
// scrolls (used by the list pages); otherwise it sizes to its content.
export default function JobTable({ jobs, onSelect, onApprove, onReject, onManualStatus, title = 'Jobs', showStatusFilter = true, fill = false }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('updated_at');
  const [sortDir, setSortDir] = useState('desc');

  const counts = useMemo(() => {
    const c = {};
    for (const j of jobs) c[j.status] = (c[j.status] || 0) + 1;
    return c;
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = jobs.filter((j) => (statusFilter === 'all' || j.status === statusFilter) && (!q || matchesQuery(j, q)));
    return list.sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [jobs, statusFilter, query, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sortProps = { activeKey: sortKey, dir: sortDir, onSort: toggleSort };

  return (
    <div className={`card${fill ? ' card-fill' : ''}`}>
      <div className="job-table-head">
        <div className="section-title-row">
          <h2>
            {title} <span className="muted num">({filtered.length})</span>
          </h2>
          {jobs.length > 0 && (
            <label className="search-input">
              <Icon name="search" size="sm" />
              <input
                type="search"
                placeholder="Search company, role, location…"
                aria-label={`Search ${title.toLowerCase()}`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          )}
        </div>

        {showStatusFilter && jobs.length > 0 && (
          <div className="filter-pills" role="group" aria-label="Filter by status">
            <button className={`pill ${statusFilter === 'all' ? 'active' : ''}`} aria-pressed={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
              All <span className="pill-count">{jobs.length}</span>
            </button>
            {STATUSES.filter((s) => counts[s]).map((s) => (
              <button
                key={s}
                className={`pill ${statusFilter === s ? 'active' : ''}`}
                aria-pressed={statusFilter === s}
                onClick={() => setStatusFilter(s)}
              >
                {LABELS[s]} <span className="pill-count">{counts[s]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Icon name="inbox" />
          {jobs.length === 0 ? (
            <>
              <strong>No jobs here yet</strong>
              <p>Click Run to search Naukri with your filters. New matches show up here for review.</p>
            </>
          ) : (
            <>
              <strong>No matches</strong>
              <p>Nothing matches this search or filter.</p>
            </>
          )}
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <SortHeader label="Company" sortKey="company" {...sortProps} />
                <SortHeader label="Role" sortKey="role" {...sortProps} />
                <SortHeader label="Location" sortKey="location" {...sortProps} />
                <SortHeader label="Score" sortKey="match_score" {...sortProps} />
                <SortHeader label="Status" sortKey="status" {...sortProps} />
                <th>Reason</th>
                <SortHeader label="Updated" sortKey="updated_at" {...sortProps} />
                <th className="actions-col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job, index) => (
                <tr
                  key={job.id}
                  className="clickable"
                  tabIndex={0}
                  aria-label={`${job.role} at ${job.company}, open details`}
                  onClick={() => onSelect(job)}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onSelect(job);
                    }
                  }}
                >
                  <td className="muted num">{index + 1}</td>
                  <td className="ellipsis" title={job.company}>
                    {job.company}
                  </td>
                  <td className="ellipsis" title={job.role}>
                    {job.role}
                  </td>
                  <td className="ellipsis" title={job.location || ''}>
                    {job.location || '—'}
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
                  <td className="muted num">{new Date(job.updated_at).toLocaleString()}</td>
                  <td className="actions-col" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <div className="row-actions">
                      <button
                        className="small"
                        onClick={() => window.open(job.url, '_blank', 'noopener,noreferrer')}
                        aria-label={`Open ${job.role} on Naukri`}
                      >
                        Naukri <Icon name="external" size="sm" />
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
