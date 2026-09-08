'use client';
import { useEffect, useRef, useState } from 'react';

// Connects once on mount and reconnects on drop; always calls the latest
// handler via a ref so callers can pass an inline function without causing
// reconnect churn.
export function useDashboardSocket(onEvent) {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    let ws;
    let retryTimer;
    let tornDown = false;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!tornDown) retryTimer = setTimeout(connect, 2000);
      };
      ws.onerror = () => {};
      ws.onmessage = (event) => {
        try {
          handlerRef.current(JSON.parse(event.data));
        } catch {
          /* ignore malformed frame */
        }
      };
    }

    connect();
    return () => {
      tornDown = true;
      clearTimeout(retryTimer);
      if (ws) ws.close();
    };
  }, []);

  return { connected };
}
