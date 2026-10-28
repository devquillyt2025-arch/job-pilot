'use client';
import Icon from './Icon';

export default function RunControl({ connected, running, onStart, onStop, starting, onRecheck, rechecking }) {
  return (
    <div className="controls">
      <span className="conn" role="status">
        <span className={`dot ${connected ? 'on' : 'off'}`} />
        {connected ? 'Connected' : 'Reconnecting…'}
      </span>
      {running ? (
        <button className="danger" onClick={onStop}>
          <Icon name="stop" size="sm" />
          Stop
        </button>
      ) : (
        <>
          <button
            onClick={onRecheck}
            disabled={rechecking || !connected}
            title="Revisit non-final jobs on Naukri to catch ones applied to manually"
          >
            <Icon name="refresh" size="sm" />
            {rechecking ? 'Rechecking…' : 'Recheck status'}
          </button>
          <button className="primary" onClick={onStart} disabled={starting || !connected}>
            <Icon name="play" size="sm" />
            {starting ? 'Starting…' : 'Run'}
          </button>
        </>
      )}
    </div>
  );
}
