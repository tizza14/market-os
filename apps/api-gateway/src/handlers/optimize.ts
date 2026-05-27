import type { FastifyInstance } from 'fastify';
import { OptimizeQuerySchema } from '../schemas/queryParams.js';
import { ERROR_CODES } from '@market-os/config';
import type { Kline } from '@market-os/shared-types';
import { runOptimize } from '../services/backtestService.js';

export interface OptimizeDeps {
  findKlines: (symbol: string, interval: string, limit: number) => Promise<Kline[]>;
}

export function registerOptimizeRoutes(fastify: FastifyInstance, deps: OptimizeDeps): void {
  fastify.get('/api/backtest/optimize', async (req, reply) => {
    const result = OptimizeQuerySchema.safeParse(req.query);
    if (!result.success) {
      return reply.status(400).send({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid query parameters',
          details: result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
      });
    }

    const { symbol, interval, limit, smaMin, smaMax, smaStep, emaMin, emaMax, emaStep, metric } = result.data;
    const klines = await deps.findKlines(symbol, interval, limit);

    if (klines.length <= smaMax) {
      return reply.status(422).send({
        error: { code: ERROR_CODES.NO_DATA, message: `Insufficient data for optimization (need > ${smaMax} klines)` },
      });
    }

    return reply.send(runOptimize(symbol, interval, klines, { smaMin, smaMax, smaStep, emaMin, emaMax, emaStep, metric }));
  });
}
