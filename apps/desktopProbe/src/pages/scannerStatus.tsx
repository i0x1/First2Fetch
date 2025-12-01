import { getScannerStatus } from '@/lib/electronMainSdk';
import { AVAILABLE_CRON_RULES, ScannerStatus } from '@/lib/types';
import { Badge } from '@first2apply/ui';
import * as luxon from 'luxon';
import { useEffect, useState } from 'react';

import { DefaultLayout } from './defaultLayout';

export function ScannerStatusPage() {
  const [status, setStatus] = useState<ScannerStatus | null>(null);

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

  if (!status) {
    return (
      <DefaultLayout className="space-y-8 p-6 md:p-10 max-w-4xl">
        <div>Loading status...</div>
      </DefaultLayout>
    );
  }

  const getCronLabel = (rule: string | undefined) => {
    if (!rule) return 'Manual only';
    const found = AVAILABLE_CRON_RULES.find((r) => r.value === rule);
    return found ? found.name : `Custom (${rule})`;
  };

  return (
    <DefaultLayout className="space-y-8 p-6 md:p-10 max-w-4xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Scanner Status</h1>
        <p className="text-sm text-muted-foreground">Monitor background scanning activity.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
          <div className="mt-2 flex items-center gap-2">
            <div
              className={`h-3 w-3 rounded-full ${status.isScanning ? 'animate-pulse bg-green-500' : 'bg-gray-300'}`}
            />
            <span className="text-2xl font-bold">{status.isScanning ? 'Running' : 'Idle'}</span>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">Next Scheduled Scan</h3>
          <div className="mt-2 text-xl font-semibold">
            {status.nextScanTime
              ? luxon.DateTime.fromISO(status.nextScanTime).toRelative()
              : getCronLabel(status.cronRule)}
          </div>
          {status.nextScanTime && (
            <div className="text-xs text-muted-foreground">
              {luxon.DateTime.fromISO(status.nextScanTime).toLocaleString(luxon.DateTime.DATETIME_MED)}
            </div>
          )}
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">Next LinkedIn Scan</h3>
          <div className="mt-2 text-xl font-semibold">
            {status.nextLinkedinScanTime
              ? luxon.DateTime.fromISO(status.nextLinkedinScanTime).toRelative()
              : status.linkedinCronRule
                ? `Every ${status.linkedinCronRule.split('/')[1]?.split(' ')[0]} mins`
                : 'Not scheduled'}
          </div>
          {status.nextLinkedinScanTime && (
            <div className="text-xs text-muted-foreground">
              {luxon.DateTime.fromISO(status.nextLinkedinScanTime).toLocaleString(luxon.DateTime.DATETIME_MED)}
            </div>
          )}
        </div>
      </div>

      {status.currentJobs.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Active Jobs ({status.currentJobs.length})</h3>
          <div className="divide-y rounded-xl border bg-card shadow-sm">
            {status.currentJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between p-4">
                <div className="space-y-1">
                  <div className="font-medium">{job.title}</div>
                  <div className="text-xs text-muted-foreground">ID: {job.id}</div>
                </div>
                <Badge variant={job.status === 'parsing_description' ? 'secondary' : 'outline'}>
                  {job.status === 'parsing_description' ? 'AI Parsing' : 'Fetching HTML'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Activity Log</h3>
        <div className="h-64 space-y-1 overflow-y-auto rounded-xl border bg-card p-4 font-mono text-xs shadow-sm">
          {status.logs.length === 0 ? (
            <div className="text-muted-foreground">No recent activity.</div>
          ) : (
            status.logs.map((log, i) => (
              <div key={i} className="border-b border-border/50 pb-1 last:border-0 last:pb-0">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </DefaultLayout>
  );
}
