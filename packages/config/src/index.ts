export const SYMBOLS = {
  BTCUSDT: 'BTCUSDT',
} as const;

export type Symbol = (typeof SYMBOLS)[keyof typeof SYMBOLS];

export const REDIS_CHANNELS = {
  BTCUSDT: 'market:btcusdt',
} as const;

export const KLINE_INTERVALS = {
  ONE_MINUTE: '1m',
} as const;

export const WS_MESSAGE_TYPES = {
  MARKET_UPDATE: 'market:update',
  MARKET_ERROR:  'market:error',
  PING:          'ping',
  PONG:          'pong',
} as const;

export const ERROR_CODES = {
  VALIDATION_ERROR:    'VALIDATION_ERROR',
  NOT_FOUND:           'NOT_FOUND',
  NO_DATA:             'NO_DATA',
  RATE_LIMITED:        'RATE_LIMITED',
  INTERNAL_ERROR:      'INTERNAL_ERROR',
  SOURCE_DISCONNECTED: 'SOURCE_DISCONNECTED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;
