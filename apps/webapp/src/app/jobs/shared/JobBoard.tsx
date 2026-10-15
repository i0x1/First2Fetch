'use client';

import { FormEvent, Fragment, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { createJobNote, listJobEvents, listJobNotes, loadJobsPage, updateJobReview } from '@/app/actions';
import { JOB_LABELS, Job, JobLabel, JobStatus, WorkspaceJobEvent } from '@first2apply/core';

type Counts = { new: number; ready: number; applied: number; archived: number; filtered: number };
type ViewMode = 'list-focus' | 'split' | 'detail-focus';
type Note = { id: number; text: string; created_at: string | Date; actor_email?: string; user_id?: string };

const statuses: Array<{ value: JobStatus; label: string; count: keyof Counts }> = [
  { value: 'new', label: 'New', count: 'new' },
  { value: 'ready', label: 'Ready', count: 'ready' },
  { value: 'applied', label: 'Applied', count: 'applied' },
  { value: 'archived', label: 'Archived', count: 'archived' },
  { value: 'excluded_by_advanced_matching', label: 'Skipped', count: 'filtered' },
];

function dateValue(value: string | Date) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function relativeTime(value: string | Date) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
  return days === 0 ? 'today' : `${days}d`;
}

function siteCode(job: Job) {
  return `S${job.siteId}`.slice(0, 3).toUpperCase();
}

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function JobBoard({ jobs, nextCursor: initialNextCursor, status, search, counts, searches }: { jobs: Job[]; nextCursor?: string; status: JobStatus; search: string; counts: Counts; searches: Array<{ id: number; title: string }> }) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedId, setSelectedId] = useState<number | null>(jobs[0]?.id ?? null);
  const [loadedJobs, setLoadedJobs] = useState(jobs);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [viewMode, setViewMode] = useState<ViewMode>('list-focus');
  const [query, setQuery] = useState(search);
  const [showFilters, setShowFilters] = useState(false);
  const [hideReposted, setHideReposted] = useState(false);
  const [siteFilter, setSiteFilter] = useState('');
  const [linkFilter, setLinkFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const [pending, startTransition] = useTransition();
  const searchTitles = useMemo(() => new Map(searches.map((item) => [item.id, item.title])), [searches]);

  useEffect(() => {
    setLoadedJobs(jobs);
    setNextCursor(initialNextCursor);
    setSelectedId(jobs[0]?.id ?? null);
  }, [jobs, initialNextCursor]);

  useEffect(() => {
    const stored = window.localStorage.getItem('first2apply-web-view-mode');
    if (stored === 'list-focus' || stored === 'split' || stored === 'detail-focus') setViewMode(stored);
  }, []);

  const setMode = (mode: ViewMode) => {
    setViewMode(mode);
    window.localStorage.setItem('first2apply-web-view-mode', mode);
  };

  const filteredJobs = useMemo(() => loadedJobs.filter((job) => {
    if (hideReposted && job.is_repost) return false;
    if (siteFilter && job.siteId !== Number(siteFilter)) return false;
    if (linkFilter && job.link_id !== Number(linkFilter)) return false;
    if (labelFilter && !(job.labels ?? []).includes(labelFilter as JobLabel)) return false;
    return true;
  }), [loadedJobs, hideReposted, siteFilter, linkFilter, labelFilter]);

  const selected = filteredJobs.find((job) => job.id === selectedId) ?? filteredJobs[0];
  const groupedJobs = useMemo(() => {
    const groups = new Map<string, Job[]>();
    filteredJobs.forEach((job) => {
      const key = dateValue(job.created_at);
      groups.set(key, [...(groups.get(key) ?? []), job]);
    });
    return [...groups.entries()];
  }, [filteredJobs]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || !selected) return;
      const index = filteredJobs.findIndex((job) => job.id === selected.id);
      if (event.key === 'ArrowDown' && index < filteredJobs.length - 1) { event.preventDefault(); setSelectedId(filteredJobs[index + 1].id); }
      if (event.key === 'ArrowUp' && index > 0) { event.preventDefault(); setSelectedId(filteredJobs[index - 1].id); }
      if (event.key.toLowerCase() === 'a') updateReview(selected.id, 'applied');
      if (event.key.toLowerCase() === 'e') updateReview(selected.id, 'archived');
      if (event.key === 'Enter') window.open(selected.externalUrl, '_blank', 'noopener,noreferrer');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filteredJobs, selected]);

  const navigateStatus = (nextStatus: JobStatus) => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    const route = nextStatus === 'new' ? 'new' : nextStatus === 'applied' ? 'applied' : nextStatus === 'excluded_by_advanced_matching' ? 'skipped' : 'archived';
    router.push(`/jobs/${route}${params.size ? `?${params}` : ''}`);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    router.push(`${pathname}${params}`);
  };

  const updateReview = (jobId: number, nextStatus?: JobStatus, labels?: JobLabel[]) => {
    const form = new FormData();
    form.set('jobId', String(jobId));
    if (nextStatus) form.set('status', nextStatus);
    if (labels) form.set('labels', labels.join(','));
    startTransition(async () => {
      await updateJobReview(form);
      router.refresh();
    });
  };

  const exportCsv = () => {
    const header = ['Title', 'Company', 'Location', 'Found', 'Posted', 'Status', 'Labels', 'URL'];
    const rows = filteredJobs.map((job) => [job.title, job.companyName, job.location, job.created_at, job.posted_at_raw, job.status, (job.labels ?? []).join(', '), job.externalUrl]);
    const blob = new Blob([[header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `first2fetch-${status}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const loadMore = () => {
    if (!nextCursor) return;
    startTransition(async () => {
      const page = await loadJobsPage(status, nextCursor, search);
      setLoadedJobs((current) => [...current, ...page.jobs.filter((job) => !current.some((loaded) => loaded.id === job.id))]);
      setNextCursor(page.nextCursor);
    });
  };

  const bulkUpdate = (nextStatus: JobStatus) => {
    if (!window.confirm(`${nextStatus === 'archived' ? 'Archive' : 'Delete'} all ${filteredJobs.length} visible jobs?`)) return;
    startTransition(async () => {
      for (const job of filteredJobs) {
        const form = new FormData(); form.set('jobId', String(job.id)); form.set('status', nextStatus);
        await updateJobReview(form);
      }
      router.refresh();
    });
  };

  return (
    <section className="jobs-page">
      <div className="jobs-heading">
        <div><p className="muted">Shared workspace</p><h1>Jobs</h1><p className="jobs-subtitle">Tabular board · logos · search · times in columns</p></div>
        <button className="icon-button" type="button" title="Tab actions" aria-label="Tab actions" onClick={() => setShowFilters((value) => !value)}>⋮</button>
      </div>

      <div className="jobs-toolbar">
        <form className="jobs-search" onSubmit={submitSearch}><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or company…" aria-label="Search title or company" /><button className="button" type="submit">Search</button></form>
        <div className="segmented" aria-label="Job status">{statuses.map((item) => <button key={item.value} className={status === item.value ? 'selected' : ''} type="button" onClick={() => navigateStatus(item.value)}>{item.label} {counts[item.count]}</button>)}</div>
        <div className="segmented" aria-label="Job view mode"><button className={viewMode === 'list-focus' ? 'selected' : ''} type="button" onClick={() => setMode('list-focus')}>Table</button><button className={viewMode === 'split' ? 'selected' : ''} type="button" onClick={() => setMode('split')}>Split</button><button className={viewMode === 'detail-focus' ? 'selected' : ''} type="button" onClick={() => setMode('detail-focus')}>Detail</button></div>
        <button className={`icon-button ${showFilters ? 'selected-icon' : ''}`} type="button" title="Filters" aria-label="Filters" onClick={() => setShowFilters((value) => !value)}>⌯</button>
      </div>

      {showFilters && <div className="filter-panel card"><label>Job board ID<input className="field" value={siteFilter} onChange={(event) => setSiteFilter(event.target.value.replace(/\D/g, ''))} placeholder="All boards" /></label><label>Search<select className="field" value={linkFilter} onChange={(event) => setLinkFilter(event.target.value)}><option value="">All searches</option>{searches.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label>Label<select className="field" value={labelFilter} onChange={(event) => setLabelFilter(event.target.value)}><option value="">All labels</option>{Object.values(JOB_LABELS).map((label) => <option key={label}>{label}</option>)}</select></label><label className="checkbox-label"><input type="checkbox" checked={hideReposted} onChange={(event) => setHideReposted(event.target.checked)} /> Hide reposted jobs</label><button className="button" type="button" onClick={() => { setSiteFilter(''); setLinkFilter(''); setLabelFilter(''); setHideReposted(false); }}>Clear filters</button><button className="button" type="button" onClick={exportCsv}>CSV export</button><button className="button" type="button" onClick={() => router.refresh()}>Refresh</button><button className="button danger" type="button" onClick={() => bulkUpdate('archived')}>Archive visible</button><button className="button danger" type="button" onClick={() => bulkUpdate('deleted')}>Delete visible</button><button className="button" type="button" onClick={() => { setShowFilters(false); }}>Close</button></div>}

      <div className={`job-board mode-${viewMode}`}>
        <div className="job-board-list card"><div className="job-table-scroll"><table className="job-table"><thead><tr><th aria-label="Board" /><th>Job / company</th><th>Location</th><th>Found</th><th>Posted</th><th>Search</th><th aria-label="Actions" /></tr></thead><tbody>{filteredJobs.length === 0 ? <tr><td colSpan={7} className="empty-cell">No jobs match these filters.</td></tr> : groupedJobs.map(([date, dateJobs]) => <Fragment key={date}><tr className="job-date-row"><th colSpan={7}>{date} · {dateJobs.length} {dateJobs.length === 1 ? 'job' : 'jobs'}</th></tr>{dateJobs.map((job) => <tr key={job.id} className={job.id === selected?.id ? 'selected' : ''} onClick={() => setSelectedId(job.id)}><td><span className="job-site-code">{siteCode(job)}</span></td><td><strong>{job.title}</strong><small>{job.companyName}</small>{job.labels?.length ? <em>{job.labels.join(' · ')}</em> : null}</td><td>{job.location || '—'}</td><td>{relativeTime(job.created_at)}</td><td>{job.posted_at_raw || '—'}</td><td>{job.link_id ? searchTitles.get(job.link_id) || `#${job.link_id}` : '—'}</td><td className="job-row-actions">{job.status === 'new' && <button className="icon-button" type="button" title="Move to ready" aria-label="Move to ready" disabled={pending} onClick={(event) => { event.stopPropagation(); updateReview(job.id, 'ready'); }}>→</button>}<button className="icon-button" type="button" title="Mark applied" aria-label="Mark applied" disabled={pending || job.status === 'applied'} onClick={(event) => { event.stopPropagation(); updateReview(job.id, 'applied'); }}>✓</button><button className="icon-button" type="button" title="Archive job" aria-label="Archive job" disabled={pending || job.status === 'archived'} onClick={(event) => { event.stopPropagation(); updateReview(job.id, 'archived'); }}>▱</button><button className="icon-button danger" type="button" title="Delete job" aria-label="Delete job" disabled={pending} onClick={(event) => { event.stopPropagation(); if (window.confirm('Delete this job?')) updateReview(job.id, 'deleted'); }}>⌫</button></td></tr>)}</Fragment>)}</tbody></table>{nextCursor && <button className="load-more" type="button" onClick={loadMore} disabled={pending}>{pending ? 'Loading jobs…' : 'Load 50 more jobs'}</button>}</div></div>
        {selected ? <JobDetail job={selected} pending={pending} onUpdate={updateReview} /> : <aside className="job-board-detail card empty-detail">Select a job to view its details.</aside>}
      </div>
      <div className="jobs-footer">↑↓ jobs · Enter open · A applied · E archive · {filteredJobs.length} loaded{nextCursor ? ' · more available' : ''}</div>
    </section>
  );
}

function JobDetail({ job, pending, onUpdate }: { job: Job; pending: boolean; onUpdate: (jobId: number, status?: JobStatus, labels?: JobLabel[]) => void }) {
  const [events, setEvents] = useState<WorkspaceJobEvent[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [showActivity, setShowActivity] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([listJobEvents(job.id), listJobNotes(job.id)]).then(([nextEvents, nextNotes]) => { if (active) { setEvents(nextEvents); setNotes(nextNotes); } }).catch(() => undefined);
    return () => { active = false; };
  }, [job.id]);

  const copyDetails = () => navigator.clipboard.writeText([`Title: ${job.title}`, `Company: ${job.companyName}`, job.location ? `Location: ${job.location}` : '', job.description ? `\n${job.description}` : ''].filter(Boolean).join('\n'));
  const addNote = (event: FormEvent) => {
    event.preventDefault();
    const form = new FormData(); form.set('jobId', String(job.id)); form.set('text', noteText);
    createJobNote(form).then(() => { setNotes((items) => [{ id: Date.now(), text: noteText, created_at: new Date().toISOString() }, ...items]); setNoteText(''); }).catch(() => undefined);
  };

  return <aside className="job-board-detail card"><div className="job-detail-heading"><span className="job-site-code large">{siteCode(job)}</span><div><h2>{job.title}</h2><p>{job.companyName} · {job.location || 'Location not listed'}</p><p className="detail-label">found <strong>{relativeTime(job.created_at)}</strong> · posted <strong>{job.posted_at_raw || dateValue(job.created_at)}</strong> · status <strong>{job.status}</strong></p></div></div>
    <div className="job-detail-actions"><a className="button primary" href={job.externalUrl} target="_blank" rel="noreferrer">Open</a>{job.status === 'new' && <button className="icon-button" type="button" title="Move to ready" onClick={() => onUpdate(job.id, 'ready')}>→</button>}{job.status !== 'applied' && <button className="icon-button" type="button" title="Applied" onClick={() => onUpdate(job.id, 'applied')}>✓</button>}{job.status !== 'new' && <button className="icon-button" type="button" title="Move to new" onClick={() => onUpdate(job.id, 'new')}>↶</button>}{job.status !== 'archived' && <button className="icon-button" type="button" title="Archive" onClick={() => onUpdate(job.id, 'archived')}>▱</button>}<button className="icon-button" type="button" title="Copy URL" onClick={() => navigator.clipboard.writeText(job.externalUrl)}>▣</button><button className="icon-button" type="button" title="Copy details" onClick={copyDetails}>▤</button><button className="icon-button danger" type="button" title="Delete" disabled={pending} onClick={() => { if (window.confirm('Delete this job?')) onUpdate(job.id, 'deleted'); }}>⌫</button><select className="label-select" value={job.labels?.[0] ?? ''} onChange={(event) => onUpdate(job.id, undefined, event.target.value ? [event.target.value as JobLabel] : [])}><option value="">Label…</option>{Object.values(JOB_LABELS).map((label) => <option key={label}>{label}</option>)}</select></div>
    <div className="detail-disclosure"><button type="button" onClick={() => setShowNotes((value) => !value)}>▸ Notes ({notes.length})</button>{showNotes && <div className="notes-content"><form onSubmit={addNote}><textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Add a note for yourself or your helper…" rows={3} /><button className="button" type="submit" disabled={!noteText.trim()}>Add note</button></form>{notes.map((note) => <article className="note" key={note.id}><time>{dateValue(note.created_at)}</time><p>{note.text}</p></article>)}</div>}</div>
    <div className="detail-disclosure"><button type="button" onClick={() => setShowActivity((value) => !value)}>▸ Activity ({events.length})</button>{showActivity && <div className="activity-list">{events.length === 0 ? <p>No activity yet.</p> : events.map((event) => <p key={event.id}><strong>{event.actor_email}</strong> {event.action === 'status_changed' ? `moved ${event.from_status ?? 'job'} to ${event.to_status}` : 'changed labels'} · {dateValue(event.created_at)}</p>)}</div>}</div>
    <div className="job-description">{job.description ? <Markdown remarkPlugins={[remarkGfm]}>{job.description}</Markdown> : <>The job description is not available yet.<br /><a href={job.externalUrl} target="_blank" rel="noreferrer">Read it directly on the source →</a></>}</div><Link className="job-detail-link" href={`/jobs/${job.id}`}>Open full details and activity →</Link></aside>;
}
