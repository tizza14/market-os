import Decimal from 'decimal.js';
import type { MarketTick } from '@market-os/shared-types';
import { KLINE_INTERVALS } from '@market-os/config';
import type { KlineRepository } from '../repositories/klineRepository.js';
import type { Logger } from 'pino';

export interface KlineState {
  symbol: string;
  interval: string;
  openTime: number;
  closeTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  tradeCount: number;
}

export function calcOpenTime(eventTime: number): number {
  return Math.floor(eventTime / 60000) * 60000;
}

export function createKline(tick: MarketTick): KlineState {
  const openTime = calcOpenTime(tick.eventTime);
  return {
    symbol: tick.symbol,
    interval: KLINE_INTERVALS.ONE_MINUTE,
    openTime,
    closeTime: openTime + 59999,
    open: tick.price,
    high: tick.price,
    low: tick.price,
    close: tick.price,
    volume: new Decimal(tick.quantity).toFixed(8),
    tradeCount: 1,
  };
}

export function updateKline(current: KlineState, tick: MarketTick): KlineState {
  const newHigh = new Decimal(tick.price).gt(current.high) ? tick.price : current.high;
  const newLow = new Decimal(tick.price).lt(current.low) ? tick.price : current.low;
  const newVolume = new Decimal(current.volume).plus(tick.quantity).toFixed(8);
  return {
    ...current,
    close: tick.price,
    high: newHigh,
    low: newLow,
    volume: newVolume,
    tradeCount: current.tradeCount + 1,
  };
}

export function aggregateTick(current: KlineState | null, tick: MarketTick): KlineState {
  if (!current) return createKline(tick);
  const openTime = calcOpenTime(tick.eventTime);
  if (current.openTime !== openTime) return createKline(tick);
  return updateKline(current, tick);
}

export class KlineAggregator {
  private currentKline: KlineState | null = null;
  private initialized = false;

  constructor(
    private readonly klineRepo: KlineRepository,
    private readonly logger: Logger,
  ) {}

  async initialize(symbol: string): Promise<void> {
    const openTime = calcOpenTime(Date.now());
    const existing = await this.klineRepo.findByOpenTime(symbol, KLINE_INTERVALS.ONE_MINUTE, openTime);
    if (existing) {
      this.currentKline = existing;
      this.logger.info({ openTime }, 'Resumed in-progress kline');
    }
    this.initialized = true;
  }

  async processTick(tick: MarketTick): Promise<void> {
    if (!this.initialized) {
      await this.initialize(tick.symbol);
    }
    this.currentKline = aggregateTick(this.currentKline, tick);
    await this.klineRepo.upsert(this.currentKline);
  }
}
