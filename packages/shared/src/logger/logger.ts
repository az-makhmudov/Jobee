export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  [key: string]: unknown;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  environment: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
  };
}

export interface LoggerOptions {
  service: string;
  level?: LogLevel;
  environment?: string;
}

const LOG_LEVEL_PRIORITIES: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

const SENSITIVE_KEY_PATTERNS = [
  /pass(word)?/i,
  /secret/i,
  /token/i,
  /auth(orization)?/i,
  /database_url/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /cookie/i,
];

const SENSITIVE_VALUE_PATTERNS = [
  /postgres(ql)?:\/\/[^:]+:[^@]+@/i, // connection strings with passwords
  /bearer\s+[a-zA-Z0-9_\-.]+/i,
];

export function redactSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    let sanitized = data;
    for (const pattern of SENSITIVE_VALUE_PATTERNS) {
      sanitized = sanitized.replace(pattern, 'postgres://[REDACTED]@[REDACTED]/');
    }
    return sanitized;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item));
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitiveKey) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactSensitiveData(value);
      }
    }
    return result;
  }

  return data;
}

export class Logger {
  public readonly service: string;
  public readonly level: LogLevel;
  public readonly environment: string;

  constructor(options: LoggerOptions) {
    this.service = options.service;
    this.level = options.level ?? 'info';
    this.environment = options.environment ?? 'development';
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITIES[level] >= LOG_LEVEL_PRIORITIES[this.level];
  }

  private log(level: LogLevel, message: string, context?: LogContext, err?: unknown): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      environment: this.environment,
      message,
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = redactSensitiveData(context) as LogContext;
    }

    if (err) {
      if (err instanceof Error) {
        entry.error = {
          name: err.name,
          message: err.message,
          ...('code' in err && typeof (err as { code: unknown }).code === 'string'
            ? { code: (err as { code: string }).code }
            : {}),
          ...(this.environment !== 'production' ? { stack: err.stack } : {}),
        };
      } else {
        entry.error = {
          name: 'NonError',
          message: String(err),
        };
      }
    }

    const serialized = JSON.stringify(entry);
    if (level === 'error' || level === 'fatal') {
      process.stderr.write(serialized + '\n');
    } else {
      process.stdout.write(serialized + '\n');
    }
  }

  public debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  public info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  public warn(message: string, context?: LogContext, err?: unknown): void {
    this.log('warn', message, context, err);
  }

  public error(message: string, context?: LogContext, err?: unknown): void {
    this.log('error', message, context, err);
  }

  public fatal(message: string, context?: LogContext, err?: unknown): void {
    this.log('fatal', message, context, err);
  }

  public child(childContext: LogContext): ChildLogger {
    return new ChildLogger(this, childContext);
  }
}

export class ChildLogger {
  constructor(
    private readonly parent: Logger,
    private readonly context: LogContext,
  ) {}

  public debug(message: string, context?: LogContext): void {
    this.parent.debug(message, { ...this.context, ...context });
  }

  public info(message: string, context?: LogContext): void {
    this.parent.info(message, { ...this.context, ...context });
  }

  public warn(message: string, context?: LogContext, err?: unknown): void {
    this.parent.warn(message, { ...this.context, ...context }, err);
  }

  public error(message: string, context?: LogContext, err?: unknown): void {
    this.parent.error(message, { ...this.context, ...context }, err);
  }

  public fatal(message: string, context?: LogContext, err?: unknown): void {
    this.parent.fatal(message, { ...this.context, ...context }, err);
  }
}

export function createLogger(options: LoggerOptions): Logger {
  return new Logger(options);
}
