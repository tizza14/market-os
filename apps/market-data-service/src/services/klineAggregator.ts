import Decimal from 'decimal.js';
import type { MarketTick } from '@market-os/shared-types';
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

export function calcOpenTime(eventTime: number, intervalMs: number): number {
  return Math.floor(eventTime / intervalMs) * intervalMs;
}

export function createKline(tick: MarketTick, interval: string, intervalMs: number): KlineState {
  const openTime = calcOpenTime(tick.eventTime, intervalMs);
  return {
    symbol: tick.symbol,
    interval,
    openTime,
    closeTime: openTime + intervalMs - 1,
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

export function aggregateTick(
  current: KlineState | null,
  tick: MarketTick,
  interval: string,
  intervalMs: number,
): KlineState {
  if (!current) return createKline(tick, interval, intervalMs);
  const openTime = calcOpenTime(tick.eventTime, intervalMs);
  if (current.openTime !== openTime) return createKline(tick, interval, intervalMs);
  return updateKline(current, tick);
}

export class KlineAggregator {
  private currentKline: KlineState | null = null;
  private initialized = false;

  constructor(
    private readonly interval: string,
    private readonly intervalMs: number,
    private readonly klineRepo: KlineRepository,
    private readonly logger: Logger,
  ) {}

  async initialize(symbol: string): Promise<void> {
    const openTime = calcOpenTime(Date.now(), this.intervalMs);
    const existing = await this.klineRepo.findByOpenTime(symbol, this.interval, openTime);
    if (existing) {
      this.currentKline = existing;
      this.logger.info({ openTime, interval: this.interval }, 'Resumed in-progress kline');
    }
    this.initialized = true;
  }

  async processTick(tick: MarketTick): Promise<void> {
    if (!this.initialized) {
      await this.initialize(tick.symbol);
    }
    this.currentKline = aggregateTick(this.currentKline, tick, this.interval, this.intervalMs);
    await this.klineRepo.upsert(this.currentKline);
  }
}
