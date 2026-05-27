import { MongoClient } from 'mongodb';
import Redis from 'ioredis';
import pino from 'pino';
import { z } from 'zod';
import { Decimal128 } from 'mongodb';
import { buildApp } from './app.js';
import { MarketBroadcast } from './services/marketBroadcast.js';
import type { Kline } from '@market-os/shared-types';
import { SYMBOLS, KLINE_INTERVALS } from '@market-os/config';

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  REDIS_URL: z.string(),
  MONGO_URL: z.string(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CORS_ORIGIN: z.string().default('*'),
  WS_MAX_CONNECTIONS: z.coerce.number().default(50),
  FINMIND_TOKEN: z.string().default(''),
});

const env = EnvSchema.parse(process.env);
const logger = pino({ level: env.LOG_LEVEL });

async function main(): Promise<void> {
  logger.info({ service: 'api-gateway' }, 'Service starting');

  const mongoClient = new MongoClient(env.MONGO_URL);
  let mongoConnected = false;
  mongoClient.on('serverOpening', () => { mongoConnected = true; });
  mongoClient.on('topologyClosed', () => { mongoConnected = false; });
  await mongoClient.connect();
  mongoConnected = true;
  logger.info('MongoDB connected');

  const healthRedis = new Redis(env.REDIS_URL);
  const broadcast = new MarketBroadcast(env.REDIS_URL, logger);
  await broadcast.start();

  const db = mongoClient.db('market-os');

  const app = await buildApp({
    mongoConnected: () => mongoConnected,
    redisConnected: () => healthRedis.status === 'ready',
    broadcast,
    findLatestTick: async () => {
      const doc = await db.collection('market_ticks').findOne({}, { sort: { eventTime: -1 } });
      if (!doc) return null;
      return {
        symbol: doc['symbol'] as string,
        price: (doc['price'] as Decimal128).toString(),
        quantity: (doc['quantity'] as Decimal128).toString(),
        eventTime: doc['eventTime'] as number,
      };
    },
    findKlines: async (symbol, interval, limit): Promise<Kline[]> => {
      const docs = await db
        .collection('klines')
        .find({ symbol, interval })
        .sort({ openTime: -1 })
        .limit(limit)
        .toArray();
      return docs.reverse().map((doc) => ({
        openTime: doc['openTime'] as number,
        closeTime: doc['closeTime'] as number,
        open: (doc['open'] as Decimal128).toString(),
        high: (doc['high'] as Decimal128).toString(),
        low: (doc['low'] as Decimal128).toString(),
        close: (doc['close'] as Decimal128).toString(),
        volume: (doc['volume'] as Decimal128).toString(),
        tradeCount: doc['tradeCount'] as number,
      }));
    },
    finmindToken: env.FINMIND_TOKEN,
  });

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info({ port: env.PORT }, 'api-gateway started');

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Graceful shutdown started');
    await app.close();
    await broadcast.stop();
    await Promise.allSettled([healthRedis.quit(), mongoClient.close()]);
    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });
}

void SYMBOLS.BTCUSDT;
void KLINE_INTERVALS.ONE_MINUTE;

main().catch((err) => {
  console.error('Fatal error', err);
  process.exit(1);
});
