import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { OptimizeResult } from '@market-os/shared-types';

const BASE = import.meta.env['VITE_API_BASE_URL'] ?? '/api';

export const useTwOptimizeStore = defineStore('twOptimize', () => {
  const result  = ref<OptimizeResult | null>(null);
  const loading = ref(false);
  const error   = ref<string | null>(null);

  async function run(
    symbol: string,
    days: number,
    metric = 'totalReturn',
    smaMin = 10, smaMax = 50, smaStep = 5,
    emaMin = 10, emaMax = 50, emaStep = 5,
  ): Promise<void> {
    loading.value = true;
    error.value   = null;
    try {
      const params = new URLSearchParams({ symbol, days: String(days), metric,
        smaMin: String(smaMin), smaMax: String(smaMax), smaStep: String(smaStep),
        emaMin: String(emaMin), emaMax: String(emaMax), emaStep: String(emaStep),
      });
      const res = await fetch(`${BASE}/tw-stock/optimize?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      result.value = (await res.json()) as OptimizeResult;
    } catch (e) {
      error.value  = e instanceof Error ? e.message : 'Optimize failed';
      result.value = null;
    } finally {
      loading.value = false;
    }
  }

  function clear(): void { result.value = null; error.value = null; }

  return { result, loading, error, run, clear };
});
