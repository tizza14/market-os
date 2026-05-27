import { describe, it, expect } from 'vitest';
import { calcSMA, calcEMA, calcRSI, calcIndicators } from './indicatorService.js';

// 15 elements so RSI(14) produces a value at index 14
const closes14 = [44, 46, 48, 50, 52, 50, 48, 46, 44, 46, 48, 50, 52, 50, 48];
const closes20 = Array.from({ length: 20 }, (_, i) => 100 + i);

describe('calcSMA', () => {
  it('資料點不足 period → 全部回傳 null', () => {
    const result = calcSMA([100, 101, 102], 5);
    expect(result).toEqual([null, null, null]);
  });

  it('恰好 period 個點 → 最後一個有值，其餘 null', () => {
    const result = calcSMA([1, 2, 3, 4, 5], 5);
    expect(result[4]).toBe(3);
    expect(result[0]).toBeNull();
  });

  it('SMA(3) 計算正確', () => {
    const result = calcSMA([1, 2, 3, 4, 5], 3);
    expect(result[2]).toBe(2);
    expect(result[3]).toBe(3);
    expect(result[4]).toBe(4);
  });
});

describe('calcEMA', () => {
  it('資料點不足 period → 全部 null', () => {
    expect(calcEMA([1, 2, 3], 5)).toEqual([null, null, null]);
  });

  it('EMA 初始值等於前 period 筆的 SMA', () => {
    const result = calcEMA(closes20, 20);
    const seed = closes20.slice(0, 20).reduce((a, b) => a + b, 0) / 20;
    expect(result[19]).toBe(Math.round(seed * 100) / 100);
  });

  it('EMA 第 21 筆向最新值收斂', () => {
    const data = [...closes20, 200];
    const result = calcEMA(data, 20);
    // 第 21 筆 close=200 遠高於 EMA，新 EMA 應大於前一個
    expect(result[20]).toBeGreaterThan(result[19]!);
  });
});

describe('calcRSI', () => {
  it('資料點 ≤ period → 全部 null', () => {
    expect(calcRSI([1, 2, 3, 4, 5], 5)).toEqual([null, null, null, null, null]);
  });

  it('所有上漲 → RSI=100', () => {
    const allUp = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const result = calcRSI(allUp, 14);
    expect(result[14]).toBe(100);
  });

  it('所有下跌 → RSI=0', () => {
    const allDown = [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    const result = calcRSI(allDown, 14);
    expect(result[14]).toBe(0);
  });

  it('混合漲跌 → RSI 介於 0~100', () => {
    const result = calcRSI(closes14, 14);
    const rsi = result[14];
    expect(rsi).not.toBeNull();
    expect(rsi!).toBeGreaterThan(0);
    expect(rsi!).toBeLessThan(100);
  });
});

describe('calcIndicators', () => {
  it('回傳三個陣列，長度與輸入相同', () => {
    const result = calcIndicators(closes20);
    expect(result.sma20).toHaveLength(20);
    expect(result.ema20).toHaveLength(20);
    expect(result.rsi14).toHaveLength(20);
  });

  it('空陣列 → 三個指標均為空陣列', () => {
    const result = calcIndicators([]);
    expect(result.sma20).toHaveLength(0);
    expect(result.ema20).toHaveLength(0);
    expect(result.rsi14).toHaveLength(0);
  });
});
