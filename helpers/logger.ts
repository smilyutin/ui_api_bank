import { TestInfo } from '@playwright/test';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: string;
}

class TestLogger {
  private logs: LogEntry[] = [];
  private testInfo?: TestInfo;
  private startTime: number = Date.now();

  constructor(testInfo?: TestInfo) {
    this.testInfo = testInfo;
  }

  debug(message: string, context?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: Record<string, any>, error?: Error) {
    this.log(LogLevel.ERROR, message, context, error);
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error) {
    const timestamp = new Date().toISOString();
    const entry: LogEntry = {
      timestamp,
      level,
      message,
      context,
      error: error?.message || error?.stack
    };

    this.logs.push(entry);

    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    const errorStr = error ? ` | ${error.message}` : '';
    const levelColor = this.getLevelColor(level);

    console.log(`[${level}] ${timestamp} ${message}${contextStr}${errorStr}`);
  }

  private getLevelColor(level: LogLevel): string {
    const colors: Record<LogLevel, string> = {
      [LogLevel.DEBUG]: '\x1b[36m',
      [LogLevel.INFO]: '\x1b[32m',
      [LogLevel.WARN]: '\x1b[33m',
      [LogLevel.ERROR]: '\x1b[31m'
    };
    return colors[level];
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }

  getFormattedLogs(): string {
    const elapsed = Date.now() - this.startTime;
    let output = `Test Logs (${elapsed}ms)\n`;
    output += '='.repeat(60) + '\n';

    this.logs.forEach((entry, idx) => {
      output += `${idx + 1}. [${entry.level}] ${entry.timestamp}\n`;
      output += `   ${entry.message}\n`;
      if (entry.context) {
        output += `   Context: ${JSON.stringify(entry.context, null, 2)}\n`;
      }
      if (entry.error) {
        output += `   Error: ${entry.error}\n`;
      }
    });

    output += '='.repeat(60) + '\n';
    return output;
  }

  attachToTest() {
    if (this.testInfo && this.logs.length > 0) {
      try {
        this.testInfo.attach('test-logs', {
          body: this.getFormattedLogs(),
          contentType: 'text/plain'
        });
      } catch (e) {
        console.error('Failed to attach logs to test:', e);
      }
    }
  }

  getSummary(): Record<string, number> {
    const summary = {
      total: this.logs.length,
      debug: this.logs.filter(l => l.level === LogLevel.DEBUG).length,
      info: this.logs.filter(l => l.level === LogLevel.INFO).length,
      warn: this.logs.filter(l => l.level === LogLevel.WARN).length,
      error: this.logs.filter(l => l.level === LogLevel.ERROR).length
    };
    return summary;
  }
}

export function createLogger(testInfo?: TestInfo): TestLogger {
  return new TestLogger(testInfo);
}

export { TestLogger };
