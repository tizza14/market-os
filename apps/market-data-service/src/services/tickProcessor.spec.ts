import { describe, it, expect } from 'vitest';
import { formatTick } from './tickProcessor.js';
import type { BinanceTrade } from '../schemas/binanceTrade.js';

const trade: BinanceTrade = {
  e: 'trade',
  E: 1748131200000,
  s: 'BTCUSDT',
  t: 123,
  p: '104523.45',
  q: '0.00123456',
  b: 1,
  a: 2,
  m: false,
};

describe('formatTick', () => {
  it('正確對應欄位名稱（Binance 欄位 → 內部欄位）', () => {
    const tick = formatTick(trade);
    expect(tick.eventTime).toBe(trade.E);
    expect(tick.symbol).toBe('BTCUSDT');
    expect(tick.tradeId).toBe(trade.t);
    expect(tick.price).toBe(trade.p);
    expect(tick.quantity).toBe(trade.q);
    expect(tick.buyerOrderId).toBe(trade.b);
    expect(tick.sellerOrderId).toBe(trade.a);
    expect(tick.isBuyerMaker).toBe(trade.m);
  });

  it('symbol 轉為大寫', () => {
    const tick = formatTick({ ...trade, s: 'btcusdt' });
    expect(tick.symbol).toBe('BTCUSDT');
  });

  it('price / quantity 維持 string 型別（不轉 number）', () => {
    const tick = formatTick(trade);
    expect(typeof tick.price).toBe('string');
    expect(typeof tick.quantity).toBe('string');
  });
});
