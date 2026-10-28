'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDashboard } from '../lib/DashboardContext';
import Icon from './Icon';
import ThemeToggle from './ThemeToggle';

export default function Sidebar() {
  const pathname = usePathname();
  const { jobs, runs, running, connected } = useDashboard();

  const count = (status) => jobs.filter((j) => j.status === status).length;

  const groups = [
    {
      label: 'Workflow',
      tabs: [
        { href: '/', label: 'Overview', icon: 'dashboard' },
        { href: '/pending', label: 'Pending approval', icon: 'clock', badge: count('pending') },
        { href: '/review', label: 'Needs review', icon: 'alert', badge: count('needs_review'), alert: true },
        { href: '/jobs', label: 'All jobs', icon: 'list', badge: jobs.length, muted: true },
        { href: '/applied', label: 'Applied', icon: 'check', badge: count('applied'), muted: true },
      ],
    },
    {
      label: 'Insights',
      tabs: [
        { href: '/analytics', label: 'Analytics', icon: 'chart' },
        { href: '/activity', label: 'Live activity', icon: 'activity', dot: running },
        { href: '/runs', label: 'Run history', icon: 'history', badge: runs.length, muted: true },
        { href: '/filters', label: 'Search filters', icon: 'sliders' },
      ],
    },
  ];

  return (
    <nav className="sidebar" aria-label="Main">
      <div className="sidebar-brand">
        <div className="brand-mark" aria-hidden="true">
          <Icon name="plane" />
        </div>
        <div>
          <div className="brand-title">Job Pilot</div>
          <div className="brand-sub">
            <span className={`dot ${connected ? 'on' : 'off'}`} />
            {connected ? (running ? 'Run in progress' : 'Connected') : 'Reconnecting…'}
          </div>
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.label}>
          <div className="sidebar-section-label">{g.label}</div>
          <ul className="sidebar-tabs">
            {g.tabs.map((t) => {
              const active = t.href === '/' ? pathname === '/' : pathname.startsWith(t.href);
              return (
                <li key={t.href}>
                  <Link href={t.href} className={`sidebar-tab${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
                    <Icon name={t.icon} />
                    <span className="tab-label">{t.label}</span>
                    {t.dot && <span className="dot on live" aria-label="running" />}
                    {t.badge > 0 && (
                      <span className={`tab-badge${t.alert ? ' alert' : ''}${t.muted ? ' muted' : ''}`}>{t.badge}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="sidebar-footer">
        <ThemeToggle />
      </div>
    </nav>
  );
}
