import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { TwStockKline } from '@market-os/shared-types';

const FINMIND_URL = 'https://api.finmindtrade.com/api/v4/data';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface StockInfo {
  name: string;
  industry: string;
}

interface StockInfoRecord {
  stock_id: string;
  stock_name: string;
  industry_category: string;
}

interface StockInfoResponse {
  status: number;
  msg: string;
  data: StockInfoRecord[];
}

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

let infoCache: Map<string, StockInfo> | null = null;
let infoCacheTime = 0;

async function getStockInfoMap(token: string): Promise<Map<string, StockInfo>> {
  if (infoCache && Date.now() - infoCacheTime < CACHE_TTL_MS) return infoCache;

  const url = new URL(FINMIND_URL);
  url.searchParams.set('dataset', 'TaiwanStockInfo');
  url.searchParams.set('token', token);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return infoCache ?? new Map();
    const body = (await res.json()) as StockInfoResponse;
    if (body.status !== 200) return infoCache ?? new Map();

    infoCache = new Map(
      body.data.map((r) => [r.stock_id, { name: r.stock_name, industry: r.industry_category }]),
    );
    infoCacheTime = Date.now();
  } catch {
    // return stale cache if available
  }
  return infoCache ?? new Map();
}

const QuerySchema = z.object({
  symbol: z.string().min(1).max(10),
  days: z.coerce.number().int().min(1).max(500).default(120),
});

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
    const startDate = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

    const [infoMap, priceRes] = await Promise.allSettled([
      getStockInfoMap(deps.finmindToken),
      fetch(
        (() => {
          const u = new URL(FINMIND_URL);
          u.searchParams.set('dataset', 'TaiwanStockPrice');
          u.searchParams.set('data_id', symbol);
          u.searchParams.set('start_date', startDate);
          u.searchParams.set('token', deps.finmindToken);
          return u.toString();
        })(),
      ),
    ]);

    if (priceRes.status === 'rejected') {
      return reply.status(502).send({ error: { code: 'UPSTREAM_ERROR', message: 'FinMind unreachable' } });
    }

    const res = priceRes.value;
    if (!res.ok) {
      return reply.status(502).send({ error: { code: 'UPSTREAM_ERROR', message: 'FinMind request failed' } });
    }

    const body = (await res.json()) as FinMindResponse;
    if (body.status !== 200) {
      return reply.status(502).send({ error: { code: 'UPSTREAM_ERROR', message: body.msg } });
    }

    const info = infoMap.status === 'fulfilled' ? infoMap.value.get(symbol) : undefined;

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

    return reply.send({
      symbol,
      companyName: info?.name ?? symbol,
      industry: info?.industry ?? '',
      data: klines,
    });
  });
}
