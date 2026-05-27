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
    <div class="bg-bg-card border border-border-dim rounded-lg p-2">
      <TwKlineChart v-if="store.klines.length" :klines="store.klines" :height="480" />
      <div v-else-if="!store.loading" class="flex items-center justify-center h-48 text-price-flat text-sm">
        輸入股票代號後按查詢
      </div>
      <div v-else class="flex items-center justify-center h-48 text-price-flat text-sm">
        載入中…
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useTwStockStore } from '../stores/twStock';
import TwKlineChart from '../components/TwKlineChart.vue';

const store = useTwStockStore();
const inputSymbol = ref(store.symbol);

const dayOptions = [
  { label: '60日', value: 60 },
  { label: '120日', value: 120 },
  { label: '240日', value: 240 },
];

const lastKline = computed(() => store.klines[store.klines.length - 1]);
const lastClose = computed(() => lastKline.value?.close ?? 0);
const lastSpread = computed(() => lastKline.value?.spread ?? 0);
const lastDate = computed(() => lastKline.value?.date ?? '');
const spreadPct = computed(() => {
  if (!lastKline.value) return '0.00';
  const prev = lastKline.value.close - lastKline.value.spread;
  if (prev === 0) return '0.00';
  return ((lastKline.value.spread / prev) * 100).toFixed(2);
});

function onSearch(): void {
  void store.search(inputSymbol.value, store.days);
}

function onDaysChange(d: number): void {
  void store.search(store.symbol, d);
}

onMounted(() => store.fetchKlines());
</script>
