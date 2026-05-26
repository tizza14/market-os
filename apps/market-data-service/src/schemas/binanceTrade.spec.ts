import { describe, it, expect } from 'vitest';
import { BinanceTradeSchema } from './binanceTrade.js';

const valid = {
  e: 'trade' as const,
  E: 1748131200000,
  s: 'BTCUSDT',
  t: 123456789,
  p: '104523.45',
  q: '0.00123456',
  b: 88,
  a: 50,
  m: false,
};

describe('BinanceTradeSchema', () => {
  it('合法 payload → 正確對應所有欄位', () => {
    const result = BinanceTradeSchema.parse(valid);
    expect(result.E).toBe(1748131200000);
    expect(result.s).toBe('BTCUSDT');
    expect(result.t).toBe(123456789);
    expect(result.p).toBe('104523.45');
    expect(result.q).toBe('0.00123456');
    expect(result.m).toBe(false);
  });

  it('event type 非 "trade" → 拋出 ZodError', () => {
    expect(() => BinanceTradeSchema.parse({ ...valid, e: 'kline' })).toThrow();
  });

  it('缺少必要欄位 tradeId (t) → 拋出 ZodError', () => {
    const { t: _t, ...rest } = valid;
    expect(() => BinanceTradeSchema.parse(rest)).toThrow();
  });

  it('price 為 number 而非 string → 拋出 ZodError', () => {
    expect(() => BinanceTradeSchema.parse({ ...valid, p: 104523.45 })).toThrow();
  });

  it('eventTime 為 string 而非 number → 拋出 ZodError', () => {
    expect(() => BinanceTradeSchema.parse({ ...valid, E: '1748131200000' })).toThrow();
  });

  it('isBuyerMaker (m) 為 string "false" → 拋出 ZodError', () => {
    expect(() => BinanceTradeSchema.parse({ ...valid, m: 'false' })).toThrow();
  });
});
