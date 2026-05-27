import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { TwStockKline } from '@market-os/shared-types';

const FINMIND_URL = 'https://api.finmindtrade.com/api/v4/data';

const QuerySchema = z.object({
  symbol: z.string().min(1).max(10),
  days: z.coerce.number().int().min(1).max(500).default(120),
});

interface FinMindRecord {
  date: string;
  stock_id: string;
  open: number;
  max: number;
  min: number;
  close: number;
  spread: number;
  Trading_Volume: number;
  Trading_turnover: number;
}

interface FinMindResponse {
  status: number;
  msg: string;
  data: FinMindRecord[];
}

export interface TwStockDeps {
  finmindToken: string;
}

export function registerTwStockRoutes(fastify: FastifyInstance, deps: TwStockDeps): void {
  fastify.get('/api/tw-stock/klines', async (req, reply) => {
    const result = QuerySchema.safeParse(req.query);
    if (!result.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters' },
      });
    }

    const { symbol, days } = result.data;
    const startDate = new Date(Date.now() - days * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const url = new URL(FINMIND_URL);
    url.searchParams.set('dataset', 'TaiwanStockPrice');
    url.searchParams.set('data_id', symbol);
    url.searchParams.set('start_date', startDate);
    url.searchParams.set('token', deps.finmindToken);

    let body: FinMindResponse;
    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        return reply.status(502).send({ error: { code: 'UPSTREAM_ERROR', message: 'FinMind request failed' } });
      }
      body = (await res.json()) as FinMindResponse;
    } catch {
      return reply.status(502).send({ error: { code: 'UPSTREAM_ERROR', message: 'FinMind unreachable' } });
    }

    if (body.status !== 200) {
      return reply.status(502).send({ error: { code: 'UPSTREAM_ERROR', message: body.msg } });
    }

    const klines: TwStockKline[] = body.data.map((r) => ({
      date: r.date,
      stockId: r.stock_id,
      open: r.open,
      high: r.max,
      low: r.min,
      close: r.close,
      spread: r.spread,
      volume: r.Trading_Volume,
      turnover: r.Trading_turnover,
    }));

    return reply.send({ symbol, data: klines });
  });
}
