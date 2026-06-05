type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const LOG_LEVEL_ALIASES: Record<string, LogLevel> = {
  debug: 'debug',
  d: 'debug',
  verbose: 'debug',
  info: 'info',
  i: 'info',
  warn: 'warn',
  warning: 'warn',
  w: 'warn',
  error: 'error',
  err: 'error',
  e: 'error',
};

function resolveLogLevel(input?: string | null, fallback: LogLevel = 'info'): LogLevel {
  if (!input) {
    return fallback;
  }

  const normalized = input.trim().toLowerCase();
  return LOG_LEVEL_ALIASES[normalized] ?? fallback;
}

function shouldLog(level: LogLevel, threshold: LogLevel): boolean {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[threshold];
}

export type RemoteLogEvent = {
  level: LogLevel;
  message: string;
  timestamp: string;
  meta?: Record<string, string>;
  data?: Record<string, unknown>;
};

const MAX_REMOTE_STRING_LENGTH = 2_000;
const MAX_REMOTE_ARRAY_ITEMS = 25;
const MAX_REMOTE_OBJECT_KEYS = 50;
const MAX_REMOTE_DEPTH = 6;
const SENSITIVE_LOG_KEY_RE = /api[-_]?key|authorization|cookie|token|secret|password|session/i;

function truncateRemoteString(value: string): string {
  if (value.length <= MAX_REMOTE_STRING_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_REMOTE_STRING_LENGTH)}...<${value.length - MAX_REMOTE_STRING_LENGTH} more chars>`;
}

export function redactSensitiveLogMeta(value: unknown): unknown {
  return redactSensitiveLogValue(value);
}

function redactSensitiveLogValue(value: unknown, key = '', depth = 0, seen = new WeakSet<object>()): unknown {
  if (SENSITIVE_LOG_KEY_RE.test(key)) {
    return '<redacted>';
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_REMOTE_DEPTH) {
      return '[Array]';
    }

    const compact = value
      .slice(0, MAX_REMOTE_ARRAY_ITEMS)
      .map((item) => redactSensitiveLogValue(item, key, depth + 1, seen));
    if (value.length > MAX_REMOTE_ARRAY_ITEMS) {
      compact.push(`...${value.length - MAX_REMOTE_ARRAY_ITEMS} more`);
    }
    return compact;
  }

  if (typeof value === 'string') {
    return truncateRemoteString(value);
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack?.split('\n').slice(0, 12).join('\n'),
      cause: (value as Error & { cause?: unknown }).cause,
    };
  }

  if (value && typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }

    if (depth >= MAX_REMOTE_DEPTH) {
      return '[Object]';
    }

    seen.add(value);
    const entries = Object.entries(value);
    const compactEntries = entries.slice(0, MAX_REMOTE_OBJECT_KEYS).map(([childKey, child]) => [
      childKey,
      redactSensitiveLogValue(child, childKey, depth + 1, seen),
    ]);
    if (entries.length > MAX_REMOTE_OBJECT_KEYS) {
      compactEntries.push(['_truncated_keys', entries.length - MAX_REMOTE_OBJECT_KEYS]);
    }

    return Object.fromEntries(
      compactEntries,
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

    const maybeNodeTimer = flushTimer as { unref?: () => void };
    maybeNodeTimer.unref?.();
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
