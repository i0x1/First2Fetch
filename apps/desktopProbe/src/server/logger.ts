import { ENV } from '../env';

import { Logger as MezmoLogger, createLogger } from '@logdna/logger';
import { app } from 'electron';

export interface ILogger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  addMeta(key: string, value: string): void;
  flush(): void;
}

/**
 * Custom logger class that wraps the Mezmo logger.
 */
class Logger implements ILogger {
  constructor(private _logger: MezmoLogger | null) {}

  debug(message: string, data?: Record<string, unknown>) {
    if (data) {
      console.log(message, data);
    } else {
      console.log(message);
    }
    if (this._logger) {
      this._logger.debug(message, {
        meta: data,
      });
    }
  }

  info(message: string, data?: Record<string, unknown>) {
    if (data) {
      console.log(message, data);
    } else {
      console.log(message);
    }
    if (this._logger) {
      this._logger.info(message, {
        meta: data,
      });
    }
  }

  error(message: string, data?: Record<string, unknown>) {
    if (data) {
      console.error(message, data);
    } else {
      console.error(message);
    }
    if (this._logger) {
      this._logger.error(message, {
        meta: data,
      });
    }
  }

  addMeta(key: string, value: string) {
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

export const logger = new Logger(mezmoLogger);
