import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { TwStockKline, IndicatorResult } from '@market-os/shared-types';

const BASE = import.meta.env['VITE_API_BASE_URL'] ?? '/api';

interface KlinesResponse {
  symbol: string;
  companyName: string;
  industry: string;
  data: TwStockKline[];
  indicators: IndicatorResult;
}

export const useTwStockStore = defineStore('twStock', () => {
  const symbol = ref('2330');
  const companyName = ref('');
  const industry = ref('');
  const days = ref(120);
  const klines = ref<TwStockKline[]>([]);
  const indicators = ref<IndicatorResult | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchKlines(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch(`${BASE}/tw-stock/klines?symbol=${symbol.value}&days=${days.value}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as KlinesResponse;
      klines.value = json.data;
      indicators.value = json.indicators;
      companyName.value = json.companyName;
      industry.value = json.industry;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
      klines.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function search(newSymbol: string, newDays?: number): Promise<void> {
    symbol.value = newSymbol.trim();
    if (newDays) days.value = newDays;
    await fetchKlines();
  }

  return { symbol, companyName, industry, days, klines, indicators, loading, error, fetchKlines, search };
});
