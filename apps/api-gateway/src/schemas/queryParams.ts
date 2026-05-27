import { z } from 'zod';
import { SYMBOLS, KLINE_INTERVALS } from '@market-os/config';

export const KlinesQuerySchema = z.object({
  symbol: z.enum([SYMBOLS.BTCUSDT]).default(SYMBOLS.BTCUSDT),
  interval: z
    .enum([
      KLINE_INTERVALS.ONE_MINUTE,
      KLINE_INTERVALS.FIVE_MINUTES,
      KLINE_INTERVALS.FIFTEEN_MINUTES,
      KLINE_INTERVALS.ONE_HOUR,
    ])
    .default(KLINE_INTERVALS.ONE_MINUTE),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export type KlinesQuery = z.infer<typeof KlinesQuerySchema>;

export const BACKTEST_STRATEGIES = ['ma_cross', 'rsi'] as const;
export type BacktestStrategy = (typeof BACKTEST_STRATEGIES)[number];

export const BacktestQuerySchema = z.object({
  symbol:    z.enum([SYMBOLS.BTCUSDT]).default(SYMBOLS.BTCUSDT),
  interval:  z
    .enum([
      KLINE_INTERVALS.ONE_MINUTE,
      KLINE_INTERVALS.FIVE_MINUTES,
      KLINE_INTERVALS.FIFTEEN_MINUTES,
      KLINE_INTERVALS.ONE_HOUR,
    ])
    .default(KLINE_INTERVALS.ONE_MINUTE),
  limit:     z.coerce.number().int().min(50).max(500).default(300),
  smaPeriod: z.coerce.number().int().min(5).max(100).default(20),
  emaPeriod: z.coerce.number().int().min(5).max(100).default(20),
  strategy:  z.enum(BACKTEST_STRATEGIES).default('ma_cross'),
});

export type BacktestQuery = z.infer<typeof BacktestQuerySchema>;

export const OPTIMIZE_METRICS = ['totalReturn', 'winRate', 'sharpeRatio'] as const;
export type OptimizeMetric = (typeof OPTIMIZE_METRICS)[number];

export const OptimizeQuerySchema = z.object({
  symbol:   z.enum([SYMBOLS.BTCUSDT]).default(SYMBOLS.BTCUSDT),
  interval: z
    .enum([
      KLINE_INTERVALS.ONE_MINUTE,
      KLINE_INTERVALS.FIVE_MINUTES,
      KLINE_INTERVALS.FIFTEEN_MINUTES,
      KLINE_INTERVALS.ONE_HOUR,
    ])
    .default(KLINE_INTERVALS.ONE_HOUR),
  limit:   z.coerce.number().int().min(50).max(500).default(300),
  smaMin:  z.coerce.number().int().min(5).max(95).default(10),
  smaMax:  z.coerce.number().int().min(10).max(100).default(50),
  smaStep: z.coerce.number().int().min(1).max(20).default(5),
  emaMin:  z.coerce.number().int().min(5).max(95).default(10),
  emaMax:  z.coerce.number().int().min(10).max(100).default(50),
  emaStep: z.coerce.number().int().min(1).max(20).default(5),
  metric:  z.enum(OPTIMIZE_METRICS).default('totalReturn'),
});

export type OptimizeQuery = z.infer<typeof OptimizeQuerySchema>;
