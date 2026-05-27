import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { BacktestResult } from '@market-os/shared-types';

const BASE = import.meta.env['VITE_API_BASE_URL'] ?? '/api';

export const useTwBacktestStore = defineStore('twBacktest', () => {
  const result  = ref<BacktestResult | null>(null);
  const loading = ref(false);
  const error   = ref<string | null>(null);

  async function run(symbol: string, days: number, smaPeriod = 20, emaPeriod = 20, strategy = 'ma_cross'): Promise<void> {
    loading.value = true;
    error.value   = null;
    try {
      const res = await fetch(`${BASE}/tw-stock/backtest?symbol=${symbol}&days=${days}&smaPeriod=${smaPeriod}&emaPeriod=${emaPeriod}&strategy=${strategy}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      result.value = (await res.json()) as BacktestResult;
    } catch (e) {
      error.value  = e instanceof Error ? e.message : 'Backtest failed';
      result.value = null;
    } finally {
      loading.value = false;
    }
  }

  function clear(): void {
    result.value = null;
    error.value  = null;
  }

  return { result, loading, error, run, clear };
});
