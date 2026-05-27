import type { FastifyInstance } from 'fastify';
import { KlinesQuerySchema } from '../schemas/queryParams.js';
import { ERROR_CODES } from '@market-os/config';
import type { Kline } from '@market-os/shared-types';
import { calcIndicators } from '../services/indicatorService.js';

export interface LatestTickDTO {
  symbol: string;
  price: string;
  quantity: string;
  eventTime: number;
}

export interface MarketDeps {
  findLatestTick: () => Promise<LatestTickDTO | null>;
  findKlines: (symbol: string, interval: string, limit: number) => Promise<Kline[]>;
}

export function registerMarketRoutes(fastify: FastifyInstance, deps: MarketDeps): void {
  fastify.get('/api/market/latest', async (_req, reply) => {
    const tick = await deps.findLatestTick();
    if (!tick) {
      return reply.status(404).send({
        error: { code: ERROR_CODES.NO_DATA, message: 'No market data available yet' },
      });
    }
    return reply.send(tick);
  });

  fastify.get('/api/market/klines', async (req, reply) => {
    const result = KlinesQuerySchema.safeParse(req.query);
    if (!result.success) {
      return reply.status(400).send({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid query parameters',
          details: result.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
      });
    }

    const { symbol, interval, limit } = result.data;
    const klines = await deps.findKlines(symbol, interval, limit);
    const closes = klines.map((k) => parseFloat(k.close));
    const indicators = calcIndicators(closes);
    return reply.send({ symbol, interval, data: klines, indicators });
  });
}
