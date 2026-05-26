import { z } from 'zod';
import { SYMBOLS, KLINE_INTERVALS } from '@market-os/config';

export const KlinesQuerySchema = z.object({
  symbol: z.enum([SYMBOLS.BTCUSDT]).default(SYMBOLS.BTCUSDT),
  interval: z.enum([KLINE_INTERVALS.ONE_MINUTE]).default(KLINE_INTERVALS.ONE_MINUTE),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export type KlinesQuery = z.infer<typeof KlinesQuerySchema>;
