import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { MarketTick, Kline, IndicatorResult } from '@market-os/shared-types';
import { MarketWebSocket } from '../services/marketWebSocket';
import { fetchKlines } from '../api/market';

const WS_URL = import.meta.env['VITE_WS_URL'] ?? '/ws/market';

export type KlineInterval = '1m' | '5m' | '15m' | '1h';

const INTERVAL_MS: Record<KlineInterval, number> = {
  '1m':  60_000,
  '5m':  300_000,
  '15m': 900_000,
  '1h':  3_600_000,
};

export const useMarketStore = defineStore('market', () => {
  const symbol = ref('BTCUSDT');
  const latestTick = ref<MarketTick | null>(null);
  const klines = ref<Kline[]>([]);
  const indicators = ref<IndicatorResult | null>(null);
  const connectionStatus = ref<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const lastUpdated = ref<number | null>(null);
  const selectedInterval = ref<KlineInterval>('1m');

  let ws: MarketWebSocket | null = null;

  async function loadKlines(): Promise<void> {
    try {
      const res = await fetchKlines(100, selectedInterval.value);
      klines.value = res.data;
      indicators.value = res.indicators;
    } catch {
      // silently fail — chart shows empty initially
    }
  }

  function handleMessage(msg: { type: string; data?: unknown; timestamp?: number }): void {
    if (msg.type === 'market:update') {
      const tick = msg.data as MarketTick;
      latestTick.value = tick;
      lastUpdated.value = tick.eventTime;
      updateLatestKline(tick);
    }
  }

  function updateLatestKline(tick: MarketTick): void {
    const intervalMs = INTERVAL_MS[selectedInterval.value];
    const openTime = Math.floor(tick.eventTime / intervalMs) * intervalMs;
    const closeTime = openTime + intervalMs - 1;
    const last = klines.value[klines.value.length - 1];

    if (!last || last.openTime !== openTime) {
      klines.value = [
        ...klines.value,
        {
          openTime,
          closeTime,
          open: tick.price,
          high: tick.price,
          low: tick.price,
          close: tick.price,
          volume: tick.quantity,
          tradeCount: 1,
        },
      ];
    } else {
      const updated: Kline = {
        ...last,
        close: tick.price,
        high: parseFloat(tick.price) > parseFloat(last.high) ? tick.price : last.high,
        low: parseFloat(tick.price) < parseFloat(last.low) ? tick.price : last.low,
        tradeCount: last.tradeCount + 1,
      };
      klines.value = [...klines.value.slice(0, -1), updated];
    }
  }

  async function setInterval(interval: KlineInterval): Promise<void> {
    selectedInterval.value = interval;
    await loadKlines();
  }

  function start(): void {
    void loadKlines();
    ws = new MarketWebSocket(
      WS_URL,
      (msg) => handleMessage(msg as { type: string; data?: unknown }),
      (status) => {
        connectionStatus.value = status;
        if (status === 'connected') {
          void loadKlines();
        }
      },
    );
    ws.connect();
  }

  function stop(): void {
    ws?.disconnect();
    ws = null;
  }

  return { symbol, latestTick, klines, indicators, connectionStatus, lastUpdated, selectedInterval, setInterval, start, stop };
});
