import type { IndicatorResult } from '@market-os/shared-types';

export function calcSMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const sum = closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    return round2(sum / period);
  });
}

export function calcEMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period) return result;

  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = round2(ema);

  for (let i = period; i < closes.length; i++) {
    ema = closes[i]! * k + ema * (1 - k);
    result[i] = round2(ema);
  }
  return result;
}

export function calcRSI(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= period) return result;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i]! - closes[i - 1]!;
    if (diff > 0) avgGain += diff;
    else avgLoss += -diff;
  }

  avgGain /= period;
  avgLoss /= period;
  result[period] = rsiFromAvg(avgGain, avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i]! - closes[i - 1]!;
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    result[i] = rsiFromAvg(avgGain, avgLoss);
  }
  return result;
}

function rsiFromAvg(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100;
  return round2(100 - 100 / (1 + avgGain / avgLoss));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcIndicators(closes: number[]): IndicatorResult {
  return {
    sma20: calcSMA(closes, 20),
    ema20: calcEMA(closes, 20),
    rsi14: calcRSI(closes, 14),
  };
}
