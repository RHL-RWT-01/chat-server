import fs from 'fs';
import path from 'path';
import config from './config.js';

enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

class Logger {
  private logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  };

  private currentLevel: number;
  private logDir: string;

  constructor() {
    this.currentLevel = this.logLevels[config.logging.level as keyof typeof this.logLevels] || 2;
    this.logDir = config.logging.filePath;
    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatMessage(level: LogLevel, message: string, meta?: unknown): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}\n`;
  }

  private writeToFile(level: LogLevel, message: string): void {
    const logFile = path.join(this.logDir, `${level.toLowerCase()}.log`);
    const combinedFile = path.join(this.logDir, 'combined.log');

    fs.appendFileSync(logFile, message);
    fs.appendFileSync(combinedFile, message);
  }

  private log(level: LogLevel, levelNum: number, message: string, meta?: unknown): void {
    if (levelNum <= this.currentLevel) {
      const formattedMessage = this.formatMessage(level, message, meta);

      // Console output with colors
      const colors: Record<LogLevel, string> = {
        [LogLevel.ERROR]: '\x1b[31m', // Red
        [LogLevel.WARN]: '\x1b[33m', // Yellow
        [LogLevel.INFO]: '\x1b[36m', // Cyan
        [LogLevel.DEBUG]: '\x1b[90m', // Gray
      };

      console.log(`${colors[level]}${formattedMessage}\x1b[0m`);

      // File output
      this.writeToFile(level, formattedMessage);
    }
  }

  public error(message: string, meta?: unknown): void {
    this.log(LogLevel.ERROR, 0, message, meta);
  }

  public warn(message: string, meta?: unknown): void {
    this.log(LogLevel.WARN, 1, message, meta);
  }

  public info(message: string, meta?: unknown): void {
    this.log(LogLevel.INFO, 2, message, meta);
  }

  public debug(message: string, meta?: unknown): void {
    this.log(LogLevel.DEBUG, 3, message, meta);
  }
}

export const logger = new Logger();
