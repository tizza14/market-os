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
