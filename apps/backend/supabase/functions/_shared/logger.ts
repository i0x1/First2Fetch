import {
  LogLevel,
  formatConsoleLog,
  resolveLogLevel,
  shouldLog,
  throwError,
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

/**
 * Custom logger class that wraps the Mezmo logger.
 */
class Logger implements ILogger {
  private _consoleMeta: Record<string, string>;

  constructor(
    private _logger: MezmoLogger,
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
    this._logger.debug &&
      this._logger.debug(message, {
        meta: data,
      });
  }

  info(message: string, data?: Record<string, any>) {
    this.writeToConsole('info', message, data);
    this._logger.info &&
      this._logger.info(message, {
        meta: data,
      });
  }

  warn(message: string, data?: Record<string, any>) {
    this.writeToConsole('warn', message, data);
    (this._logger as MezmoLoggerWithWarn).warn &&
      (this._logger as MezmoLoggerWithWarn).warn(message, {
        meta: data,
      });
  }

  error(message: string, data?: Record<string, any>) {
    this.writeToConsole('error', message, data);
    this._logger.error &&
      this._logger.error(message, {
        meta: data,
      });
  }

  addMeta(key: string, value: string) {
    this._consoleMeta[key] = value;
    this._logger.addMetaProperty(key, value);
  }

  flush() {
    this._logger.flush();
  }
}

export const createLoggerWithMeta = (meta: Record<string, string>) => {
  const consoleLevel = resolveLogLevel(
    Deno.env.get('EDGE_LOG_LEVEL') ?? Deno.env.get('LOG_LEVEL') ?? null,
    'info',
  );

  const mezmoLogger = createLogger(Deno.env.get('MEZMO_API_KEY') ?? throwError(''), {
    level: 'info',
    app: 'first2apply',
    env: 'all',
    hostname: 'edge-functions',
    meta,
    indexMeta: true,
  });

  return new Logger(mezmoLogger, consoleLevel, meta);
};
