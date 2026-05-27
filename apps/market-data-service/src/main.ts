import { MongoClient } from 'mongodb';
import pino from 'pino';
import { z } from 'zod';
import { BinanceTradeSchema } from './schemas/binanceTrade.js';
import { formatTick } from './services/tickProcessor.js';
import { KlineAggregator } from './services/klineAggregator.js';
import { BinanceWebSocket } from './connectors/binanceWebSocket.js';
import { TickRepository } from './repositories/tickRepository.js';
import { KlineRepository } from './repositories/klineRepository.js';
import { RedisPublisher } from './publishers/redisPublisher.js';
import { SYMBOLS, KLINE_INTERVAL_MS } from '@market-os/config';
import { backfillKlines } from './services/historicalDataService.js';

const EnvSchema = z.object({
  BINANCE_WS_URL: z.string().default('wss://stream.binance.com:9443/ws/btcusdt@trade'),
  REDIS_URL: z.string(),
  MONGO_URL: z.string(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  STALE_DATA_THRESHOLD_MS: z.coerce.number().default(5000),
});

const env = EnvSchema.parse(process.env);

const logger = pino({ level: env.LOG_LEVEL });

async function main(): Promise<void> {
  logger.info({ service: 'market-data-service' }, 'Service starting');

  const mongoClient = new MongoClient(env.MONGO_URL);
  await mongoClient.connect();
  logger.info({ url: env.MONGO_URL.replace(/\/\/.*@/, '//***@') }, 'MongoDB connected');

  const tickRepo = new TickRepository(mongoClient, logger);
  const klineRepo = new KlineRepository(mongoClient);
  await tickRepo.ensureIndexes();
  await klineRepo.ensureIndexes();

  const publisher = new RedisPublisher(env.REDIS_URL);
  const aggregators = Object.entries(KLINE_INTERVAL_MS).map(
    ([interval, ms]) => new KlineAggregator(interval, ms, klineRepo, logger),
  );
  await Promise.all(aggregators.map((a) => a.initialize(SYMBOLS.BTCUSDT)));

  logger.info('Starting historical data backfill');
  await Promise.allSettled(
    Object.keys(KLINE_INTERVAL_MS).map((interval) =>
      backfillKlines(SYMBOLS.BTCUSDT, interval, klineRepo, logger),
    ),
  );
  logger.info('Historical data backfill complete');

  let lastEventTime = 0;

  const binanceWs = new BinanceWebSocket(
    env.BINANCE_WS_URL,
    logger,
    async (data) => {
      const result = BinanceTradeSchema.safeParse(data);
      if (!result.success) {
        logger.error({ issues: result.error.issues }, 'Invalid Binance trade payload');
        return;
      }

      const trade = result.data;
      const tick = formatTick(trade);

      if (lastEventTime > 0 && lastEventTime - tick.eventTime > env.STALE_DATA_THRESHOLD_MS) {
        logger.warn({ tradeId: tick.tradeId, eventTime: tick.eventTime, lastEventTime }, 'Stale tick discarded');
        return;
      }
      lastEventTime = Math.max(lastEventTime, tick.eventTime);

      const [tickResult, ...klineResults] = await Promise.allSettled([
        tickRepo.save(tick),
        ...aggregators.map((a) => a.processTick(tick)),
      ]);
      const redisResult = await Promise.allSettled([publisher.publish(tick)]);

      if (tickResult.status === 'rejected') {
        logger.error({ err: (tickResult.reason as Error).message, tradeId: tick.tradeId }, 'Tick save failed');
      }
      for (const klineResult of klineResults) {
        if (klineResult.status === 'rejected') {
          logger.error({ err: (klineResult.reason as Error).message }, 'Kline update failed');
        }
      }
      const r = redisResult[0];
      if (r?.status === 'rejected') {
        logger.warn({ err: (r.reason as Error).message }, 'Redis publish failed');
      }
    },
  );

  binanceWs.connect();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Graceful shutdown started');
    binanceWs.close();
    await Promise.allSettled([
      publisher.close(),
      mongoClient.close(),
    ]);
    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });
}

main().catch((err) => {
  console.error('Fatal error', err);
  process.exit(1);
});
