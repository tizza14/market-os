import type { Kline, TwStockKline, TradeSignal, BacktestTrade, BacktestMetrics, BacktestResult, EquityPoint, OptimizeResult, OptimizeCell } from '@market-os/shared-types';
import type { OptimizeMetric } from '../schemas/queryParams.js';
import { calcSMA, calcEMA, calcRSI } from './indicatorService.js';

const RSI_PERIOD = 14;
const RSI_OVERSOLD  = 30;
const RSI_OVERBOUGHT = 70;

export function twDateToMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

interface RawSignal {
  type: 'buy' | 'sell';
  index: number;
}

export interface BacktestOptions {
  smaPeriod: number;
  emaPeriod: number;
}

const DEFAULT_OPTS: BacktestOptions = { smaPeriod: 20, emaPeriod: 20 };

export function findRSISignals(rsi: (number | null)[]): RawSignal[] {
  const signals: RawSignal[] = [];
  for (let i = 1; i < rsi.length; i++) {
    const prev = rsi[i - 1] ?? null, curr = rsi[i] ?? null;
    if (prev === null || curr === null) continue;
    // buy: RSI recovers above oversold threshold
    if (prev <= RSI_OVERSOLD  && curr > RSI_OVERSOLD)  signals.push({ type: 'buy',  index: i });
    // sell: RSI recovers below overbought threshold
    if (prev >= RSI_OVERBOUGHT && curr < RSI_OVERBOUGHT) signals.push({ type: 'sell', index: i });
  }
  return signals;
}

export function findCrossovers(sma: (number | null)[], ema: (number | null)[]): RawSignal[] {
  const signals: RawSignal[] = [];
  for (let i = 1; i < sma.length; i++) {
    const ps = sma[i - 1] ?? null, pe = ema[i - 1] ?? null;
    const cs = sma[i]     ?? null, ce = ema[i]     ?? null;
    if (ps === null || pe === null || cs === null || ce === null) continue;
    if (pe <= ps && ce > cs) signals.push({ type: 'buy',  index: i });
    if (pe >= ps && ce < cs) signals.push({ type: 'sell', index: i });
  }
  return signals;
}

export function buildTrades(raw: RawSignal[], klines: Kline[]): BacktestTrade[] {
  const trades: BacktestTrade[] = [];
  let openBuy: RawSignal | null = null;
  for (const sig of raw) {
    if (sig.type === 'buy' && openBuy === null) {
      openBuy = sig;
    } else if (sig.type === 'sell' && openBuy !== null) {
      const bk = klines[openBuy.index]!, sk = klines[sig.index]!;
      const buyPrice = parseFloat(bk.close), sellPrice = parseFloat(sk.close);
      const pnl = round2((sellPrice / buyPrice - 1) * 100);
      trades.push({ buyTime: bk.openTime, buyPrice, sellTime: sk.openTime, sellPrice, pnl, isWin: pnl > 0 });
      openBuy = null;
    }
  }
  return trades;
}

export function calcMetrics(trades: BacktestTrade[]): { metrics: BacktestMetrics; equityCurve: EquityPoint[] } {
  if (trades.length === 0) {
    return {
      metrics:      { totalReturn: 0, tradeCount: 0, winRate: 0, maxDrawdown: 0, avgReturn: 0, sharpeRatio: 0, calmarRatio: 0 },
      equityCurve:  [],
    };
  }

  const wins       = trades.filter((t) => t.isWin).length;
  const winRate    = round2((wins / trades.length) * 100);
  const pnls       = trades.map((t) => t.pnl);
  const avgReturn  = round2(pnls.reduce((s, v) => s + v, 0) / pnls.length);

  let equity = 1, peak = 1, maxDrawdown = 0;
  const equityCurve: EquityPoint[] = [{ time: trades[0]!.buyTime, equity: 1 }];

  for (const t of trades) {
    equity *= 1 + t.pnl / 100;
    if (equity > peak) peak = equity;
    const dd = (equity - peak) / peak * 100;
    if (dd < maxDrawdown) maxDrawdown = dd;
    equityCurve.push({ time: t.sellTime, equity: round2(equity) });
  }

  const totalReturn  = round2((equity - 1) * 100);
  const stdDev       = stddev(pnls);
  const sharpeRatio  = round2(stdDev === 0 ? 0 : avgReturn / stdDev);
  const calmarRatio  = round2(maxDrawdown === 0 ? 0 : totalReturn / Math.abs(maxDrawdown));

  return {
    metrics:     { totalReturn, tradeCount: trades.length, winRate, maxDrawdown: round2(maxDrawdown), avgReturn, sharpeRatio, calmarRatio },
    equityCurve,
  };
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function runMACross(symbol: string, interval: string, klines: Kline[], opts: BacktestOptions = DEFAULT_OPTS): BacktestResult {
  const closes     = klines.map((k) => parseFloat(k.close));
  const rawSignals = findCrossovers(calcSMA(closes, opts.smaPeriod), calcEMA(closes, opts.emaPeriod));
  const trades     = buildTrades(rawSignals, klines);
  const { metrics, equityCurve } = calcMetrics(trades);

  const signals: TradeSignal[] = rawSignals.map((s) => ({
    type: s.type, time: klines[s.index]!.openTime, price: parseFloat(klines[s.index]!.close),
  }));

  return {
    symbol, interval, strategy: 'ma_cross',
    from: klines[0]?.openTime ?? 0,
    to:   klines[klines.length - 1]?.closeTime ?? 0,
    metrics, trades, signals, equityCurve,
  };
}

export function runMACrossTw(symbol: string, twKlines: TwStockKline[], opts: BacktestOptions = DEFAULT_OPTS): BacktestResult {
  const closes     = twKlines.map((k) => k.close);
  const rawSignals = findCrossovers(calcSMA(closes, opts.smaPeriod), calcEMA(closes, opts.emaPeriod));

  const trades: BacktestTrade[] = [];
  let openBuy: { index: number } | null = null;
  for (const sig of rawSignals) {
    if (sig.type === 'buy' && openBuy === null) {
      openBuy = sig;
    } else if (sig.type === 'sell' && openBuy !== null) {
      const bk = twKlines[openBuy.index]!, sk = twKlines[sig.index]!;
      const pnl = round2((sk.close / bk.close - 1) * 100);
      trades.push({ buyTime: twDateToMs(bk.date), buyPrice: bk.close, sellTime: twDateToMs(sk.date), sellPrice: sk.close, pnl, isWin: pnl > 0 });
      openBuy = null;
    }
  }

  const { metrics, equityCurve } = calcMetrics(trades);
  const signals: TradeSignal[] = rawSignals.map((s) => ({
    type: s.type, time: twDateToMs(twKlines[s.index]!.date), price: twKlines[s.index]!.close,
  }));

  return {
    symbol, interval: 'day', strategy: 'ma_cross',
    from: twKlines[0]      ? twDateToMs(twKlines[0].date)                                    : 0,
    to:   twKlines[twKlines.length - 1] ? twDateToMs(twKlines[twKlines.length - 1]!.date) : 0,
    metrics, trades, signals, equityCurve,
  };
}

export interface OptimizeOptions {
  smaMin: number; smaMax: number; smaStep: number;
  emaMin: number; emaMax: number; emaStep: number;
  metric: OptimizeMetric;
}

function range(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  for (let v = min; v <= max; v += step) out.push(v);
  return out;
}

function pickMetric(metrics: BacktestMetrics, key: OptimizeMetric): number {
  return metrics[key];
}

export function runOptimize(symbol: string, interval: string, klines: Kline[], opts: OptimizeOptions): OptimizeResult {
  const closes   = klines.map((k) => parseFloat(k.close));
  const smaValues = range(opts.smaMin, opts.smaMax, opts.smaStep);
  const emaValues = range(opts.emaMin, opts.emaMax, opts.emaStep);
  const data: [number, number, number][] = [];
  let best: OptimizeCell = { smaPeriod: smaValues[0]!, emaPeriod: emaValues[0]!, value: -Infinity };

  for (let si = 0; si < smaValues.length; si++) {
    for (let ei = 0; ei < emaValues.length; ei++) {
      const smaPeriod = smaValues[si]!, emaPeriod = emaValues[ei]!;
      const rawSignals = findCrossovers(calcSMA(closes, smaPeriod), calcEMA(closes, emaPeriod));
      const { metrics } = calcMetrics(buildTrades(rawSignals, klines));
      const value = round2(pickMetric(metrics, opts.metric));
      data.push([si, ei, value]);
      if (value > best.value) best = { smaPeriod, emaPeriod, value };
    }
  }

  return { symbol, interval, metric: opts.metric, smaValues, emaValues, data, best };
}

export function runOptimizeTw(symbol: string, twKlines: TwStockKline[], opts: OptimizeOptions): OptimizeResult {
  const closes    = twKlines.map((k) => k.close);
  const smaValues = range(opts.smaMin, opts.smaMax, opts.smaStep);
  const emaValues = range(opts.emaMin, opts.emaMax, opts.emaStep);
  const data: [number, number, number][] = [];
  let best: OptimizeCell = { smaPeriod: smaValues[0]!, emaPeriod: emaValues[0]!, value: -Infinity };

  for (let si = 0; si < smaValues.length; si++) {
    for (let ei = 0; ei < emaValues.length; ei++) {
      const smaPeriod = smaValues[si]!, emaPeriod = emaValues[ei]!;
      const rawSignals = findCrossovers(calcSMA(closes, smaPeriod), calcEMA(closes, emaPeriod));

      const trades: BacktestTrade[] = [];
      let openBuy: { index: number } | null = null;
      for (const sig of rawSignals) {
        if (sig.type === 'buy' && openBuy === null) { openBuy = sig; }
        else if (sig.type === 'sell' && openBuy !== null) {
          const bk = twKlines[openBuy.index]!, sk = twKlines[sig.index]!;
          const pnl = round2((sk.close / bk.close - 1) * 100);
          trades.push({ buyTime: twDateToMs(bk.date), buyPrice: bk.close, sellTime: twDateToMs(sk.date), sellPrice: sk.close, pnl, isWin: pnl > 0 });
          openBuy = null;
        }
      }

      const { metrics } = calcMetrics(trades);
      const value = round2(pickMetric(metrics, opts.metric));
      data.push([si, ei, value]);
      if (value > best.value) best = { smaPeriod, emaPeriod, value };
    }
  }

  return { symbol, interval: 'day', metric: opts.metric, smaValues, emaValues, data, best };
}

export function runRSI(symbol: string, interval: string, klines: Kline[]): BacktestResult {
  const closes     = klines.map((k) => parseFloat(k.close));
  const rawSignals = findRSISignals(calcRSI(closes, RSI_PERIOD));
  const trades     = buildTrades(rawSignals, klines);
  const { metrics, equityCurve } = calcMetrics(trades);

  const signals: TradeSignal[] = rawSignals.map((s) => ({
    type: s.type, time: klines[s.index]!.openTime, price: parseFloat(klines[s.index]!.close),
  }));

  return {
    symbol, interval, strategy: 'rsi',
    from: klines[0]?.openTime ?? 0,
    to:   klines[klines.length - 1]?.closeTime ?? 0,
    metrics, trades, signals, equityCurve,
  };
}

export function runRSITw(symbol: string, twKlines: TwStockKline[]): BacktestResult {
  const closes     = twKlines.map((k) => k.close);
  const rawSignals = findRSISignals(calcRSI(closes, RSI_PERIOD));

  const trades: BacktestTrade[] = [];
  let openBuy: { index: number } | null = null;
  for (const sig of rawSignals) {
    if (sig.type === 'buy' && openBuy === null) {
      openBuy = sig;
    } else if (sig.type === 'sell' && openBuy !== null) {
      const bk = twKlines[openBuy.index]!, sk = twKlines[sig.index]!;
      const pnl = round2((sk.close / bk.close - 1) * 100);
      trades.push({ buyTime: twDateToMs(bk.date), buyPrice: bk.close, sellTime: twDateToMs(sk.date), sellPrice: sk.close, pnl, isWin: pnl > 0 });
      openBuy = null;
    }
  }

  const { metrics, equityCurve } = calcMetrics(trades);
  const signals: TradeSignal[] = rawSignals.map((s) => ({
    type: s.type, time: twDateToMs(twKlines[s.index]!.date), price: twKlines[s.index]!.close,
  }));

  return {
    symbol, interval: 'day', strategy: 'rsi',
    from: twKlines[0]       ? twDateToMs(twKlines[0].date)                           : 0,
    to:   twKlines[twKlines.length - 1] ? twDateToMs(twKlines[twKlines.length - 1]!.date) : 0,
    metrics, trades, signals, equityCurve,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
