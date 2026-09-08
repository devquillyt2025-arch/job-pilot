'use client';

const LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  applying: 'Applying…',
  applied: 'Applied',
  rejected: 'Rejected',
  skipped_external: 'External',
  needs_review: 'Needs Review',
  failed: 'Failed',
};

export default function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{LABELS[status] || status}</span>;
}
