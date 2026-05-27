import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { BacktestResult } from '@market-os/shared-types';
import { fetchBacktest } from '../api/backtest';

export const useBacktestStore = defineStore('backtest', () => {
  const result = ref<BacktestResult | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function run(interval: string, smaPeriod = 20, emaPeriod = 20, strategy = 'ma_cross'): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      result.value = await fetchBacktest(interval, 300, smaPeriod, emaPeriod, strategy);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Backtest failed';
      result.value = null;
    } finally {
      loading.value = false;
    }
  }

  function clear(): void {
    result.value = null;
    error.value = null;
  }

  return { result, loading, error, run, clear };
});
