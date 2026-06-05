import { getScannerStatus } from '@/lib/electronMainSdk';
import { AVAILABLE_CRON_RULES, ScannerStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@first2apply/ui';
import * as luxon from 'luxon';
import { useEffect, useMemo, useState } from 'react';

import { CompactPageHeader, CompactPanel } from '@/components/compact/compactLayout';
import { useLinks } from '@/hooks/links';
import { useSites } from '@/hooks/sites';
import { DefaultLayout } from './defaultLayout';

export function ScannerStatusPage() {
  const [status, setStatus] = useState<ScannerStatus | null>(null);
  const { links } = useLinks();
  const { siteLogos, siteMap } = useSites();

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await getScannerStatus();
        setStatus(data);
      } catch (error) {
        console.error('Failed to fetch scanner status:', error);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, []);

  const boardHealth = useMemo(() => {
    const boards = new Map<
      number,
      {
        siteId: number;
        name: string;
        searchCount: number;
        lastScrapedAt?: Date;
        errors: number;
      }
    >();

    for (const link of links) {
      const existing = boards.get(link.site_id) ?? {
        siteId: link.site_id,
        name: siteMap[link.site_id]?.name ?? 'Unknown board',
        searchCount: 0,
        errors: 0,
      };
      const scrapedAt = link.last_scraped_at ? new Date(link.last_scraped_at) : undefined;
      boards.set(link.site_id, {
        ...existing,
        searchCount: existing.searchCount + 1,
        lastScrapedAt:
          scrapedAt && (!existing.lastScrapedAt || scrapedAt.getTime() > existing.lastScrapedAt.getTime())
            ? scrapedAt
            : existing.lastScrapedAt,
        errors: existing.errors + (link.scrape_failure_count >= 3 ? link.scrape_failure_count : 0),
      });
    }

    return [...boards.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [links, siteMap]);

  if (!status) {
    return (
      <DefaultLayout className="max-w-5xl space-y-2">
        <div>Loading status...</div>
      </DefaultLayout>
    );
  }

  const getCronLabel = (rule: string | undefined) => {
    if (!rule) return 'Manual only';
    const found = AVAILABLE_CRON_RULES.find((r) => r.value === rule);
    return found ? found.name : `Custom (${rule})`;
  };

  const logs = status.logs ?? [];
  const currentJobs = status.currentJobs ?? [];
  const logErrorCount = logs.filter((log) => /error|failed|failure/i.test(log)).length;
  const boardErrorCount = boardHealth.reduce((sum, board) => sum + board.errors, 0);
  const totalErrors = logErrorCount + boardErrorCount;
  const lastScanDate = boardHealth
    .map((board) => board.lastScrapedAt)
    .filter((date): date is Date => !!date)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const health = totalErrors > 0 ? 'Attention' : status.isScanning ? 'Scanning' : 'Healthy';

  return (
    <DefaultLayout className="max-w-5xl space-y-3">
      <CompactPageHeader title="Scanner Status" />

      <CompactPanel title="Scanner">
        <div className="grid grid-cols-2 divide-x divide-y divide-border text-xs md:grid-cols-5 md:divide-y-0">
          <Metric label="Health" value={health} tone={totalErrors > 0 ? 'bad' : 'good'} active={status.isScanning} />
          <Metric label="State" value={status.isScanning ? 'Running' : 'Idle'} active={status.isScanning} />
          <Metric label="Last scan" value={lastScanDate ? luxon.DateTime.fromJSDate(lastScanDate).toRelative() : 'None'} />
          <Metric
            label="Next scan"
            value={status.nextScanTime ? luxon.DateTime.fromISO(status.nextScanTime).toRelative() : getCronLabel(status.cronRule)}
          />
          <Metric label="Errors" value={`${totalErrors}`} tone={totalErrors > 0 ? 'bad' : 'good'} />
        </div>
        <div className="border-t border-border px-2 py-1 text-[11px] text-muted-foreground">
          LinkedIn:{' '}
          {status.nextLinkedinScanTime
            ? luxon.DateTime.fromISO(status.nextLinkedinScanTime).toRelative()
            : status.linkedinCronRule
              ? `every ${status.linkedinCronRule.split('/')[1]?.split(' ')[0]} min`
              : 'not scheduled'}{' '}
          · Active jobs: {currentJobs.length}
        </div>
      </CompactPanel>

      <CompactPanel title="Boards Health">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-border bg-muted text-[9px] uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-1 text-left">Board</th>
                <th className="px-2 py-1 text-left">Saved</th>
                <th className="px-2 py-1 text-left">Last</th>
                <th className="px-2 py-1 text-left">Errors</th>
                <th className="px-2 py-1 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {boardHealth.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-3 text-center text-muted-foreground">
                    No saved searches yet.
                  </td>
                </tr>
              ) : (
                boardHealth.map((board) => {
                  const healthy = board.errors === 0;
                  return (
                    <tr key={board.siteId} className="border-b border-border last:border-b-0">
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          {siteLogos[board.siteId] ? (
                            <img src={siteLogos[board.siteId]} alt="" className="h-5 w-5 rounded object-contain" />
                          ) : null}
                          <span className="font-medium text-foreground">{board.name}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{board.searchCount}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {board.lastScrapedAt ? luxon.DateTime.fromJSDate(board.lastScrapedAt).toRelative() : 'Never'}
                      </td>
                      <td className={cn('px-2 py-1.5 font-medium', healthy ? 'text-green-600' : 'text-destructive')}>
                        {board.errors}
                      </td>
                      <td className="px-2 py-1.5">
                        <Badge className="text-[10px]" variant={healthy ? 'secondary' : 'destructive'}>
                          {healthy ? 'OK' : 'Fix'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CompactPanel>

      {currentJobs.length > 0 && (
        <CompactPanel title={`Active Jobs (${currentJobs.length})`}>
          <div className="divide-y">
            {currentJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between px-2 py-1.5">
                <div className="space-y-1">
                  <div className="text-sm font-medium">{job.title}</div>
                  <div className="text-[11px] text-muted-foreground">ID: {job.id}</div>
                </div>
                <Badge className="text-[10px]" variant={job.status === 'parsing_description' ? 'secondary' : 'outline'}>
                  {job.status === 'parsing_description' ? 'AI Parsing' : 'Fetching HTML'}
                </Badge>
              </div>
            ))}
          </div>
        </CompactPanel>
      )}

      <CompactPanel title="Activity Log">
        <div className="h-56 space-y-1 overflow-y-auto p-2 font-mono text-[11px]">
          {logs.length === 0 ? (
            <div className="text-muted-foreground">No recent activity.</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="border-b border-border/50 pb-1 last:border-0 last:pb-0">
                {log}
              </div>
            ))
          )}
        </div>
      </CompactPanel>
    </DefaultLayout>
  );
}

function Metric({
  label,
  value,
  tone = 'neutral',
  active = false,
}: {
  label: string;
  value: string | null;
  tone?: 'neutral' | 'good' | 'bad';
  active?: boolean;
}) {
  return (
    <div className="min-h-[48px] px-2 py-1.5">
      <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            active && 'animate-pulse',
            tone === 'good' && 'bg-green-600',
            tone === 'bad' && 'bg-destructive',
            tone === 'neutral' && 'bg-muted-foreground/50',
          )}
        />
        {label}
      </div>
      <div
        className={cn(
          'truncate text-sm font-semibold',
          tone === 'good' && 'text-green-600',
          tone === 'bad' && 'text-destructive',
          tone === 'neutral' && 'text-foreground',
        )}
      >
        {value ?? '-'}
      </div>
    </div>
  );
}
