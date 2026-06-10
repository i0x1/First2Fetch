import { ENV } from '../env';

import {
  LogLevel,
  RemoteLogTransport,
  createAxiomTransportFromEnv,
  formatConsoleLog,
  resolveLogLevel,
  shouldLog,
} from '@first2apply/core';
import { app } from 'electron';

export interface ILogger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  addMeta(key: string, value: string): void;
  flush(): void;
}

class Logger implements ILogger {
  private _consoleMeta: Record<string, string>;

  constructor(
    private _remote: RemoteLogTransport | null,
    private _consoleLevel: LogLevel,
    meta?: Record<string, string>,
  ) {
    this._consoleMeta = { ...(meta ?? {}) };
  }

  private writeToRemote(level: LogLevel, message: string, data?: Record<string, unknown>) {
    this._remote?.enqueue({
      level,
      message,
      timestamp: new Date().toISOString(),
      meta: Object.keys(this._consoleMeta).length ? this._consoleMeta : undefined,
      data,
    });
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
    this.writeToRemote('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>) {
    this.writeToConsole('info', message, data);
    this.writeToRemote('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.writeToConsole('warn', message, data);
    this.writeToRemote('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>) {
    this.writeToConsole('error', message, data);
    this.writeToRemote('error', message, data);
  }

  addMeta(key: string, value: string) {
    this._consoleMeta[key] = value;
  }

  flush() {
    void this._remote?.flush();
  }
}

const consoleLogLevel = resolveLogLevel(ENV.logLevel ?? (ENV.nodeEnv === 'development' ? 'debug' : 'info'), 'info');

const axiomEnv = {
  AXIOM_TOKEN: ENV.axiomToken,
  AXIOM_DATASET: ENV.axiomDataset,
  AXIOM_URL: ENV.axiomUrl,
  REMOTE_LOG_LEVEL: ENV.remoteLogLevel,
};

const remoteTransport = createAxiomTransportFromEnv(axiomEnv, {
  source: 'desktop',
  minLevel: 'info',
});

export const logger = new Logger(remoteTransport, consoleLogLevel, {
  version: app.getVersion(),
  arch: process.arch,
  platform: process.platform,
  app: ENV.appBundleId ?? 'first2fetch-desktop',
});

if (remoteTransport) {
  process.on('beforeExit', () => {
    void remoteTransport.close();
  });
}
