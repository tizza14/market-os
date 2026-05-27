import { describe, it, expect } from 'vitest';
import { calcPriceChange } from './priceChange';

describe('calcPriceChange', () => {
  it('新價格 > 舊價格 → direction: up，diff 為正值', () => {
    const result = calcPriceChange('100.00', '101.00');
    expect(result.direction).toBe('up');
    expect(result.diff).toBe('+1.00');
    expect(result.percent).toBe('+1.00%');
  });

  it('新價格 < 舊價格 → direction: down，diff 為負值', () => {
    const result = calcPriceChange('101.00', '100.00');
    expect(result.direction).toBe('down');
    expect(result.diff).toBe('-1.00');
    expect(result.percent).toBe('-0.99%');
  });

  it('新價格 = 舊價格 → direction: flat', () => {
    const result = calcPriceChange('100.00', '100.00');
    expect(result.direction).toBe('flat');
    expect(result.diff).toBe('+0.00');
    expect(result.percent).toBe('+0.00%');
  });

  it('prev 為 null（第一筆）→ direction: flat', () => {
    const result = calcPriceChange(null, '100.00');
    expect(result.direction).toBe('flat');
  });

  it('格式化顯示：千分位逗號，2 位小數', () => {
    const result = calcPriceChange(null, '104523.45');
    expect(result.displayPrice).toBe('$104,523.45');
  });
});
