'use client';

export default function RunControl({ connected, running, onStart, onStop, starting }) {
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
        <button className="primary" onClick={onStart} disabled={starting || !connected}>
          {starting ? 'Starting…' : 'Run'}
        </button>
      )}
    </div>
  );
}
