import { ENV } from '../env';

import { LogLevel, formatConsoleLog, resolveLogLevel, shouldLog } from '@first2apply/core';
import { Logger as MezmoLogger, createLogger } from '@logdna/logger';
import { app } from 'electron';

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
    if (this._logger) {
      this._logger.debug(message, {
        meta: data,
      });
    }
  }

  info(message: string, data?: Record<string, unknown>) {
    this.writeToConsole('info', message, data);
    if (this._logger) {
      this._logger.info(message, {
        meta: data,
      });
    }
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.writeToConsole('warn', message, data);
    const warnFn = (this._logger as MezmoLogger & { warn?: typeof this._logger.info })?.warn;
    if (warnFn) {
      warnFn(message, {
        meta: data,
      });
    }
  }

  error(message: string, data?: Record<string, unknown>) {
    this.writeToConsole('error', message, data);
    if (this._logger) {
      this._logger.error(message, {
        meta: data,
      });
    }
  }

  addMeta(key: string, value: string) {
    this._consoleMeta[key] = value;
    if (this._logger) {
      this._logger.addMetaProperty(key, value);
    }
  }

  flush() {
    if (this._logger) {
      this._logger.flush();
    }
  }
}

// Create logger only if Mezmo API key is provided, otherwise use console-only logger
let mezmoLogger: MezmoLogger | null = null;
const consoleLogLevel = resolveLogLevel(
  ENV.logLevel ?? (ENV.nodeEnv === 'development' ? 'debug' : 'info'),
  'info',
);

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
}

export const logger = new Logger(mezmoLogger, consoleLogLevel);
