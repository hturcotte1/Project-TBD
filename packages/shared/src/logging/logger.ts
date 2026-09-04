import pino, { type Logger } from 'pino';

/** Keys whose values are always redacted from logs, wherever they appear. */
export const REDACT_PATHS = [
  'password',
  '*.password',
  '*.*.password',
  'ciphertext',
  '*.ciphertext',
  'cookies',
  '*.cookies',
  'cookie',
  'authorization',
  'req.headers.authorization',
  'req.headers.cookie',
  'verification_code',
  '*.verification_code',
  'code',
  '*.code',
  'apiKey',
  '*.apiKey',
  'api_key',
  '*.api_key',
  'secret',
  '*.secret',
  'essay_text',
  '*.essay_text',
  'content',
  'drafts',
  '*.drafts',
  'token',
  '*.token',
];

export interface LoggerOptions {
  name: string;
  level?: string;
  pretty?: boolean;
}

export function createLogger(opts: LoggerOptions): Logger {
  return pino({
    name: opts.name,
    level: opts.level ?? process.env.LOG_LEVEL ?? 'info',
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    base: { service: opts.name },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(opts.pretty ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
  });
}

export type { Logger };
