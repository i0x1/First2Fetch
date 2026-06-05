export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

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

const ANSI_CODES = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[90m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
};

const globalAny = globalThis as Record<string, unknown>;
const globalProcess = (globalAny.process ?? null) as { env?: Record<string, string | undefined> } | null;
const globalDeno = (globalAny.Deno ?? null) as { noColor?: boolean } | null;
const DISABLE_COLORS = Boolean(globalDeno?.noColor ?? globalProcess?.env?.NO_COLOR);

const applyColor =
  (code: string) =>
  (text: string): string =>
    DISABLE_COLORS ? text : `${code}${text}${ANSI_CODES.reset}`;

const COLOR = {
  timestamp: applyColor(ANSI_CODES.dim),
  message: applyColor(`${ANSI_CODES.white}${ANSI_CODES.bold}`),
  context: applyColor(ANSI_CODES.magenta),
  data: applyColor(ANSI_CODES.dim),
  level: {
    debug: applyColor(ANSI_CODES.dim),
    info: applyColor(ANSI_CODES.cyan),
    warn: applyColor(ANSI_CODES.yellow),
    error: applyColor(ANSI_CODES.red),
  },
};

export function resolveLogLevel(input?: string | null, fallback: LogLevel = 'info'): LogLevel {
  if (!input) {
    return fallback;
  }

  const normalized = input.trim().toLowerCase();
  return LOG_LEVEL_ALIASES[normalized] ?? fallback;
}

export function shouldLog(level: LogLevel, threshold: LogLevel): boolean {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[threshold];
}

type SerializableRecord = Record<string, unknown>;

const SENSITIVE_KEY_RE = /api[-_]?key|authorization|cookie|token|secret|password|session/i;
const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_ITEMS = 8;
const MAX_OBJECT_KEYS = 20;
const MAX_DEPTH = 4;

function truncateString(value: string, maxLength = MAX_STRING_LENGTH): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...<${value.length - maxLength} more chars>`;
}

function compactError(error: Error): Record<string, unknown> {
  const stack = error.stack?.split('\n').slice(0, 5).join('\n');
  return {
    name: error.name,
    message: error.message,
    stack,
    cause: (error as Error & { cause?: unknown }).cause,
  };
}

function sanitizeLogValue(value: unknown, key = '', depth = 0, seen = new WeakSet<object>()): unknown {
  if (SENSITIVE_KEY_RE.test(key)) {
    return '<redacted>';
  }

  if (typeof value === 'string') {
    return truncateString(value);
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Error) {
    return compactError(value);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  if (depth >= MAX_DEPTH) {
    return `[${Array.isArray(value) ? 'Array' : 'Object'}]`;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    const compact = value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeLogValue(item, key, depth + 1, seen));
    if (value.length > MAX_ARRAY_ITEMS) {
      compact.push(`...${value.length - MAX_ARRAY_ITEMS} more`);
    }
    return compact;
  }

  const entries = Object.entries(value);
  const compactEntries = entries.slice(0, MAX_OBJECT_KEYS).map(([childKey, childValue]) => [
    childKey,
    sanitizeLogValue(childValue, childKey, depth + 1, seen),
  ]);
  if (entries.length > MAX_OBJECT_KEYS) {
    compactEntries.push(['_truncated_keys', entries.length - MAX_OBJECT_KEYS]);
  }

  return Object.fromEntries(compactEntries);
}

export function safeStringify(data?: SerializableRecord): string | undefined {
  if (!data) {
    return undefined;
  }

  try {
    return JSON.stringify(sanitizeLogValue(data), undefined, 0);
  } catch {
    return '[Unserializable payload]';
  }
}

export type FormatConsoleLogOptions = {
  level: LogLevel;
  message: string;
  namespace?: string;
  meta?: Record<string, string>;
  data?: SerializableRecord;
  timestamp?: Date | string;
};

function formatMetaValue(key: string, value: string): string {
  if (SENSITIVE_KEY_RE.test(key) || key === 'user_email') {
    return '<redacted>';
  }

  if ((key === 'request_id' || key === 'user_id') && value.length > 8) {
    return value.slice(0, 8);
  }

  return truncateString(value, 80);
}

export function formatConsoleLog(options: FormatConsoleLogOptions): string {
  const time =
    typeof options.timestamp === 'string'
      ? options.timestamp
      : (options.timestamp ?? new Date()).toISOString();
  const baseLevel = options.level.toUpperCase().padEnd(5, ' ');
  const levelSegment = COLOR.level[options.level](`[${baseLevel}]`);
  const timestampSegment = COLOR.timestamp(time);
  const messageSegment = COLOR.message(options.message);

  const contextParts: string[] = [];
  if (options.namespace) {
    contextParts.push(options.namespace);
  }

  if (options.meta) {
    contextParts.push(
      ...Object.entries(options.meta).map(([key, value]) => `${key}=${formatMetaValue(key, value ?? '')}`.trim()),
    );
  }

  const contextSegment = contextParts.length ? ` ${COLOR.context(contextParts.join(' '))}` : '';
  const dataString = safeStringify(options.data);
  const dataSegment = dataString ? ` ${COLOR.data(dataString)}` : '';

  return `${timestampSegment} ${levelSegment} ${messageSegment}${contextSegment}${dataSegment}`;
}
