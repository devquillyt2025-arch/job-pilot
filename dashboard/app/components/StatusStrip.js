'use client';

function formatElapsed(startedAt, now) {
  if (!startedAt) return '—';
  const secs = Math.max(0, Math.floor((now - startedAt) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

export default function StatusStrip({ running, phase, currentJob, progress, startedAt, now }) {
  if (!running) {
    return (
      <div className="card">
        <div className="empty">Idle. Click Run to search for new matches and apply to any approved jobs.</div>
      </div>
    );
  }

  const pct = progress && progress.total ? Math.round((progress.index / progress.total) * 100) : 0;

  return (
    <div className="card">
      <div className="status-strip">
        <div className="item">
          Phase: <strong>{phase || 'starting'}</strong>
        </div>
        {currentJob && (
          <div className="item">
            Current: <strong>{currentJob.role}</strong> — {currentJob.company}
          </div>
        )}
        {progress && progress.total > 0 && (
          <>
            <div className="item">
              <strong>
                {progress.index}/{progress.total}
              </strong>
            </div>
            <div className="progress-bar">
              <div style={{ width: `${pct}%` }} />
            </div>
            <div className="item">
              <strong>{pct}%</strong>
            </div>
          </>
        )}
        <div className="item push">
          Elapsed: <strong>{formatElapsed(startedAt, now)}</strong>
        </div>
      </div>
    </div>
  );
}
