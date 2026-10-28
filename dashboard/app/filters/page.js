'use client';
import PageLayout from '../components/PageLayout';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

function Chips({ items }) {
  if (!items || items.length === 0) return <span className="muted">none</span>;
  return (
    <div className="chips">
      {items.map((x) => (
        <span key={x} className="chip">
          {x}
        </span>
      ))}
    </div>
  );
}

export default function FiltersPage() {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.profile().then(setProfile).catch((err) => setError(err.message));
  }, []);

  return (
    <PageLayout title="Search filters" sub={<>Read-only view of <code>config/profile.json</code>. Edit that file to change what the next run searches for.</>}>
      {error && (
        <div className="card" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      )}
      {profile && (
        <>
          <div className="card">
            <h2>Searches ({profile.searchQueries?.length || 0})</h2>
            <table>
              <thead>
                <tr>
                  <th>Role / keywords</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {(profile.searchQueries || []).map((q, i) => (
                  <tr key={i}>
                    <td>{q.keywords}</td>
                    <td>{q.location || 'anywhere'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h2>Filters</h2>
            <dl className="kv">
              <dt>Work mode</dt>
              <dd>
                <Chips items={profile.workModes} />
              </dd>
              <dt>Allowed locations</dt>
              <dd>
                <Chips items={profile.allowedLocations} />
              </dd>
              <dt>Min salary</dt>
              <dd>{profile.minSalaryLakhs ? `${profile.minSalaryLakhs} LPA` : 'any'}</dd>
              <dt>Experience</dt>
              <dd>{profile.experienceYears ?? '—'} years</dd>
              <dt>Min match score</dt>
              <dd>{profile.minMatchScore ?? 0}</dd>
              <dt>Pages per search</dt>
              <dd>{profile.maxPagesPerQuery ?? 1}</dd>
              <dt>Must-have skills</dt>
              <dd>
                <Chips items={profile.mustHaveSkills} />
              </dd>
              <dt>Nice-to-have</dt>
              <dd>
                <Chips items={profile.niceToHaveSkills} />
              </dd>
              <dt>Excluded words</dt>
              <dd>
                <Chips items={profile.excludeKeywords} />
              </dd>
              <dt>Excluded companies</dt>
              <dd>
                <Chips items={profile.excludeCompanies} />
              </dd>
            </dl>
          </div>
        </>
      )}
    </PageLayout>
  );
}
