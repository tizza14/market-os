import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { MarketTick, Kline } from '@market-os/shared-types';
import { MarketWebSocket } from '../services/marketWebSocket';
import { fetchKlines } from '../api/market';

const WS_URL = import.meta.env['VITE_WS_URL'] ?? '/ws/market';

export const useMarketStore = defineStore('market', () => {
  const symbol = ref('BTCUSDT');
  const latestTick = ref<MarketTick | null>(null);
  const klines = ref<Kline[]>([]);
  const connectionStatus = ref<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const lastUpdated = ref<number | null>(null);

  let ws: MarketWebSocket | null = null;

  async function loadKlines(): Promise<void> {
    try {
      klines.value = await fetchKlines(100);
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
    const openTime = Math.floor(tick.eventTime / 60000) * 60000;
    const last = klines.value[klines.value.length - 1];

    if (!last || last.openTime !== openTime) {
      klines.value = [
        ...klines.value,
        {
          openTime,
          closeTime: openTime + 59999,
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

  return { symbol, latestTick, klines, connectionStatus, lastUpdated, start, stop };
});
