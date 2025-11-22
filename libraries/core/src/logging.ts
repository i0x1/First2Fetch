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

export function safeStringify(data?: SerializableRecord): string | undefined {
  if (!data) {
    return undefined;
  }

  try {
    const seen = new WeakSet<object>();
    return JSON.stringify(
      data,
      (_key, value) => {
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack,
            cause: (value as Error & { cause?: unknown }).cause,
          };
        }

        if (typeof value === 'bigint') {
          return value.toString();
        }

        if (value && typeof value === 'object') {
          if (seen.has(value as object)) {
            return '[Circular]';
          }

          seen.add(value as object);
        }

        return value;
      },
      0,
    );
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
      ...Object.entries(options.meta).map(([key, value]) => `${key}=${value ?? ''}`.trim()),
    );
  }

  const contextSegment = contextParts.length ? ` ${COLOR.context(contextParts.join(' '))}` : '';
  const dataString = safeStringify(options.data);
  const dataSegment = dataString ? ` ${COLOR.data(dataString)}` : '';

  return `${timestampSegment} ${levelSegment} ${messageSegment}${contextSegment}${dataSegment}`;
}

