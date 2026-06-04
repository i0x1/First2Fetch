import { LogLevel, resolveLogLevel, shouldLog } from './logging';

export type RemoteLogEvent = {
  level: LogLevel;
  message: string;
  timestamp: string;
  meta?: Record<string, string>;
  data?: Record<string, unknown>;
};

export function redactSensitiveLogMeta(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveLogMeta);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        /api[-_]?key|authorization|token|secret|password/i.test(key) ? '<redacted>' : redactSensitiveLogMeta(child),
      ]),
    );
  }

  return value;
}

export type RemoteLogTransport = {
  enqueue: (event: RemoteLogEvent) => void;
  flush: () => Promise<void>;
  close: () => Promise<void>;
};

export type AxiomRemoteTransportOptions = {
  token: string;
  dataset: string;
  baseUrl?: string;
  minLevel?: LogLevel;
  source?: string;
  fetchImpl?: typeof fetch;
  batchSize?: number;
  flushIntervalMs?: number;
};

const DEFAULT_AXIOM_BASE_URL = 'https://api.axiom.co';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function toAxiomPayload(event: RemoteLogEvent, source?: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    _time: event.timestamp,
    level: event.level,
    message: event.message,
  };

  if (source) {
    payload.source = source;
  }

  if (event.meta && Object.keys(event.meta).length > 0) {
    payload.meta = redactSensitiveLogMeta(event.meta);
  }

  if (event.data && Object.keys(event.data).length > 0) {
    payload.data = redactSensitiveLogMeta(event.data);
  }

  return payload;
}

export function createAxiomRemoteTransport(options: AxiomRemoteTransportOptions): RemoteLogTransport | null {
  const token = options.token.trim();
  const dataset = options.dataset.trim();
  if (!token || !dataset) {
    return null;
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) {
    return null;
  }

  const minLevel = options.minLevel ?? 'info';
  const batchSize = options.batchSize ?? 25;
  const flushIntervalMs = options.flushIntervalMs ?? 2_000;
  const ingestUrl = `${normalizeBaseUrl(options.baseUrl ?? DEFAULT_AXIOM_BASE_URL)}/v1/datasets/${encodeURIComponent(dataset)}/ingest`;

  let buffer: Record<string, unknown>[] = [];
  let flushTimer: ReturnType<typeof setInterval> | null = null;
  let flushInFlight: Promise<void> | null = null;

  const sendBatch = async (events: Record<string, unknown>[]) => {
    if (events.length === 0) {
      return;
    }

    try {
      const response = await fetchImpl(ingestUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(events),
      });

      if (!response.ok) {
        await response.text().catch(() => undefined);
      }
    } catch {
      // Remote logging must never break app flows or spam the console.
    }
  };

  const flushNow = async () => {
    if (flushInFlight) {
      await flushInFlight;
      return;
    }

    if (buffer.length === 0) {
      return;
    }

    const batch = buffer;
    buffer = [];
    flushInFlight = sendBatch(batch).finally(() => {
      flushInFlight = null;
    });
    await flushInFlight;
  };

  const scheduleFlush = () => {
    if (flushTimer || flushIntervalMs <= 0) {
      return;
    }

    flushTimer = setInterval(() => {
      void flushNow();
    }, flushIntervalMs);

    if (typeof flushTimer === 'object' && 'unref' in flushTimer && typeof flushTimer.unref === 'function') {
      flushTimer.unref();
    }
  };

  return {
    enqueue(event) {
      if (!shouldLog(event.level, minLevel)) {
        return;
      }

      buffer.push(toAxiomPayload(event, options.source));
      if (buffer.length >= batchSize) {
        void flushNow();
        return;
      }

      scheduleFlush();
    },
    async flush() {
      await flushNow();
    },
    async close() {
      if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
      }
      await flushNow();
    },
  };
}

export function resolveRemoteLogLevel(input?: string | null, fallback: LogLevel = 'info'): LogLevel {
  return resolveLogLevel(input, fallback);
}

export type ResolvedRemoteLoggingEnv = {
  token: string;
  dataset: string;
  baseUrl?: string;
  minLevel: LogLevel;
};

/** True only when both token and dataset are non-empty (remote logging is fully configured). */
export function isRemoteLoggingConfigured(env: Record<string, string | undefined>): boolean {
  return resolveRemoteLoggingEnv(env) !== null;
}

export function resolveRemoteLoggingEnv(
  env: Record<string, string | undefined>,
  defaults?: { minLevel?: LogLevel },
): ResolvedRemoteLoggingEnv | null {
  const token = env.AXIOM_TOKEN?.trim() ?? '';
  const dataset = env.AXIOM_DATASET?.trim() ?? '';
  if (!token || !dataset) {
    return null;
  }

  const baseUrl = env.AXIOM_URL?.trim();
  return {
    token,
    dataset,
    baseUrl: baseUrl || undefined,
    minLevel: resolveRemoteLogLevel(env.REMOTE_LOG_LEVEL, defaults?.minLevel ?? 'info'),
  };
}

export function createAxiomTransportFromEnv(
  env: Record<string, string | undefined>,
  defaults?: { source?: string; minLevel?: LogLevel },
): RemoteLogTransport | null {
  const resolved = resolveRemoteLoggingEnv(env, defaults);
  if (!resolved) {
    return null;
  }

  return createAxiomRemoteTransport({
    token: resolved.token,
    dataset: resolved.dataset,
    baseUrl: resolved.baseUrl,
    minLevel: resolved.minLevel,
    source: defaults?.source,
  });
}
