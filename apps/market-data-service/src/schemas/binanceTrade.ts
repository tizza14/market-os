import { z } from 'zod';

export const BinanceTradeSchema = z.object({
  e: z.literal('trade'),
  E: z.number(),
  s: z.string(),
  t: z.number(),
  p: z.string(),
  q: z.string(),
  b: z.number(),
  a: z.number(),
  m: z.boolean(),
});

export type BinanceTrade = z.infer<typeof BinanceTradeSchema>;
