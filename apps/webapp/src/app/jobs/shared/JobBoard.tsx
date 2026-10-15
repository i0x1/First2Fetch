'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { updateJobReview } from '@/app/actions';
import { Job } from '@first2apply/core';

type JobBoardProps = {
  jobs: Job[];
};

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function formatRelative(value: string | Date) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

function siteCode(job: Job) {
  return `S${job.siteId}`.slice(0, 3).toUpperCase();
}

export function JobBoard({ jobs }: JobBoardProps) {
  const [selectedId, setSelectedId] = useState<number | null>(jobs[0]?.id ?? null);
  const selected = jobs.find((job) => job.id === selectedId) ?? jobs[0];

  useEffect(() => {
    if (!selected || !jobs.some((job) => job.id === selected.id)) setSelectedId(jobs[0]?.id ?? null);
  }, [jobs, selected]);

  const selectedIndex = selected ? jobs.findIndex((job) => job.id === selected.id) : -1;
  const groupedJobs = useMemo(() => {
    const groups = new Map<string, Job[]>();
    for (const job of jobs) {
      const key = new Date(job.created_at).toDateString();
      groups.set(key, [...(groups.get(key) ?? []), job]);
    }
    return [...groups.entries()];
  }, [jobs]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'ArrowDown' && selectedIndex < jobs.length - 1) setSelectedId(jobs[selectedIndex + 1].id);
      if (event.key === 'ArrowUp' && selectedIndex > 0) setSelectedId(jobs[selectedIndex - 1].id);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [jobs, selectedIndex]);

  if (!selected) return <div className="job-board-empty">No jobs found.</div>;

  return (
    <div className="job-board">
      <div className="job-board-list card">
        <div className="job-table-scroll">
          <table className="job-table">
            <thead>
              <tr><th aria-label="Board" /><th>Job / company</th><th>Location</th><th>Found</th><th>Posted</th><th>Search</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {groupedJobs.map(([date, dateJobs]) => (
                <Fragment key={date}>
                  <tr className="job-date-row"><th colSpan={7}>{date} · {dateJobs.length} {dateJobs.length === 1 ? 'job' : 'jobs'}</th></tr>
                  {dateJobs.map((job) => (
                    <tr key={job.id} className={job.id === selected.id ? 'selected' : ''} onClick={() => setSelectedId(job.id)}>
                      <td><span className="job-site-code">{siteCode(job)}</span></td>
                      <td><strong>{job.title}</strong><small>{job.companyName}</small></td>
                      <td>{job.location || '—'}</td>
                      <td>{formatRelative(job.created_at)}</td>
                      <td>{job.posted_at_raw || '—'}</td>
                      <td className="job-row-actions">
                        {job.status !== 'applied' && <ReviewIcon jobId={job.id} status="applied" label="Mark applied" symbol="✓" />}
                        {job.status !== 'archived' && <ReviewIcon jobId={job.id} status="archived" label="Archive" symbol="▱" />}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="job-board-detail card">
        <div className="job-detail-heading">
          <span className="job-site-code large">{siteCode(selected)}</span>
          <div><h2>{selected.title}</h2><p>{selected.companyName} · {selected.location || 'Location not listed'}</p></div>
        </div>
        <div className="job-detail-meta">
          <span>found <strong>{formatRelative(selected.created_at)}</strong></span>
          <span>posted <strong>{selected.posted_at_raw || formatDate(selected.created_at)}</strong></span>
          <span>status <strong>{selected.status}</strong></span>
        </div>
        <div className="job-detail-actions">
          <a className="button primary" href={selected.externalUrl} target="_blank" rel="noreferrer">Open application</a>
          {selected.status !== 'applied' && <ReviewButton jobId={selected.id} status="applied" label="Applied" />}
          {selected.status !== 'new' && <ReviewButton jobId={selected.id} status="new" label="Move to new" />}
          {selected.status !== 'archived' && <ReviewButton jobId={selected.id} status="archived" label="Archive" />}
          <button className="button" type="button" onClick={() => navigator.clipboard.writeText(selected.externalUrl)}>Copy URL</button>
        </div>
        <div className="job-description">
          {selected.description ? (
            <Markdown remarkPlugins={[remarkGfm]}>
              {selected.description}
            </Markdown>
          ) : 'The job description is not available yet.'}
        </div>
        <Link className="job-detail-link" href={`/jobs/${selected.id}`}>Open full details and activity →</Link>
      </aside>
    </div>
  );
}

function ReviewButton({ jobId, status, label }: { jobId: number; status: 'new' | 'applied' | 'archived'; label: string }) {
  return <form action={updateJobReview}><input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="status" value={status} /><button className="button" type="submit">{label}</button></form>;
}

function ReviewIcon({ jobId, status, label, symbol }: { jobId: number; status: 'applied' | 'archived'; label: string; symbol: string }) {
  return <form action={updateJobReview} onClick={(event) => event.stopPropagation()}><input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="status" value={status} /><button className="icon-button" type="submit" title={label} aria-label={label}>{symbol}</button></form>;
}
