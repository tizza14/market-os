<template>
  <main class="min-h-screen bg-bg-primary text-white p-4 md:p-6">
    <header class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold tracking-wide text-white">Market OS</h1>
      <span class="text-xs text-price-flat">台股日 K</span>
    </header>

    <!-- 搜尋列 -->
    <div class="flex gap-2 mb-4">
      <input
        v-model="inputSymbol"
        type="text"
        placeholder="股票代號，如 2330"
        class="bg-bg-card border border-border-dim rounded px-3 py-2 text-sm text-white placeholder-price-flat focus:outline-none focus:border-teal-500 w-36"
        @keydown.enter="onSearch"
      />
      <div class="flex gap-1">
        <button
          v-for="d in dayOptions"
          :key="d.value"
          class="px-3 py-2 text-xs rounded font-medium transition-colors"
          :class="store.days === d.value
            ? 'bg-teal-600 text-white'
            : 'text-price-flat hover:text-white hover:bg-white/10'"
          @click="onDaysChange(d.value)"
        >
          {{ d.label }}
        </button>
      </div>
      <button
        class="px-4 py-2 text-xs rounded bg-teal-700 hover:bg-teal-600 text-white font-medium transition-colors"
        :disabled="store.loading"
        @click="onSearch"
      >
        {{ store.loading ? '載入中…' : '查詢' }}
      </button>
    </div>

    <!-- 股票資訊列 -->
    <div v-if="store.klines.length" class="mb-4">
      <div class="flex items-baseline gap-3 flex-wrap">
        <span class="text-xl font-bold">{{ store.companyName || store.symbol }}</span>
        <span class="text-sm text-price-flat">{{ store.symbol }}</span>
        <span v-if="store.industry" class="text-xs text-price-flat border border-border-dim rounded px-2 py-0.5">
          {{ store.industry }}
        </span>
      </div>
      <div class="flex items-baseline gap-4 mt-1">
        <span class="text-2xl font-bold" :class="lastSpread >= 0 ? 'text-price-up' : 'text-price-down'">
          {{ lastClose.toFixed(2) }}
        </span>
        <span class="text-sm" :class="lastSpread >= 0 ? 'text-price-up' : 'text-price-down'">
          {{ lastSpread >= 0 ? '+' : '' }}{{ lastSpread.toFixed(2) }}
          （{{ spreadPct }}%）
        </span>
        <span class="text-xs text-price-flat ml-auto">{{ lastDate }}</span>
      </div>
    </div>

    <!-- 錯誤 -->
    <div v-if="store.error" class="mb-4 text-sm text-price-down">
      查詢失敗：{{ store.error }}
    </div>

    <!-- 圖表 -->
    <div v-if="store.klines.length" class="bg-bg-card border border-border-dim rounded-lg p-2">
      <div class="flex items-center justify-end gap-1 mb-2 px-1">
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

      <TwKlineChart
        :klines="store.klines"
        :indicators="store.indicators"
        :signals="showBacktest ? (backtestStore.result?.signals ?? []) : []"
        :height="560"
      />
    </div>

    <div v-else-if="!store.loading" class="bg-bg-card border border-border-dim rounded-lg flex items-center justify-center h-48 text-price-flat text-sm">
      輸入股票代號後按查詢
    </div>
    <div v-else class="bg-bg-card border border-border-dim rounded-lg flex items-center justify-center h-48 text-price-flat text-sm">
      載入中…
    </div>

    <BacktestPanel
      v-if="showBacktest && backtestStore.result"
      :result="backtestStore.result"
    />

    <p v-if="showBacktest && backtestStore.error" class="mt-3 text-xs text-price-down text-center">
      {{ backtestStore.error }}
    </p>

    <OptimizePanel
      v-if="showOptimize && optimizeStore.result"
      :result="optimizeStore.result"
    />

    <p v-if="showOptimize && optimizeStore.error" class="mt-3 text-xs text-price-down text-center">
      {{ optimizeStore.error }}
    </p>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useTwStockStore } from '../stores/twStock';
import { useTwBacktestStore } from '../stores/twBacktest';
import { useTwOptimizeStore } from '../stores/twOptimize';
import TwKlineChart from '../components/TwKlineChart.vue';
import BacktestPanel from '../components/BacktestPanel.vue';
import OptimizePanel from '../components/OptimizePanel.vue';

const store = useTwStockStore();
const backtestStore  = useTwBacktestStore();
const optimizeStore  = useTwOptimizeStore();
const inputSymbol = ref(store.symbol);
const showBacktest  = ref(false);
const showOptimize  = ref(false);
const smaPeriod = ref(20);
const emaPeriod = ref(20);
const strategy  = ref<'ma_cross' | 'rsi'>('ma_cross');

const dayOptions = [
  { label: '60日',  value: 60  },
  { label: '120日', value: 120 },
  { label: '240日', value: 240 },
];

const lastKline  = computed(() => store.klines[store.klines.length - 1]);
const lastClose  = computed(() => lastKline.value?.close ?? 0);
const lastSpread = computed(() => lastKline.value?.spread ?? 0);
const lastDate   = computed(() => lastKline.value?.date ?? '');
const spreadPct  = computed(() => {
  if (!lastKline.value) return '0.00';
  const prev = lastKline.value.close - lastKline.value.spread;
  if (prev === 0) return '0.00';
  return ((lastKline.value.spread / prev) * 100).toFixed(2);
});

async function onSearch(): Promise<void> {
  showBacktest.value = false;
  showOptimize.value = false;
  backtestStore.clear();
  optimizeStore.clear();
  await store.search(inputSymbol.value, store.days);
}

async function onDaysChange(d: number): Promise<void> {
  showBacktest.value = false;
  showOptimize.value = false;
  backtestStore.clear();
  optimizeStore.clear();
  await store.search(store.symbol, d);
}

async function toggleBacktest(): Promise<void> {
  if (showBacktest.value) {
    showBacktest.value = false;
    backtestStore.clear();
    return;
  }
  showBacktest.value = true;
  await backtestStore.run(store.symbol, store.days, smaPeriod.value, emaPeriod.value, strategy.value);
}

async function toggleOptimize(): Promise<void> {
  if (showOptimize.value) {
    showOptimize.value = false;
    optimizeStore.clear();
    return;
  }
  showOptimize.value = true;
  await optimizeStore.run(store.symbol, store.days);
}

onMounted(() => store.fetchKlines());
</script>
