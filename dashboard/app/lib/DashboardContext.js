'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { useDashboardSocket } from './useDashboardSocket';

// Lives in the root layout so the WebSocket, live log and job list survive
// navigating between pages instead of resetting on every route change.
const DashboardContext = createContext(null);

function upsertJob(jobs, job) {
  const idx = jobs.findIndex((j) => j.id === job.id);
  if (idx === -1) return [job, ...jobs];
  const copy = jobs.slice();
  copy[idx] = job;
  return copy;
}

export function DashboardProvider({ children }) {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [runs, setRuns] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);

  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [phase, setPhase] = useState(null);
  const [currentJob, setCurrentJob] = useState(null);
  const [progress, setProgress] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [log, setLog] = useState([]);

  const logIdRef = useRef(0);
  const pushLog = useCallback((text, level) => {
    logIdRef.current += 1;
    setLog((l) => [...l.slice(-300), { id: logIdRef.current, text: `${new Date().toLocaleTimeString()}  ${text}`, level }]);
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      const [jobsRes, statsRes, runsRes] = await Promise.all([api.jobs(), api.stats(), api.runs()]);
      setJobs(jobsRes);
      setStats(statsRes);
      setRuns(runsRes);
    } catch (err) {
      pushLog(`Failed to load data: ${err.message}`, 'error');
    }
  }, [pushLog]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  const handleEvent = useCallback(
    (event) => {
      switch (event.type) {
        case 'connected':
          setRunning(event.running);
          break;
        case 'run_process_started':
          setRunning(true);
          setStarting(false);
          setRechecking(false);
          setStartedAt(Date.now());
          setLog([]);
          pushLog(event.kind === 'recheck' ? 'Recheck started' : 'Run started');
          break;
        case 'phase':
          setPhase(event.phase);
          setProgress(event.total ? { index: 0, total: event.total } : null);
          pushLog(`Phase: ${event.phase}`);
          break;
        case 'search_query_started':
          setProgress({ index: event.index, total: event.total });
          pushLog(`Searching "${event.keywords}" in ${event.location || 'anywhere'} (${event.index}/${event.total})`);
          break;
        case 'search_page':
          pushLog(`  page ${event.page}: ${event.count} listings`);
          break;
        case 'job_found':
          setJobs((j) => upsertJob(j, event.job));
          pushLog(`Found: ${event.job.role} — ${event.job.company} (score ${event.job.match_score})`);
          break;
        case 'job_skipped_duplicate':
          pushLog(`Skipping duplicate: ${event.title}`);
          break;
        case 'search_finished':
          pushLog(
            `Search done: ${event.scanned} scanned, ${event.added} added, ${event.excluded} excluded, ${event.belowThreshold} below threshold, ${event.skipped_duplicate} duplicates`
          );
          api.stats().then(setStats);
          break;
        case 'job_progress':
          setCurrentJob(event.job);
          setProgress({ index: event.index, total: event.total });
          pushLog(`Applying (${event.index}/${event.total}): ${event.job.role} — ${event.job.company}`);
          break;
        case 'job_result':
          setJobs((j) => upsertJob(j, event.job));
          pushLog(`Result: ${event.job.role} → ${event.job.status}${event.job.reason ? ` (${event.job.reason})` : ''}`);
          break;
        case 'apply_finished':
          pushLog(`Apply done: ${JSON.stringify(event.counts)}`);
          break;
        case 'recheck_progress':
          setCurrentJob(event.job);
          setProgress({ index: event.index, total: event.total });
          pushLog(`Rechecking (${event.index}/${event.total}): ${event.job.role} — ${event.job.company}`);
          break;
        case 'recheck_result':
          setJobs((j) => upsertJob(j, event.job));
          pushLog(`Recheck: ${event.job.role} → ${event.outcome}${event.reason ? ` (${event.reason})` : ''}`);
          break;
        case 'recheck_finished':
          pushLog(`Recheck done: ${JSON.stringify(event.counts)}`);
          refreshAll();
          break;
        case 'run_finished':
          pushLog('Run finished');
          refreshAll();
          break;
        case 'run_process_exited':
          setRunning(false);
          setCurrentJob(null);
          setProgress(null);
          setStartedAt(null);
          break;
        case 'error':
          pushLog(`Error: ${event.message}`, 'error');
          break;
        case 'log':
          pushLog(event.message, event.level);
          break;
        default:
          break;
      }
    },
    [pushLog, refreshAll]
  );

  const { connected } = useDashboardSocket(handleEvent);

  async function startRun() {
    setStarting(true);
    try {
      await api.startRun();
    } catch (err) {
      pushLog(`Failed to start: ${err.message}`, 'error');
      setStarting(false);
    }
  }

  async function stopRun() {
    try {
      await api.stopRun();
    } catch (err) {
      pushLog(`Failed to stop: ${err.message}`, 'error');
    }
  }

  async function startRecheck() {
    setRechecking(true);
    try {
      await api.startRecheck();
    } catch (err) {
      pushLog(`Failed to start recheck: ${err.message}`, 'error');
      setRechecking(false);
    }
  }

  async function setJobStatus(id, status) {
    try {
      const job = await api.patchJob(id, { status });
      setJobs((j) => upsertJob(j, job));
      api.stats().then(setStats, () => {});
    } catch (err) {
      pushLog(`Failed to set ${id} to ${status}: ${err.message}`, 'error');
    }
  }

  const value = {
    jobs,
    stats,
    runs,
    log,
    selectedJob,
    setSelectedJob,
    connected,
    running,
    starting,
    rechecking,
    phase,
    currentJob,
    progress,
    startedAt,
    now,
    refreshAll,
    startRun,
    stopRun,
    startRecheck,
    approve: (id) => setJobStatus(id, 'approved'),
    reject: (id) => setJobStatus(id, 'rejected'),
    setJobStatus,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  return useContext(DashboardContext);
}
