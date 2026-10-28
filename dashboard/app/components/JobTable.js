'use client';
import { useEffect, useMemo, useState } from 'react';
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

const SORT_OPTIONS = [
  { key: 'updated_at', label: 'Updated' },
  { key: 'match_score', label: 'Score' },
  { key: 'company', label: 'Company' },
  { key: 'role', label: 'Role' },
  { key: 'location', label: 'Location' },
  { key: 'status', label: 'Status' },
];

// List/tiles choice is a per-browser preference shared by every job page.
// Storage can throw (private mode, blocked site data) - fall back to the list.
const VIEW_KEY = 'jobpilot.jobView';
function loadView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'tiles' ? 'tiles' : 'list';
  } catch {
    return 'list';
  }
}
function saveView(view) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {}
}

function scoreClass(score) {
  return score >= 75 ? 'high' : score >= 55 ? 'mid' : 'low';
}

// Opens the drawer on click or Enter/Space, for both table rows and tiles.
function selectable(job, onSelect) {
  return {
    tabIndex: 0,
    'aria-label': `${job.role} at ${job.company}, open details`,
    onClick: () => onSelect(job),
    onKeyDown: (e) => {
      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onSelect(job);
      }
    },
  };
}

function JobActions({ job, onApprove, onReject, onManualStatus }) {
  return (
    <div className="row-actions" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button className="small" onClick={() => window.open(job.url, '_blank', 'noopener,noreferrer')} aria-label={`Open ${job.role} on Naukri`}>
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
        <button className="small" onClick={() => onManualStatus(job.id, 'applied')} title="Already applied by hand outside the bot? Flag it here.">
          Mark applied
        </button>
      )}
    </div>
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
  // Starts as 'list' on the server render; the saved choice is applied after mount.
  const [view, setView] = useState('list');
  useEffect(() => setView(loadView()), []);

  function changeView(next) {
    setView(next);
    saveView(next);
  }

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

        {jobs.length > 0 && (
          <div className="job-table-controls">
            {showStatusFilter && (
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
            <div className="view-bar">
              {/* Shown in both layouts; in the list it stays in sync with the column headers. */}
              <div className="sort-select">
                <label htmlFor="job-sort" className="muted">
                  Sort by
                </label>
                <span className="select-wrap">
                  <select id="job-sort" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevronDown" size="sm" />
                </span>
                <button
                  type="button"
                  className="small"
                  onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  aria-label={sortDir === 'asc' ? 'Ascending, switch to descending' : 'Descending, switch to ascending'}
                  title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
                >
                  <Icon name={sortDir === 'asc' ? 'arrowUp' : 'arrowDown'} size="sm" />
                </button>
              </div>
              <div className="view-toggle" role="group" aria-label="Layout">
                <button type="button" className={view === 'list' ? 'active' : ''} aria-pressed={view === 'list'} onClick={() => changeView('list')}>
                  <Icon name="list" size="sm" /> List
                </button>
                <button type="button" className={view === 'tiles' ? 'active' : ''} aria-pressed={view === 'tiles'} onClick={() => changeView('tiles')}>
                  <Icon name="grid" size="sm" /> Tiles
                </button>
              </div>
            </div>
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
      ) : view === 'tiles' ? (
        <div className="table-scroll">
          <ul className="job-tiles">
            {filtered.map((job) => (
              <li key={job.id} className="job-tile" {...selectable(job, onSelect)}>
                <div className="job-tile-top">
                  <div className="job-tile-title">
                    <strong title={job.role}>{job.role}</strong>
                    <span title={job.company}>{job.company}</span>
                  </div>
                  <span className={`score-pill ${scoreClass(job.match_score)}`} title="Match score">
                    {job.match_score}
                  </span>
                </div>
                <div className="job-tile-meta">
                  <StatusBadge status={job.status} />
                  <span className="muted ellipsis" title={job.location || ''}>
                    {job.location || '—'}
                  </span>
                </div>
                {job.reason && (
                  <p className="job-tile-reason" title={job.reason}>
                    {job.reason}
                  </p>
                )}
                <div className="job-tile-foot">
                  <span className="muted num">{new Date(job.updated_at).toLocaleString()}</span>
                  <JobActions job={job} onApprove={onApprove} onReject={onReject} onManualStatus={onManualStatus} />
                </div>
              </li>
            ))}
          </ul>
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
                <tr key={job.id} className="clickable" {...selectable(job, onSelect)}>
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
                    <span className={`score-pill ${scoreClass(job.match_score)}`}>
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
                  <td className="actions-col">
                    <JobActions job={job} onApprove={onApprove} onReject={onReject} onManualStatus={onManualStatus} />
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
