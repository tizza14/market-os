import type { FastifyInstance } from 'fastify';
import { BacktestQuerySchema } from '../schemas/queryParams.js';
import { ERROR_CODES } from '@market-os/config';
import type { Kline } from '@market-os/shared-types';
import { runMACross, runRSI } from '../services/backtestService.js';

export interface BacktestDeps {
  findKlines: (symbol: string, interval: string, limit: number) => Promise<Kline[]>;
}

export function registerBacktestRoutes(fastify: FastifyInstance, deps: BacktestDeps): void {
  fastify.get('/api/backtest', async (req, reply) => {
    const result = BacktestQuerySchema.safeParse(req.query);
    if (!result.success) {
      return reply.status(400).send({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid query parameters',
          details: result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
      });
    }

    const { symbol, interval, limit, smaPeriod, emaPeriod, strategy } = result.data;
    const klines = await deps.findKlines(symbol, interval, limit);

    const minNeeded = strategy === 'rsi' ? 15 : Math.max(smaPeriod, emaPeriod);
    if (klines.length <= minNeeded) {
      return reply.status(422).send({
        error: { code: ERROR_CODES.NO_DATA, message: `Insufficient data for backtest (need > ${minNeeded} klines)` },
      });
    }

    return reply.send(
      strategy === 'rsi'
        ? runRSI(symbol, interval, klines)
        : runMACross(symbol, interval, klines, { smaPeriod, emaPeriod }),
    );
  });
}
