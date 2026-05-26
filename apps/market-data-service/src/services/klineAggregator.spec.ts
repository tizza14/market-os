import { describe, it, expect } from 'vitest';
import { aggregateTick, calcOpenTime, createKline } from './klineAggregator.js';
import type { MarketTick } from '@market-os/shared-types';

const openTime = 1748131200000;

function tick(price: string, quantity: string, offsetMs = 1000): MarketTick {
  return {
    symbol: 'BTCUSDT',
    price,
    quantity,
    isBuyerMaker: false,
    tradeId: Math.random(),
    eventTime: openTime + offsetMs,
  };
}

describe('aggregateTick', () => {
  it('第一筆 tick → open/high/low/close 全等於 price', () => {
    const k = aggregateTick(null, tick('104000.00', '0.5'));
    expect(k.open).toBe('104000.00');
    expect(k.high).toBe('104000.00');
    expect(k.low).toBe('104000.00');
    expect(k.close).toBe('104000.00');
    expect(k.volume).toBe('0.50000000');
    expect(k.tradeCount).toBe(1);
  });

  it('第二筆同分鐘，price 更高 → high 更新，low/open 不變', () => {
    const k1 = aggregateTick(null, tick('104000.00', '0.5', 1000));
    const k2 = aggregateTick(k1, tick('104500.00', '0.3', 2000));
    expect(k2.open).toBe('104000.00');
    expect(k2.high).toBe('104500.00');
    expect(k2.low).toBe('104000.00');
    expect(k2.close).toBe('104500.00');
    expect(k2.volume).toBe('0.80000000');
  });

  it('第三筆同分鐘，price 更低 → low 更新，high/open 不變', () => {
    const k1 = aggregateTick(null, tick('104000.00', '0.5', 1000));
    const k2 = aggregateTick(k1, tick('104500.00', '0.3', 2000));
    const k3 = aggregateTick(k2, tick('103800.00', '0.2', 3000));
    expect(k3.open).toBe('104000.00');
    expect(k3.high).toBe('104500.00');
    expect(k3.low).toBe('103800.00');
    expect(k3.close).toBe('103800.00');
    expect(k3.volume).toBe('1.00000000');
  });

  it('跨分鐘 tick → openTime 為新的 floor(eventTime/60000)*60000', () => {
    const k1 = aggregateTick(null, tick('104000.00', '0.1', 1000));
    const nextMinuteTick: MarketTick = {
      ...tick('105000.00', '0.1'),
      eventTime: openTime + 60000,
    };
    const k2 = aggregateTick(k1, nextMinuteTick);
    expect(k2.openTime).toBe(openTime + 60000);
    expect(k1.openTime).toBe(openTime);
  });

  it('volume 累加精度正確（string decimal，非 float）', () => {
    const k1 = aggregateTick(null, { ...tick('100.00', '0.00000001'), tradeId: 1 });
    const k2 = aggregateTick(k1, { ...tick('100.00', '0.00000002'), tradeId: 2 });
    const k3 = aggregateTick(k2, { ...tick('100.00', '0.00000003'), tradeId: 3 });
    expect(k3.volume).toBe('0.00000006');
  });

  it('tradeCount 每筆 +1', () => {
    const k1 = aggregateTick(null, { ...tick('100.00', '0.1'), tradeId: 1 });
    const k2 = aggregateTick(k1, { ...tick('100.00', '0.1'), tradeId: 2 });
    const k3 = aggregateTick(k2, { ...tick('100.00', '0.1'), tradeId: 3 });
    expect(k3.tradeCount).toBe(3);
  });

  it('closeTime = openTime + 59999', () => {
    const k = createKline(tick('104000.00', '0.1'));
    expect(k.closeTime).toBe(k.openTime + 59999);
  });

  it('calcOpenTime 回傳整分鐘邊界', () => {
    expect(calcOpenTime(openTime + 30000)).toBe(openTime);
    expect(calcOpenTime(openTime + 59999)).toBe(openTime);
    expect(calcOpenTime(openTime + 60000)).toBe(openTime + 60000);
  });
});
