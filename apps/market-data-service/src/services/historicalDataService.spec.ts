import { describe, it, expect } from 'vitest';
import { parseBinanceKline } from './historicalDataService.js';
import type { BinanceKlineRow } from './historicalDataService.js';

const sampleRow: BinanceKlineRow = [
  1748131200000, '104000.00', '104523.45', '103800.00', '104200.00',
  '12.34567890', 1748131259999, '1285693.23', 145, '6.17283945', '642846.61', '0',
];

describe('parseBinanceKline', () => {
  it('正確解析所有欄位', () => {
    const k = parseBinanceKline(sampleRow, 'BTCUSDT', '1m');
    expect(k.symbol).toBe('BTCUSDT');
    expect(k.interval).toBe('1m');
    expect(k.openTime).toBe(1748131200000);
    expect(k.closeTime).toBe(1748131259999);
    expect(k.open).toBe('104000.00');
    expect(k.high).toBe('104523.45');
    expect(k.low).toBe('103800.00');
    expect(k.close).toBe('104200.00');
    expect(k.volume).toBe('12.34567890');
    expect(k.tradeCount).toBe(145);
  });

  it('不同 symbol / interval 正確帶入', () => {
    const k = parseBinanceKline(sampleRow, 'BTCUSDT', '1h');
    expect(k.symbol).toBe('BTCUSDT');
    expect(k.interval).toBe('1h');
  });
});
