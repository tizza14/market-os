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
      <div class="flex gap-1 mb-2 px-1">
        <button
          v-for="iv in intervals"
          :key="iv"
          class="px-3 py-1 text-xs rounded font-medium transition-colors"
          :class="store.selectedInterval === iv
            ? 'bg-teal-600 text-white'
            : 'text-price-flat hover:text-white hover:bg-white/10'"
          @click="store.setInterval(iv)"
        >
          {{ iv }}
        </button>
      </div>
      <KlineChart :klines="store.klines" :height="480" :interval="store.selectedInterval" />
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useMarketStore } from '../stores/market';
import type { KlineInterval } from '../stores/market';
import PriceCard from '../components/PriceCard.vue';
import KlineChart from '../components/KlineChart.vue';

const store = useMarketStore();
const prevPrice = ref<string | null>(null);
const intervals: KlineInterval[] = ['1m', '5m', '15m', '1h'];

watch(
  () => store.latestTick?.price,
  (curr, old) => {
    if (old !== undefined) prevPrice.value = old ?? null;
  },
);

onMounted(() => store.start());
onUnmounted(() => store.stop());
</script>
