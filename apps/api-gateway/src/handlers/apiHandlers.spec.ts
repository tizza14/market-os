import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import type { AppDeps } from '../app.js';
import type { MarketBroadcast } from '../services/marketBroadcast.js';

function mockBroadcast(connected = true): MarketBroadcast {
  return {
    connected,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  } as unknown as MarketBroadcast;
}

function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    mongoConnected: () => true,
    redisConnected: () => true,
    broadcast: mockBroadcast(),
    finmindToken: '',
    findLatestTick: vi.fn().mockResolvedValue({
      symbol: 'BTCUSDT',
      price: '104523.45',
      quantity: '0.00123456',
      eventTime: 1748131200000,
    }),
    findKlines: vi.fn().mockResolvedValue([
      {
        openTime: 1748131200000,
        closeTime: 1748131259999,
        open: '104000.00',
        high: '104523.45',
        low: '103800.00',
        close: '104200.00',
        volume: '12.34567890',
        tradeCount: 145,
      },
    ]),
    ...overrides,
  };
}

describe('GET /api/health', () => {
  it('Redis + MongoDB 均連線 → 200 status:ok', async () => {
    const app = await buildApp(makeDeps(), { logger: false });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ status: string; services: { mongo: string; redis: string } }>();
    expect(body.status).toBe('ok');
    expect(body.services.mongo).toBe('connected');
    expect(body.services.redis).toBe('connected');
    await app.close();
  });

  it('Redis 斷線 → 503 status:degraded', async () => {
    const app = await buildApp(makeDeps({ redisConnected: () => false }), { logger: false });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(503);
    const body = res.json<{ status: string; services: { redis: string } }>();
    expect(body.status).toBe('degraded');
    expect(body.services.redis).toBe('disconnected');
    await app.close();
  });
});

describe('GET /api/market/latest', () => {
  it('有資料 → 200，回傳 symbol/price/quantity/eventTime', async () => {
    const app = await buildApp(makeDeps(), { logger: false });
    const res = await app.inject({ method: 'GET', url: '/api/market/latest' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ symbol: string; price: string }>();
    expect(body.symbol).toBe('BTCUSDT');
    expect(body.price).toBe('104523.45');
    await app.close();
  });

  it('無資料（DB 空）→ 404 NO_DATA', async () => {
    const app = await buildApp(
      makeDeps({ findLatestTick: vi.fn().mockResolvedValue(null) }),
      { logger: false },
    );
    const res = await app.inject({ method: 'GET', url: '/api/market/latest' });
    expect(res.statusCode).toBe(404);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('NO_DATA');
    await app.close();
  });
});

describe('GET /api/market/klines', () => {
  it('預設參數 → 200，回傳 data 陣列', async () => {
    const app = await buildApp(makeDeps(), { logger: false });
    const res = await app.inject({ method: 'GET', url: '/api/market/klines' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ symbol: string; data: unknown[] }>();
    expect(body.symbol).toBe('BTCUSDT');
    expect(Array.isArray(body.data)).toBe(true);
    await app.close();
  });

  it('limit=200 → findKlines 被呼叫帶 limit=200', async () => {
    const findKlines = vi.fn().mockResolvedValue([]);
    const app = await buildApp(makeDeps({ findKlines }), { logger: false });
    await app.inject({ method: 'GET', url: '/api/market/klines?limit=200' });
    expect(findKlines).toHaveBeenCalledWith('BTCUSDT', '1m', 200);
    await app.close();
  });

  it('limit=0 → 400 VALIDATION_ERROR', async () => {
    const app = await buildApp(makeDeps(), { logger: false });
    const res = await app.inject({ method: 'GET', url: '/api/market/klines?limit=0' });
    expect(res.statusCode).toBe(400);
    const body = res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });

  it('limit=501 → 400 VALIDATION_ERROR', async () => {
    const app = await buildApp(makeDeps(), { logger: false });
    const res = await app.inject({ method: 'GET', url: '/api/market/klines?limit=501' });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: { code: string } }>().error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });

  it('limit=abc（非數字）→ 400 VALIDATION_ERROR', async () => {
    const app = await buildApp(makeDeps(), { logger: false });
    const res = await app.inject({ method: 'GET', url: '/api/market/klines?limit=abc' });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: { code: string } }>().error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });

  it('symbol=ETHUSDT（不支援）→ 400 VALIDATION_ERROR', async () => {
    const app = await buildApp(makeDeps(), { logger: false });
    const res = await app.inject({ method: 'GET', url: '/api/market/klines?symbol=ETHUSDT' });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: { code: string } }>().error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });
});

describe('未定義路由', () => {
  it('404 回應', async () => {
    const app = await buildApp(makeDeps(), { logger: false });
    const res = await app.inject({ method: 'GET', url: '/api/nonexistent' });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

// suppress unused warning
void beforeEach;
