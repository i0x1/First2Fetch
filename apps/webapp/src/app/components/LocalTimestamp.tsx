'use client';

import { useEffect, useState } from 'react';

export function LocalTimestamp({ value }: { value: string | Date }) {
  const [local, setLocal] = useState(false);
  useEffect(() => setLocal(true), []);
  const date = new Date(value);
  const text = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZoneName: 'short', timeZone: local ? undefined : 'UTC',
  }).format(date);
  return <time dateTime={date.toISOString()}>{text}</time>;
}
