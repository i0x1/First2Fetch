import {
  LogLevel,
  RemoteLogTransport,
  createAxiomRemoteTransport,
  formatConsoleLog,
  resolveLogLevel,
  resolveRemoteLoggingEnv,
  shouldLog,
} from '@first2apply/core';

export interface ILogger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  addMeta(key: string, value: string): void;
  flush(): void;
}

function isTruthyEnv(value: string | undefined): boolean {
  const v = (value ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

class Logger implements ILogger {
  private _consoleMeta: Record<string, string>;

  constructor(
    private _remote: RemoteLogTransport | null,
    private _consoleLevel: LogLevel,
    meta: Record<string, string>,
  ) {
    this._consoleMeta = { ...meta };
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

  private writeToRemote(level: LogLevel, message: string, data?: Record<string, unknown>) {
    this._remote?.enqueue({
      level,
      message,
      timestamp: new Date().toISOString(),
      meta: Object.keys(this._consoleMeta).length ? this._consoleMeta : undefined,
      data,
    });
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

export const createLoggerWithMeta = (meta: Record<string, string>) => {
  const consoleLevel = resolveLogLevel(
    Deno.env.get('EDGE_LOG_LEVEL') ?? Deno.env.get('LOG_LEVEL') ?? null,
    'info',
  );

  const axiomEnv = {
    AXIOM_TOKEN: Deno.env.get('AXIOM_TOKEN') ?? undefined,
    AXIOM_DATASET: Deno.env.get('AXIOM_DATASET') ?? undefined,
    AXIOM_URL: Deno.env.get('AXIOM_URL') ?? undefined,
    REMOTE_LOG_LEVEL: Deno.env.get('REMOTE_LOG_LEVEL') ?? undefined,
  };
  const resolvedAxiom = isTruthyEnv(Deno.env.get('AXIOM_ENABLE_EDGE')) ? resolveRemoteLoggingEnv(axiomEnv) : null;

  const remoteTransport = resolvedAxiom
    ? createAxiomRemoteTransport({
        token: resolvedAxiom.token,
        dataset: resolvedAxiom.dataset,
        baseUrl: resolvedAxiom.baseUrl,
        minLevel: resolvedAxiom.minLevel,
        source: 'edge-functions',
        fetchImpl: fetch,
        batchSize: 10,
        flushIntervalMs: 0,
      })
    : null;

  return new Logger(remoteTransport, consoleLevel, meta);
};
