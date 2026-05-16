import { ENV } from '../env';

import { LogLevel, formatConsoleLog, resolveLogLevel, shouldLog } from '@first2apply/core';
import { Logger as MezmoLogger, createLogger } from '@logdna/logger';
import { app } from 'electron';

type MezmoLoggerWithWarnAndEvents = MezmoLogger & {
  warn?: (message: string, options?: { meta?: Record<string, unknown> }) => void;
  on?: (event: 'error', listener: (error: Error & { meta?: unknown }) => void) => void;
};

function redactSensitiveLoggerMeta(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveLoggerMeta);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        /api[-_]?key|authorization|token|secret|password/i.test(key) ? '<redacted>' : redactSensitiveLoggerMeta(child),
      ]),
    );
  }

  return value;
}

export interface ILogger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  addMeta(key: string, value: string): void;
  flush(): void;
}

/**
 * Custom logger class that wraps the Mezmo logger.
 */
class Logger implements ILogger {
  private _consoleMeta: Record<string, string>;

  constructor(
    private _logger: MezmoLogger | null,
    private _consoleLevel: LogLevel,
    meta?: Record<string, string>,
  ) {
    this._consoleMeta = { ...(meta ?? {}) };
  }

  private writeToMezmo(callback: (logger: MezmoLoggerWithWarnAndEvents) => void) {
    if (!this._logger) {
      return;
    }

    try {
      callback(this._logger as MezmoLoggerWithWarnAndEvents);
    } catch (error) {
      this.writeToConsole('debug', 'Mezmo logger call failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private writeToConsole(level: LogLevel, message: string, data?: Record<string, unknown>) {
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

  debug(message: string, data?: Record<string, unknown>) {
    this.writeToConsole('debug', message, data);
    this.writeToMezmo((logger) => {
      logger.debug(message, {
        meta: data,
      });
    });
  }

  info(message: string, data?: Record<string, unknown>) {
    this.writeToConsole('info', message, data);
    this.writeToMezmo((logger) => {
      logger.info(message, {
        meta: data,
      });
    });
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.writeToConsole('warn', message, data);
    this.writeToMezmo((logger) => {
      const warnFn = logger.warn ?? logger.info;
      warnFn.call(logger, message, {
        meta: data,
      });
    });
  }

  error(message: string, data?: Record<string, unknown>) {
    this.writeToConsole('error', message, data);
    this.writeToMezmo((logger) => {
      logger.error(message, {
        meta: data,
      });
    });
  }

  addMeta(key: string, value: string) {
    this._consoleMeta[key] = value;
    this.writeToMezmo((logger) => {
      logger.addMetaProperty(key, value);
    });
  }

  flush() {
    this.writeToMezmo((logger) => {
      logger.flush();
    });
  }
}

// Create logger only if Mezmo API key is provided, otherwise use console-only logger
let mezmoLogger: MezmoLogger | null = null;
const consoleLogLevel = resolveLogLevel(ENV.logLevel ?? (ENV.nodeEnv === 'development' ? 'debug' : 'info'), 'info');

if (ENV.mezmoApiKey) {
  mezmoLogger = createLogger(ENV.mezmoApiKey, {
    level: ENV.nodeEnv === 'development' ? 'debug' : 'info',
    app: ENV.appBundleId,
    env: ENV.nodeEnv,
    hostname: process.platform,
    meta: {
      version: app.getVersion(),
      arch: process.arch,
    },
    indexMeta: true,
  });

  (mezmoLogger as MezmoLoggerWithWarnAndEvents).on?.('error', (error) => {
    let meta = '';
    try {
      meta = error.meta ? ` ${JSON.stringify(redactSensitiveLoggerMeta(error.meta))}` : '';
    } catch {
      meta = ' [unserializable meta]';
    }
    console.warn(`[warn] Mezmo logger transport error ignored: ${error.message}${meta}`);
  });
}

export const logger = new Logger(mezmoLogger, consoleLogLevel);
