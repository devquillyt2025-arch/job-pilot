'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './lib/api';
import { useDashboardSocket } from './lib/useDashboardSocket';
import RunControl from './components/RunControl';
import StatusStrip from './components/StatusStrip';
import StatsPanel from './components/StatsPanel';
import ReviewQueue from './components/ReviewQueue';
import JobTable from './components/JobTable';
import RunHistory from './components/RunHistory';
import DetailDrawer from './components/DetailDrawer';
import LogFeed from './components/LogFeed';

function upsertJob(jobs, job) {
  const idx = jobs.findIndex((j) => j.id === job.id);
  if (idx === -1) return [job, ...jobs];
  const copy = jobs.slice();
  copy[idx] = job;
  return copy;
}

export default function Page() {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [runs, setRuns] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [runFilter, setRunFilter] = useState(null);

  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
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
    const [jobsRes, statsRes, runsRes] = await Promise.all([api.jobs(), api.stats(), api.runs()]);
    setJobs(jobsRes);
    setStats(statsRes);
    setRuns(runsRes);
  }, []);

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
          setStartedAt(Date.now());
          setLog([]);
          pushLog('Run started');
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

  async function handleStart() {
    setStarting(true);
    try {
      await api.startRun();
    } catch (err) {
      pushLog(`Failed to start: ${err.message}`, 'error');
      setStarting(false);
    }
  }

  async function handleStop() {
    try {
      await api.stopRun();
    } catch (err) {
      pushLog(`Failed to stop: ${err.message}`, 'error');
    }
  }

  async function handleApprove(id) {
    const job = await api.patchJob(id, { status: 'approved' });
    setJobs((j) => upsertJob(j, job));
    api.stats().then(setStats);
  }

  async function handleReject(id) {
    const job = await api.patchJob(id, { status: 'rejected' });
    setJobs((j) => upsertJob(j, job));
    api.stats().then(setStats);
  }

  const visibleJobs = runFilter ? jobs.filter((j) => j.found_in_run === runFilter || j.applied_in_run === runFilter) : jobs;

  return (
    <div className="app">
      <div className="header">
        <div>
          <h1>Auto-Job — Naukri Dashboard</h1>
          <div className="sub">Finds matching jobs and applies to the ones you approve. Nothing applies without your review first.</div>
        </div>
        <RunControl connected={connected} running={running} starting={starting} onStart={handleStart} onStop={handleStop} />
      </div>

      <StatusStrip running={running} phase={phase} currentJob={currentJob} progress={progress} startedAt={startedAt} now={now} />
      <LogFeed lines={log} />
      <StatsPanel stats={stats} />
      <ReviewQueue jobs={jobs} onRefresh={refreshAll} />

      {runFilter && (
        <div className="card" style={{ padding: '10px 18px' }}>
          Filtering to run <strong>{runFilter}</strong>.{' '}
          <button className="small" onClick={() => setRunFilter(null)}>
            clear filter
          </button>
        </div>
      )}
      <JobTable jobs={visibleJobs} onSelect={setSelectedJob} onApprove={handleApprove} onReject={handleReject} />
      <RunHistory runs={runs} onViewJobs={setRunFilter} />

      <DetailDrawer job={selectedJob} onClose={() => setSelectedJob(null)} />
    </div>
  );
}
