'use client';
import { useEffect, useRef } from 'react';
import StatusBadge from './StatusBadge';
import Icon from './Icon';
import { api } from '../lib/api';

export default function DetailDrawer({ job, onClose }) {
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const openId = job ? job.id : null;

  // Escape closes; focus moves into the dialog and returns to whatever opened
  // it. Keyed on the job id, not the callback, so the dashboard's frequent
  // re-renders don't keep yanking focus back to the close button.
  useEffect(() => {
    if (!openId) return;
    const opener = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (opener && opener.focus) opener.focus();
    };
  }, [openId]);

  if (!job) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <h3 id="drawer-title">
              {job.role} — {job.company}
            </h3>
            <StatusBadge status={job.status} />
          </div>
          <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Close details">
            <Icon name="x" />
          </button>
        </div>

        <dl className="kv">
          <dt>Score</dt>
          <dd className="num">{job.match_score}</dd>
          <dt>Location</dt>
          <dd>{job.location || '—'}</dd>
          <dt>Experience</dt>
          <dd>{job.experience || '—'}</dd>
          <dt>Salary</dt>
          <dd>{job.salary || '—'}</dd>
          <dt>Posted</dt>
          <dd>{job.postedDay || '—'}</dd>
          <dt>Skills</dt>
          <dd>{(job.skills || []).join(', ') || '—'}</dd>
          <dt>Matched (must)</dt>
          <dd>{(job.matchedMustHave || []).join(', ') || '—'}</dd>
          <dt>Matched (nice)</dt>
          <dd>{(job.matchedNiceToHave || []).join(', ') || '—'}</dd>
          <dt>Reason</dt>
          <dd>{job.reason || '—'}</dd>
          {job.question && (
            <>
              <dt>Question</dt>
              <dd>{job.question}</dd>
            </>
          )}
          <dt>Found</dt>
          <dd>{new Date(job.created_at).toLocaleString()}</dd>
          <dt>Updated</dt>
          <dd>{new Date(job.updated_at).toLocaleString()}</dd>
          <dt>Link</dt>
          <dd>
            <a href={job.url} target="_blank" rel="noreferrer">
              Open on Naukri <Icon name="external" size="sm" />
            </a>
          </dd>
        </dl>

        {job.response_snapshot && job.response_snapshot.length > 0 && (
          <>
            <h4>Network response snapshot</h4>
            <pre>{JSON.stringify(job.response_snapshot, null, 2)}</pre>
          </>
        )}

        {job.screenshot_path && (
          <>
            <h4>Captured screenshot</h4>
            <img src={api.captureUrl(job.screenshot_path.split(/[\\/]/).pop())} alt={`Page state captured for ${job.role}`} />
          </>
        )}
      </div>
    </div>
  );
}
