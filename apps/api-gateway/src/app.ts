import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocketPlugin from '@fastify/websocket';
import { registerHealthRoutes, type HealthDeps } from './handlers/health.js';
import { registerMarketRoutes, type MarketDeps } from './handlers/market.js';
import { registerWebSocketRoutes, type WsDeps } from './handlers/websocket.js';
import { registerTwStockRoutes, type TwStockDeps } from './handlers/twStock.js';

export type AppDeps = HealthDeps & MarketDeps & WsDeps & TwStockDeps;

export async function buildApp(deps: AppDeps, opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: opts.logger ?? true });

  await fastify.register(cors, {
    origin: process.env['CORS_ORIGIN'] ?? '*',
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await fastify.register(websocketPlugin);

  registerHealthRoutes(fastify, deps);
  registerMarketRoutes(fastify, deps);
  registerWebSocketRoutes(fastify, deps);
  registerTwStockRoutes(fastify, deps);

  return fastify;
}
