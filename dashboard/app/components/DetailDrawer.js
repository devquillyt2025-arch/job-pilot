'use client';
import StatusBadge from './StatusBadge';
import { api } from '../lib/api';

export default function DetailDrawer({ job, onClose }) {
  if (!job) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <button className="small" onClick={onClose} style={{ float: 'right' }}>
          Close
        </button>
        <h3>
          {job.role} — {job.company}
        </h3>
        <StatusBadge status={job.status} />

        <dl className="kv">
          <dt>Score</dt>
          <dd>{job.match_score}</dd>
          <dt>Location</dt>
          <dd>{job.location}</dd>
          <dt>Experience</dt>
          <dd>{job.experience}</dd>
          <dt>Posted</dt>
          <dd>{job.postedDay}</dd>
          <dt>Skills</dt>
          <dd>{(job.skills || []).join(', ')}</dd>
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
              open on Naukri ↗
            </a>
          </dd>
        </dl>

        {job.response_snapshot && job.response_snapshot.length > 0 && (
          <>
            <h4>Network response snapshot</h4>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, background: 'var(--neutral-bg)', padding: 8, borderRadius: 6 }}>
              {JSON.stringify(job.response_snapshot, null, 2)}
            </pre>
          </>
        )}

        {job.screenshot_path && (
          <>
            <h4>Captured screenshot</h4>
            <img src={api.captureUrl(job.screenshot_path.split(/[\\/]/).pop())} alt="captured state" />
          </>
        )}
      </div>
    </div>
  );
}
