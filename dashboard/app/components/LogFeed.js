'use client';
import { useEffect, useRef } from 'react';

export default function LogFeed({ lines }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  return (
    <div className="card">
      <h2>Activity</h2>
      <div className="log-feed" ref={ref}>
        {lines.length === 0 && <div>Waiting for a run…</div>}
        {lines.map((l, i) => (
          <div key={i} className={l.level === 'error' ? 'err' : ''}>
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}
