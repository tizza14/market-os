<template>
  <main class="min-h-screen bg-bg-primary text-white p-4 md:p-6">
    <header class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold tracking-wide text-white">Market OS</h1>
      <span class="text-xs text-price-flat">即時行情 · BTCUSDT</span>
    </header>

    <div class="mb-5">
      <PriceCard
        :symbol="store.symbol"
        :current-price="store.latestTick?.price ?? null"
        :prev-price="prevPrice"
        :event-time="store.lastUpdated"
        :status="store.connectionStatus"
      />
    </div>

    <div class="bg-bg-card border border-border-dim rounded-lg p-2">
      <div class="flex items-center gap-1 mb-2 px-1">
        <!-- 週期切換 -->
        <button
          v-for="iv in intervals"
          :key="iv"
          class="px-3 py-1 text-xs rounded font-medium transition-colors"
          :class="store.selectedInterval === iv
            ? 'bg-teal-600 text-white'
            : 'text-price-flat hover:text-white hover:bg-white/10'"
          @click="onIntervalChange(iv)"
        >
          {{ iv }}
        </button>

        <div class="flex-1" />

        <!-- 回測參數 + 按鈕 -->
        <!-- 策略選擇 -->
        <button
          v-for="s in ([{ value: 'ma_cross', label: 'MA交叉' }, { value: 'rsi', label: 'RSI' }] as const)"
          :key="s.value"
          class="px-3 py-1 text-xs rounded font-medium transition-colors"
          :class="strategy === s.value ? 'bg-violet-600 text-white' : 'text-price-flat hover:text-white hover:bg-white/10'"
          @click="strategy = s.value"
        >{{ s.label }}</button>

        <template v-if="strategy === 'ma_cross'">
          <label class="text-xs text-price-flat">SMA</label>
          <input v-model.number="smaPeriod" type="number" min="5" max="100"
            class="w-12 bg-bg-primary border border-border-dim rounded px-1 py-0.5 text-xs text-white text-center focus:outline-none focus:border-teal-500" />
          <label class="text-xs text-price-flat">EMA</label>
          <input v-model.number="emaPeriod" type="number" min="5" max="100"
            class="w-12 bg-bg-primary border border-border-dim rounded px-1 py-0.5 text-xs text-white text-center focus:outline-none focus:border-teal-500" />
        </template>

        <button
          class="px-3 py-1 text-xs rounded font-medium transition-colors"
          :class="showBacktest ? 'bg-indigo-600 text-white' : 'text-price-flat hover:text-white hover:bg-white/10'"
          :disabled="backtestStore.loading"
          @click="toggleBacktest"
        >
          {{ backtestStore.loading ? '計算中…' : '回測' }}
        </button>
        <button
          class="px-3 py-1 text-xs rounded font-medium transition-colors"
          :class="showOptimize ? 'bg-amber-600 text-white' : 'text-price-flat hover:text-white hover:bg-white/10'"
          :disabled="optimizeStore.loading"
          @click="toggleOptimize"
        >
          {{ optimizeStore.loading ? '計算中…' : '最佳化' }}
        </button>
      </div>

      <KlineChart
        :klines="store.klines"
        :indicators="store.indicators"
        :signals="showBacktest ? (backtestStore.result?.signals ?? []) : []"
        :height="560"
        :interval="store.selectedInterval"
      />
    </div>

    <BacktestPanel
      v-if="showBacktest && backtestStore.result"
      :result="backtestStore.result"
    />

    <p
      v-if="showBacktest && backtestStore.error"
      class="mt-3 text-xs text-price-down text-center"
    >
      {{ backtestStore.error }}
    </p>

    <OptimizePanel
      v-if="showOptimize && optimizeStore.result"
      :result="optimizeStore.result"
    />

    <p
      v-if="showOptimize && optimizeStore.error"
      class="mt-3 text-xs text-price-down text-center"
    >
      {{ optimizeStore.error }}
    </p>
  </main>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useMarketStore } from '../stores/market';
import { useBacktestStore } from '../stores/backtest';
import { useOptimizeStore } from '../stores/optimize';
import type { KlineInterval } from '../stores/market';
import PriceCard from '../components/PriceCard.vue';
import KlineChart from '../components/KlineChart.vue';
import BacktestPanel from '../components/BacktestPanel.vue';
import OptimizePanel from '../components/OptimizePanel.vue';

const store = useMarketStore();
const backtestStore = useBacktestStore();
const optimizeStore = useOptimizeStore();
const prevPrice = ref<string | null>(null);
const intervals: KlineInterval[] = ['1m', '5m', '15m', '1h'];
const showBacktest  = ref(false);
const showOptimize  = ref(false);
const smaPeriod = ref(20);
const emaPeriod = ref(20);
const strategy  = ref<'ma_cross' | 'rsi'>('ma_cross');

watch(
  () => store.latestTick?.price,
  (curr, old) => {
    if (old !== undefined) prevPrice.value = old ?? null;
  },
);

async function onIntervalChange(iv: KlineInterval): Promise<void> {
  await store.setInterval(iv);
  if (showBacktest.value) {
    await backtestStore.run(iv, smaPeriod.value, emaPeriod.value);
  }
}

async function toggleBacktest(): Promise<void> {
  if (showBacktest.value) {
    showBacktest.value = false;
    backtestStore.clear();
    return;
  }
  showBacktest.value = true;
  await backtestStore.run(store.selectedInterval, smaPeriod.value, emaPeriod.value, strategy.value);
}

async function toggleOptimize(): Promise<void> {
  if (showOptimize.value) {
    showOptimize.value = false;
    optimizeStore.clear();
    return;
  }
  showOptimize.value = true;
  await optimizeStore.run(store.selectedInterval);
}

onMounted(() => store.start());
onUnmounted(() => store.stop());
</script>
