async function request(url, options) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `${res.status} ${res.statusText}`);
  return body;
}

export const api = {
  jobs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/jobs${qs ? `?${qs}` : ''}`);
  },
  patchJob: (id, patch) => request(`/api/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  resolveQuestion: (id, answer) =>
    request(`/api/jobs/${id}/resolve-question`, { method: 'POST', body: JSON.stringify({ answer }) }),
  resolveSelector: (id, path, value) =>
    request(`/api/jobs/${id}/resolve-selector`, { method: 'POST', body: JSON.stringify({ path, value }) }),
  stats: () => request('/api/stats'),
  runs: () => request('/api/runs'),
  runStatus: () => request('/api/run-status'),
  startRun: () => request('/api/run', { method: 'POST' }),
  startRecheck: (ids) => request('/api/recheck', { method: 'POST', body: JSON.stringify({ ids }) }),
  stopRun: () => request('/api/stop', { method: 'POST' }),
  captureUrl: (file) => `/api/capture?file=${encodeURIComponent(file)}`,
};
