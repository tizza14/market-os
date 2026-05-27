import { z } from 'zod';
import type { Logger } from 'pino';
import type { KlineRepository } from '../repositories/klineRepository.js';
import type { KlineState } from './klineAggregator.js';

const BINANCE_REST = 'https://api.binance.com/api/v3/klines';
const FETCH_LIMIT  = 500;

const BinanceKlineRowSchema = z.tuple([
  z.number(), // 0: openTime
  z.string(), // 1: open
  z.string(), // 2: high
  z.string(), // 3: low
  z.string(), // 4: close
  z.string(), // 5: volume
  z.number(), // 6: closeTime
  z.unknown(), // 7: quoteAssetVolume (ignored)
  z.number(), // 8: numberOfTrades
]).rest(z.unknown());

export type BinanceKlineRow = z.infer<typeof BinanceKlineRowSchema>;

export function parseBinanceKline(row: BinanceKlineRow, symbol: string, interval: string): KlineState {
  return {
    symbol,
    interval,
    openTime:   row[0],
    closeTime:  row[6],
    open:       row[1],
    high:       row[2],
    low:        row[3],
    close:      row[4],
    volume:     row[5],
    tradeCount: row[8],
  };
}

export async function backfillKlines(
  symbol: string,
  interval: string,
  klineRepo: KlineRepository,
  logger: Logger,
): Promise<number> {
  const count = await klineRepo.countBySymbolInterval(symbol, interval);
  const params = new URLSearchParams({ symbol, interval, limit: String(FETCH_LIMIT) });

  // Gap-fill mode: only advance startTime when we already have a full history.
  // If count < FETCH_LIMIT, the DB has only a handful of live-accumulated candles —
  // fetch the latest 500 from Binance unconditionally to seed historical data.
  if (count >= FETCH_LIMIT) {
    const latestOpenTime = await klineRepo.findLatestOpenTime(symbol, interval);
    if (latestOpenTime !== null) {
      params.set('startTime', String(latestOpenTime + 1));
    }
  }

  let res: Response;
  try {
    res = await fetch(`${BINANCE_REST}?${params.toString()}`);
  } catch (e) {
    logger.warn({ interval, err: (e as Error).message }, 'Binance REST unreachable, skipping backfill');
    return 0;
  }

  if (!res.ok) {
    logger.warn({ interval, status: res.status }, 'Binance REST error, skipping backfill');
    return 0;
  }

  const raw = (await res.json()) as unknown[][];
  const now  = Date.now();
  const klines: KlineState[] = [];

  for (const row of raw) {
    const parsed = BinanceKlineRowSchema.safeParse(row);
    if (!parsed.success) continue;
    const kline = parseBinanceKline(parsed.data, symbol, interval);
    if (kline.closeTime >= now) continue; // skip still-open candle
    klines.push(kline);
  }

  if (klines.length > 0) {
    await klineRepo.bulkUpsert(klines);
    logger.info({ interval, count: klines.length }, 'Historical klines stored');
  } else {
    logger.info({ interval }, 'No new historical klines to store');
  }

  return klines.length;
}
