import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { TwStockKline } from '@market-os/shared-types';
import { calcIndicators } from '../services/indicatorService.js';
import { runMACrossTw, runRSITw, runOptimizeTw } from '../services/backtestService.js';

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
  days:   z.coerce.number().int().min(1).max(500).default(120),
});

const TwOptimizeQuerySchema = z.object({
  symbol:  z.string().min(1).max(10),
  days:    z.coerce.number().int().min(1).max(500).default(240),
  smaMin:  z.coerce.number().int().min(5).max(95).default(10),
  smaMax:  z.coerce.number().int().min(10).max(100).default(50),
  smaStep: z.coerce.number().int().min(1).max(20).default(5),
  emaMin:  z.coerce.number().int().min(5).max(95).default(10),
  emaMax:  z.coerce.number().int().min(10).max(100).default(50),
  emaStep: z.coerce.number().int().min(1).max(20).default(5),
  metric:  z.enum(['totalReturn', 'winRate', 'sharpeRatio']).default('totalReturn'),
});

const BacktestQuerySchema = z.object({
  symbol:    z.string().min(1).max(10),
  days:      z.coerce.number().int().min(1).max(500).default(240),
  smaPeriod: z.coerce.number().int().min(5).max(100).default(20),
  emaPeriod: z.coerce.number().int().min(5).max(100).default(20),
  strategy:  z.enum(['ma_cross', 'rsi']).default('ma_cross'),
});

async function fetchKlines(symbol: string, days: number, token: string): Promise<TwStockKline[] | null> {
  const startDate = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const u = new URL(FINMIND_URL);
  u.searchParams.set('dataset',  'TaiwanStockPrice');
  u.searchParams.set('data_id',  symbol);
  u.searchParams.set('start_date', startDate);
  u.searchParams.set('token',    token);

  try {
    const res = await fetch(u.toString());
    if (!res.ok) return null;
    const body = (await res.json()) as FinMindResponse;
    if (body.status !== 200) return null;
    return body.data.map((r) => ({
      date:     r.date,
      stockId:  r.stock_id,
      open:     r.open,
      high:     r.max,
      low:      r.min,
      close:    r.close,
      spread:   r.spread,
      volume:   r.Trading_Volume,
      turnover: r.Trading_turnover,
    }));
  } catch {
    return null;
  }
}

export interface TwStockDeps {
  finmindToken: string;
}

export function registerTwStockRoutes(fastify: FastifyInstance, deps: TwStockDeps): void {
  fastify.get('/api/tw-stock/klines', async (req, reply) => {
    const result = QuerySchema.safeParse(req.query);
    if (!result.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters' } });
    }

    const { symbol, days } = result.data;
    const [infoMap, klines] = await Promise.all([
      getStockInfoMap(deps.finmindToken),
      fetchKlines(symbol, days, deps.finmindToken),
    ]);

    if (!klines) {
      return reply.status(502).send({ error: { code: 'UPSTREAM_ERROR', message: 'FinMind unreachable' } });
    }

    const info       = infoMap.get(symbol);
    const closes     = klines.map((k) => k.close);
    const indicators = calcIndicators(closes);

    return reply.send({
      symbol,
      companyName: info?.name ?? symbol,
      industry:    info?.industry ?? '',
      data:        klines,
      indicators,
    });
  });

  fastify.get('/api/tw-stock/backtest', async (req, reply) => {
    const result = BacktestQuerySchema.safeParse(req.query);
    if (!result.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters' } });
    }

    const { symbol, days, smaPeriod, emaPeriod, strategy } = result.data;
    const klines = await fetchKlines(symbol, days, deps.finmindToken);

    if (!klines) {
      return reply.status(502).send({ error: { code: 'UPSTREAM_ERROR', message: 'FinMind unreachable' } });
    }
    const minNeeded = strategy === 'rsi' ? 15 : Math.max(smaPeriod, emaPeriod);
    if (klines.length <= minNeeded) {
      return reply.status(422).send({ error: { code: 'NO_DATA', message: 'Insufficient data for backtest' } });
    }

    return reply.send(
      strategy === 'rsi'
        ? runRSITw(symbol, klines)
        : runMACrossTw(symbol, klines, { smaPeriod, emaPeriod }),
    );
  });

  fastify.get('/api/tw-stock/optimize', async (req, reply) => {
    const result = TwOptimizeQuerySchema.safeParse(req.query);
    if (!result.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters' } });
    }

    const { symbol, days, smaMin, smaMax, smaStep, emaMin, emaMax, emaStep, metric } = result.data;
    const klines = await fetchKlines(symbol, days, deps.finmindToken);

    if (!klines) {
      return reply.status(502).send({ error: { code: 'UPSTREAM_ERROR', message: 'FinMind unreachable' } });
    }
    if (klines.length <= smaMax) {
      return reply.status(422).send({ error: { code: 'NO_DATA', message: 'Insufficient data for optimization' } });
    }

    return reply.send(runOptimizeTw(symbol, klines, { smaMin, smaMax, smaStep, emaMin, emaMax, emaStep, metric }));
  });
}
