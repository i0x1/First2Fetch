import {
  LogLevel,
  formatConsoleLog,
  resolveLogLevel,
  shouldLog,
} from '@first2apply/core';
import { Logger as MezmoLogger, createLogger } from 'npm:@logdna/logger';

type MezmoLoggerWithWarn = MezmoLogger & {
  warn?: (message: string, options?: { meta?: Record<string, any> }) => void;
};

export interface ILogger {
  debug(message: string, data?: Record<string, any>): void;
  info(message: string, data?: Record<string, any>): void;
  warn(message: string, data?: Record<string, any>): void;
  error(message: string, data?: Record<string, any>): void;
  addMeta(key: string, value: string): void;
  flush(): void;
}

function isTruthyEnv(value: string | undefined): boolean {
  const v = (value ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Custom logger class that wraps the Mezmo logger.
 * When `_mezmo` is null, only console logging is used (safe for hosted Edge: @logdna/logger
 * can throw uncaught connection errors in the event loop and take down the isolate).
 */
class Logger implements ILogger {
  private _consoleMeta: Record<string, string>;

  constructor(
    private _mezmo: MezmoLogger | null,
    private _consoleLevel: LogLevel,
    meta: Record<string, string>,
  ) {
    this._consoleMeta = { ...meta };
  }

  private writeToConsole(level: LogLevel, message: string, data?: Record<string, any>) {
    if (!shouldLog(level, this._consoleLevel)) {
      return;
    }

    const formatted = formatConsoleLog({
      level,
      message,
      meta: Object.keys(this._consoleMeta).length ? this._consoleMeta : undefined,
      data,
    });

    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  debug(message: string, data?: Record<string, any>) {
    this.writeToConsole('debug', message, data);
    this._mezmo?.debug?.(message, { meta: data });
  }

  info(message: string, data?: Record<string, any>) {
    this.writeToConsole('info', message, data);
    this._mezmo?.info?.(message, { meta: data });
  }

  warn(message: string, data?: Record<string, any>) {
    this.writeToConsole('warn', message, data);
    const w = this._mezmo as MezmoLoggerWithWarn | null;
    w?.warn?.(message, { meta: data });
  }

  error(message: string, data?: Record<string, any>) {
    this.writeToConsole('error', message, data);
    this._mezmo?.error?.(message, { meta: data });
  }

  addMeta(key: string, value: string) {
    this._consoleMeta[key] = value;
    this._mezmo?.addMetaProperty?.(key, value);
  }

  flush() {
    this._mezmo?.flush?.();
  }
}

export const createLoggerWithMeta = (meta: Record<string, string>) => {
  const consoleLevel = resolveLogLevel(
    Deno.env.get('EDGE_LOG_LEVEL') ?? Deno.env.get('LOG_LEVEL') ?? null,
    'info',
  );

  const mezmoKey = Deno.env.get('MEZMO_API_KEY')?.trim() ?? '';
  // Opt-in: @logdna/logger opens persistent connections; on Supabase Edge it can throw
  // uncaught "connection-based error" in the event loop (503 for clients). Default off.
  const useMezmo = mezmoKey.length > 0 && isTruthyEnv(Deno.env.get('MEZMO_ENABLE_EDGE'));

  const mezmoLogger = useMezmo
    ? createLogger(mezmoKey, {
        level: 'info',
        app: 'first2apply',
        env: 'all',
        hostname: 'edge-functions',
        meta,
        indexMeta: true,
      })
    : null;

  return new Logger(mezmoLogger, consoleLevel, meta);
};
