'use client';
import { useEffect, useState } from 'react';
import Icon from './Icon';

const OPTIONS = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'Auto', icon: 'monitor' },
];

function readChoice() {
  try {
    return localStorage.getItem('theme') || 'system';
  } catch {
    return 'system';
  }
}

// Same resolution as the inline script in layout.js, which runs before paint
// so there's no light flash; this keeps it in sync after the user changes it.
function applyTheme(choice) {
  const dark = choice === 'dark' || (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const root = document.documentElement;
  root.classList.add('theme-switching');
  root.dataset.theme = dark ? 'dark' : 'light';
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
}

export default function ThemeToggle() {
  const [choice, setChoice] = useState('system');

  useEffect(() => {
    setChoice(readChoice());
  }, []);

  useEffect(() => {
    applyTheme(choice);
    if (choice !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [choice]);

  function choose(value) {
    setChoice(value);
    try {
      localStorage.setItem('theme', value);
    } catch {
      /* private mode - still applies for this session */
    }
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Color theme">
      {OPTIONS.map((o) => (
        <button key={o.value} type="button" aria-pressed={choice === o.value} onClick={() => choose(o.value)} title={`${o.label} theme`}>
          <Icon name={o.icon} size="sm" />
          {o.label}
        </button>
      ))}
    </div>
  );
}
