/**
 * Structured logger using Winston.
 *
 * WHY Winston over console.log:
 * - Log levels allow filtering noise in production
 * - Structured JSON output integrates with Oracle Cloud Logging and Datadog
 * - File transports for production without changing call sites
 * - defaultMeta tags every log with service name for aggregation
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';

// WHY __dirname directly: this module compiles to CommonJS where __dirname is
// a built-in global. The ESM fileURLToPath pattern is only needed for ESM targets.
const LOG_DIR = path.resolve(__dirname, '../../logs');
if (process.env['NODE_ENV'] === 'production') {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

/** Human-readable format for local development */
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const hasExtra = Object.keys(meta).length > 1; // >1 because 'service' is always present
    const extra = hasExtra
      ? `\n  ${JSON.stringify(meta, null, 2).replace(/\n/g, '\n  ')}`
      : '';
    return `${ts as string} ${level}: ${(stack as string | undefined) ?? (message as string)}${extra}`;
  })
);

/** Structured JSON for production log aggregation */
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const isProduction = process.env['NODE_ENV'] === 'production';

export const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: isProduction ? prodFormat : devFormat,
  defaultMeta: { service: 'ad-studio-server' },
  transports: [
    new winston.transports.Console(),
    ...(isProduction
      ? [
          new winston.transports.File({
            filename: path.join(LOG_DIR, 'error.log'),
            level: 'error',
          }),
          new winston.transports.File({
            filename: path.join(LOG_DIR, 'combined.log'),
          }),
        ]
      : []),
  ],
});
