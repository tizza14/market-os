import { describe, it, expect } from 'vitest';
import { findCrossovers, findRSISignals, buildTrades, calcMetrics, runOptimize } from './backtestService.js';
import type { Kline } from '@market-os/shared-types';

function makeKlines(closes: number[]): Kline[] {
  return closes.map((c, i) => ({
    openTime:   i * 60_000,
    closeTime:  i * 60_000 + 59_999,
    open:  String(c),
    high:  String(c + 1),
    low:   String(c - 1),
    close: String(c),
    volume: '1.00000000',
    tradeCount: 10,
  }));
}

// null × n helper
const N = (n: number): null[] => Array(n).fill(null);

describe('findCrossovers', () => {
  it('EMA 上穿 SMA → buy 訊號', () => {
    const sma = [...N(19), 100, 100, 100];
    const ema = [...N(19), 99,  101, 101];
    const sigs = findCrossovers(sma, ema);
    expect(sigs).toHaveLength(1);
    expect(sigs[0]!.type).toBe('buy');
    expect(sigs[0]!.index).toBe(20);
  });

  it('EMA 下穿 SMA → sell 訊號', () => {
    const sma = [...N(19), 100, 100, 100];
    const ema = [...N(19), 101,  99,  99];
    const sigs = findCrossovers(sma, ema);
    expect(sigs[0]!.type).toBe('sell');
  });

  it('無交叉 → 空陣列', () => {
    const sma = [...N(19), 100, 100];
    const ema = [...N(19),  99,  99];
    expect(findCrossovers(sma, ema)).toHaveLength(0);
  });

  it('null 區段不產生訊號', () => {
    const sma = [...N(20)];
    const ema = [...N(20)];
    expect(findCrossovers(sma, ema)).toHaveLength(0);
  });

  it('交叉後反向 → 兩個訊號', () => {
    const sma = [...N(19), 100, 100, 100, 100];
    const ema = [...N(19),  99, 101, 101,  99];
    const sigs = findCrossovers(sma, ema);
    expect(sigs).toHaveLength(2);
    expect(sigs[0]!.type).toBe('buy');
    expect(sigs[1]!.type).toBe('sell');
  });
});

describe('findRSISignals', () => {
  it('RSI 從 ≤30 升破 30 → buy 訊號', () => {
    const rsi = [...N(14), 28, 32, 35];
    const sigs = findRSISignals(rsi);
    expect(sigs).toHaveLength(1);
    expect(sigs[0]!.type).toBe('buy');
    expect(sigs[0]!.index).toBe(15);
  });

  it('RSI 從 ≥70 跌破 70 → sell 訊號', () => {
    const rsi = [...N(14), 72, 68, 65];
    const sigs = findRSISignals(rsi);
    expect(sigs).toHaveLength(1);
    expect(sigs[0]!.type).toBe('sell');
  });

  it('RSI 未觸及閾值 → 空陣列', () => {
    const rsi = [...N(14), 45, 50, 55];
    expect(findRSISignals(rsi)).toHaveLength(0);
  });

  it('null 區段不產生訊號', () => {
    const rsi = [...N(17)];
    expect(findRSISignals(rsi)).toHaveLength(0);
  });
});

describe('buildTrades', () => {
  it('buy → sell → 一筆完整 trade', () => {
    const closes = [...Array(22).keys()].map(() => 100);
    closes[20] = 100;
    closes[21] = 110;
    const klines = makeKlines(closes);
    const raw = [{ type: 'buy' as const, index: 20 }, { type: 'sell' as const, index: 21 }];
    const trades = buildTrades(raw, klines);
    expect(trades).toHaveLength(1);
    expect(trades[0]!.pnl).toBe(10);
    expect(trades[0]!.isWin).toBe(true);
  });

  it('連續兩個 buy → 忽略第二個 buy', () => {
    const klines = makeKlines(Array(30).fill(100));
    const raw = [
      { type: 'buy'  as const, index: 20 },
      { type: 'buy'  as const, index: 22 },
      { type: 'sell' as const, index: 25 },
    ];
    expect(buildTrades(raw, klines)).toHaveLength(1);
  });

  it('sell 先出現（無對應 buy）→ 忽略', () => {
    const klines = makeKlines(Array(25).fill(100));
    const raw = [{ type: 'sell' as const, index: 20 }];
    expect(buildTrades(raw, klines)).toHaveLength(0);
  });

  it('虧損交易 → isWin=false，pnl 為負', () => {
    const closes = Array(22).fill(100);
    closes[21] = 90;
    const klines = makeKlines(closes);
    const raw = [{ type: 'buy' as const, index: 20 }, { type: 'sell' as const, index: 21 }];
    const trades = buildTrades(raw, klines);
    expect(trades[0]!.isWin).toBe(false);
    expect(trades[0]!.pnl).toBeLessThan(0);
  });
});

describe('calcMetrics', () => {
  it('空 trades → 全部歸零，equityCurve 為空', () => {
    const { metrics, equityCurve } = calcMetrics([]);
    expect(metrics.totalReturn).toBe(0);
    expect(metrics.tradeCount).toBe(0);
    expect(metrics.winRate).toBe(0);
    expect(metrics.sharpeRatio).toBe(0);
    expect(metrics.calmarRatio).toBe(0);
    expect(equityCurve).toHaveLength(0);
  });

  it('全勝 → winRate=100，equityCurve 長度 = trades+1', () => {
    const trades = [
      { buyTime: 0, buyPrice: 100, sellTime: 1, sellPrice: 110, pnl: 10, isWin: true },
      { buyTime: 2, buyPrice: 110, sellTime: 3, sellPrice: 121, pnl: 10, isWin: true },
    ];
    const { metrics, equityCurve } = calcMetrics(trades);
    expect(metrics.winRate).toBe(100);
    expect(metrics.tradeCount).toBe(2);
    expect(metrics.totalReturn).toBeGreaterThan(0);
    expect(equityCurve).toHaveLength(3); // initial + 2 trades
    expect(equityCurve[0]!.equity).toBe(1);
    expect(equityCurve[2]!.equity).toBeGreaterThan(1);
  });

  it('maxDrawdown 在連續虧損時為負', () => {
    const trades = [
      { buyTime: 0, buyPrice: 100, sellTime: 1, sellPrice: 90,  pnl: -10, isWin: false },
      { buyTime: 2, buyPrice: 90,  sellTime: 3, sellPrice: 81,  pnl: -10, isWin: false },
    ];
    const { metrics } = calcMetrics(trades);
    expect(metrics.maxDrawdown).toBeLessThan(0);
    expect(metrics.totalReturn).toBeLessThan(0);
  });

  it('sharpeRatio > 0 當平均報酬為正', () => {
    const trades = [
      { buyTime: 0, buyPrice: 100, sellTime: 1, sellPrice: 108, pnl: 8,  isWin: true },
      { buyTime: 2, buyPrice: 108, sellTime: 3, sellPrice: 112, pnl: 4,  isWin: true },
      { buyTime: 4, buyPrice: 112, sellTime: 5, sellPrice: 116, pnl: 4,  isWin: true },
    ];
    const { metrics } = calcMetrics(trades);
    expect(metrics.sharpeRatio).toBeGreaterThan(0);
  });

  it('calmarRatio > 0 當有回撤且總報酬為正', () => {
    const trades = [
      { buyTime: 0, buyPrice: 100, sellTime: 1, sellPrice: 120, pnl: 20,  isWin: true  },
      { buyTime: 2, buyPrice: 120, sellTime: 3, sellPrice: 108, pnl: -10, isWin: false },
      { buyTime: 4, buyPrice: 108, sellTime: 5, sellPrice: 130, pnl: 20,  isWin: true  },
    ];
    const { metrics } = calcMetrics(trades);
    expect(metrics.calmarRatio).toBeGreaterThan(0);
    expect(metrics.maxDrawdown).toBeLessThan(0);
  });

  it('無回撤時 calmarRatio = 0', () => {
    const trades = [
      { buyTime: 0, buyPrice: 100, sellTime: 1, sellPrice: 110, pnl: 10, isWin: true },
    ];
    const { metrics } = calcMetrics(trades);
    expect(metrics.calmarRatio).toBe(0);
  });
});

describe('runOptimize', () => {
  const closes = [
    100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
    100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
     99, 101, 101, 101, 101, 101, 101, 101, 101, 101,
    101, 101, 101, 101, 101, 101, 101, 101, 101, 101,
    101, 101, 101, 101, 101,  99,  99,  99,  99,  99,
  ];
  const klines = makeKlines(closes);
  const opts = { smaMin: 10, smaMax: 20, smaStep: 5, emaMin: 10, emaMax: 20, emaStep: 5, metric: 'totalReturn' as const };

  it('回傳正確的 smaValues / emaValues', () => {
    const r = runOptimize('BTCUSDT', '1h', klines, opts);
    expect(r.smaValues).toEqual([10, 15, 20]);
    expect(r.emaValues).toEqual([10, 15, 20]);
  });

  it('data 長度 = smaValues × emaValues', () => {
    const r = runOptimize('BTCUSDT', '1h', klines, opts);
    expect(r.data).toHaveLength(r.smaValues.length * r.emaValues.length);
  });

  it('best 的值是 data 中最大的', () => {
    const r = runOptimize('BTCUSDT', '1h', klines, opts);
    const maxVal = Math.max(...r.data.map((d) => d[2]));
    expect(r.best.value).toBe(maxVal);
  });
});
