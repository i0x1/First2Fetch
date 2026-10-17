import { useEffect, useState } from 'react';

import { useError } from '@/hooks/error';
import { listJobEvents } from '@/lib/electronMainSdk';
import { WorkspaceJobEvent } from '@first2apply/core';

export function JobActivity({ jobId }: { jobId: number }) {
  const { handleError } = useError();
  const [events, setEvents] = useState<WorkspaceJobEvent[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    listJobEvents(jobId)
      .then((result) => active && setEvents(result))
      .catch((error) => handleError({ error, title: 'Failed to load job activity' }));
    return () => {
      active = false;
    };
  }, [jobId, handleError]);

  return (
    <section className="mb-2 rounded-md border border-border px-2 py-1.5 text-xs">
      <button className="w-full text-left font-medium" type="button" onClick={() => setOpen((value) => !value)}>
        {open ? '▾' : '▸'} Activity ({events.length})
      </button>
      {open && (
        <div className="mt-1 grid gap-1.5 text-muted-foreground">
          {events.length === 0 ? <p>No recorded activity.</p> : events.map((event) => (
            <p className="border-t border-border pt-1.5" key={event.id}>
              <strong className="text-foreground">
                {event.actor_email || (event.actor_kind === 'system' ? 'System' : 'Unknown')}
              </strong>{' '}
              {event.action === 'status_changed'
                ? `moved ${event.from_status ?? 'job'} to ${event.to_status ?? 'unknown'}`
                : 'changed labels'}
              {event.reason_code !== 'unspecified' && ` · ${event.reason_code.replaceAll('_', ' ')}`}
              {event.reason_text && ` · ${event.reason_text}`}
              <span className="block">{new Date(event.created_at).toLocaleString()} · {event.channel}</span>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
