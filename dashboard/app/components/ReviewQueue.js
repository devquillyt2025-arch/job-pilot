'use client';
import { useState } from 'react';
import { api } from '../lib/api';

function AnswerForm({ job, onDone }) {
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    if (!answer.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.resolveQuestion(job.id, answer.trim());
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="actions">
      <input
        type="text"
        placeholder="Your real answer (saved to qa-bank.json for future jobs too)"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <button className="primary small" onClick={submit} disabled={saving || !answer.trim()}>
        {saving ? 'Saving…' : 'Save answer & retry next run'}
      </button>
      {error && <span style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</span>}
    </div>
  );
}

function SelectorForm({ job, onDone }) {
  const [selectorPath, setSelectorPath] = useState('chatbot.questionText');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    if (!value.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.resolveSelector(job.id, selectorPath, value.trim());
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="actions">
      <select value={selectorPath} onChange={(e) => setSelectorPath(e.target.value)}>
        <option value="chatbot.container">chatbot.container</option>
        <option value="chatbot.questionText">chatbot.questionText</option>
        <option value="chatbot.optionButtons">chatbot.optionButtons</option>
        <option value="chatbot.textInput">chatbot.textInput</option>
        <option value="chatbot.submitButton">chatbot.submitButton</option>
        <option value="detail.naukriApplyButton">detail.naukriApplyButton</option>
        <option value="detail.externalApplyButton">detail.externalApplyButton</option>
      </select>
      <input
        type="text"
        placeholder="new CSS selector, based on the captured HTML"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <button className="primary small" onClick={submit} disabled={saving || !value.trim()}>
        {saving ? 'Saving…' : 'Patch selector & retry next run'}
      </button>
      {error && <span style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</span>}
    </div>
  );
}

function ReviewItem({ job, onDone, onManualStatus }) {
  return (
    <div className="review-item">
      <div className="top">
        <div>
          <div className="role">
            {job.role} — {job.company}
          </div>
          <div className="meta">
            score {job.match_score} · {job.location}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={job.url} target="_blank" rel="noreferrer" className="meta">
            open on Naukri ↗
          </a>
        </div>
      </div>

      {job.question && <div className="question">"{job.question}"</div>}
      {job.reason && !job.question && <div className="meta">{job.reason}</div>}

      {job.screenshot_path && (
        <div className="meta">
          <a href={api.captureUrl(job.screenshot_path.split(/[\\/]/).pop())} target="_blank" rel="noreferrer">
            view captured screenshot ↗
          </a>
          {job.html_path && (
            <>
              {' · '}
              <a href={api.captureUrl(job.html_path.split(/[\\/]/).pop())} target="_blank" rel="noreferrer">
                view captured HTML ↗
              </a>
            </>
          )}
        </div>
      )}

      {job.subtype === 'unanswered_question' && <AnswerForm job={job} onDone={onDone} />}
      {job.subtype === 'selector_miss' && <SelectorForm job={job} onDone={onDone} />}
      {(!job.subtype || job.subtype === 'unconfirmed_outcome') && (
        <div className="actions">
          <button className="small primary" onClick={() => onManualStatus(job.id, 'applied')}>
            Mark applied
          </button>
          <button className="small" onClick={() => onManualStatus(job.id, 'skipped_external')}>
            Mark external
          </button>
          <button className="small" onClick={() => onManualStatus(job.id, 'rejected')}>
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

export default function ReviewQueue({ jobs, onRefresh }) {
  const items = jobs.filter((j) => j.status === 'needs_review');

  async function onManualStatus(id, status) {
    await api.patchJob(id, { status });
    onRefresh();
  }

  return (
    <div className="card">
      <div className="section-title-row">
        <h2>Review queue ({items.length})</h2>
      </div>
      {items.length === 0 ? (
        <div className="empty">Nothing needs your attention right now.</div>
      ) : (
        items.map((job) => <ReviewItem key={job.id} job={job} onDone={onRefresh} onManualStatus={onManualStatus} />)
      )}
    </div>
  );
}
