import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { TwStockKline } from '@market-os/shared-types';

const BASE = import.meta.env['VITE_API_BASE_URL'] ?? '/api';

export const useTwStockStore = defineStore('twStock', () => {
  const symbol = ref('2330');
  const days = ref(120);
  const klines = ref<TwStockKline[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchKlines(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch(`${BASE}/tw-stock/klines?symbol=${symbol.value}&days=${days.value}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: TwStockKline[] };
      klines.value = json.data;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
      klines.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function search(newSymbol: string, newDays?: number): Promise<void> {
    symbol.value = newSymbol.trim().toUpperCase();
    if (newDays) days.value = newDays;
    await fetchKlines();
  }

  return { symbol, days, klines, loading, error, fetchKlines, search };
});
