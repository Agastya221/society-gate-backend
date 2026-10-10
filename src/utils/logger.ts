import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

// Never write credentials to the logs: auth headers (incl. those inside a logged
// axios error's config), the MSG91 authkey, JWTs / QR tokens and passwords.
// Paths cover the value at top level, one level deep, and inside err/error objects.
const SECRET_KEYS = [
  'authorization',
  'Authorization',
  'authkey',
  'accessToken',
  'refreshToken',
  'token',
  'qrToken',
  'widgetToken',
  'password',
  '"access-token"',
];
const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.authkey',
  'config.headers',
  'config.data',
  '*.config.headers',
  '*.config.data',
  '*.request',
  '*.response.config',
  ...SECRET_KEYS,
  ...SECRET_KEYS.map((key) => `*.${key}`),
  ...SECRET_KEYS.map((key) => `*.*.${key}`),
];

/** Mask a phone number for logs, keeping the last 4 digits: ******3165 */
export const maskPhone = (phone: string | null | undefined): string => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
};

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  redact: { paths: redactPaths, censor: '[REDACTED]' },
  ...(isProduction
    ? {
        // Production: structured JSON logs for log aggregators
        formatters: {
          level: (label: string) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }
    : {
        // Development: pretty-printed logs
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }),
});

export default logger;
