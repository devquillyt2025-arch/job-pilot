'use client';

export default function RunControl({ connected, running, onStart, onStop, starting, onRecheck, rechecking }) {
  return (
    <div className="controls">
      <span className="status-strip">
        <span className="item">
          <span className={`dot ${connected ? 'on' : 'off'}`} />
          {connected ? 'connected' : 'reconnecting…'}
        </span>
      </span>
      {running ? (
        <button className="danger" onClick={onStop}>
          Stop
        </button>
      ) : (
        <>
          <button className="primary" onClick={onStart} disabled={starting || !connected}>
            {starting ? 'Starting…' : 'Run'}
          </button>
          <button
            onClick={onRecheck}
            disabled={rechecking || !connected}
            title="Revisit non-final jobs on Naukri to catch ones applied to manually"
          >
            {rechecking ? 'Rechecking…' : 'Recheck status'}
          </button>
        </>
      )}
    </div>
  );
}
