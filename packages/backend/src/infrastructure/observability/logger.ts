/**
 * Log estruturado — 36-OBSERVABILITY. Uma linha JSON por evento, sempre com
 * correlation ID (00 §14). Sem console.* espalhado (lint proíbe em src/).
 */
export type LogLevel = 'info' | 'warn' | 'error';

export interface LogRecord {
  readonly level: LogLevel;
  readonly message: string;
  readonly correlationId: string;
  readonly tenantId: string | null;
  readonly timestamp: string;
  readonly data: Record<string, unknown>;
}

export interface LogSink {
  write(record: LogRecord): void;
}

export class Logger {
  constructor(
    private readonly sink: LogSink,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private emit(level: LogLevel, message: string, correlationId: string, tenantId: string | null, data: Record<string, unknown> = {}): void {
    this.sink.write({
      level,
      message,
      correlationId,
      tenantId,
      timestamp: this.now().toISOString(),
      data,
    });
  }

  info(message: string, correlationId: string, tenantId: string | null = null, data: Record<string, unknown> = {}): void {
    this.emit('info', message, correlationId, tenantId, data);
  }

  warn(message: string, correlationId: string, tenantId: string | null = null, data: Record<string, unknown> = {}): void {
    this.emit('warn', message, correlationId, tenantId, data);
  }

  error(message: string, correlationId: string, tenantId: string | null = null, data: Record<string, unknown> = {}): void {
    this.emit('error', message, correlationId, tenantId, data);
  }
}
