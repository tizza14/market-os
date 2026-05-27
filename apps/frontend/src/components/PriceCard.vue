<template>
  <div class="bg-bg-card border border-border-dim rounded-lg p-5 min-w-[280px]">
    <div class="flex items-center justify-between mb-3">
      <span class="text-sm font-semibold text-price-flat tracking-widest">{{ symbol }}</span>
      <span :class="statusClass" class="text-xs flex items-center gap-1">
        <span class="inline-block w-2 h-2 rounded-full" :class="dotClass"></span>
        {{ statusLabel }}
      </span>
    </div>

    <div class="text-3xl font-bold mb-1" :class="priceColorClass">
      {{ change.displayPrice }}
    </div>

    <div class="text-sm" :class="priceColorClass">
      {{ change.diff }}
      <span class="ml-1 text-price-flat/70">{{ change.percent }}</span>
    </div>

    <div class="text-xs text-price-flat mt-3">
      {{ timeLabel }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { calcPriceChange } from '../utils/priceChange';

const props = defineProps<{
  symbol: string;
  currentPrice: string | null;
  prevPrice: string | null;
  eventTime: number | null;
  status: 'connected' | 'reconnecting' | 'disconnected';
}>();

const change = computed(() =>
  props.currentPrice
    ? calcPriceChange(props.prevPrice, props.currentPrice)
    : { direction: 'flat' as const, diff: '--', percent: '--', displayPrice: '$--' },
);

const priceColorClass = computed(() => {
  if (change.value.direction === 'up') return 'text-price-up';
  if (change.value.direction === 'down') return 'text-price-down';
  return 'text-white';
});

const statusLabel = computed(() => {
  if (props.status === 'connected') return '連線中';
  if (props.status === 'reconnecting') return '重連中';
  return '離線';
});

const statusClass = computed(() => {
  if (props.status === 'connected') return 'text-price-up';
  if (props.status === 'reconnecting') return 'text-yellow-400';
  return 'text-price-down';
});

const dotClass = computed(() => {
  if (props.status === 'connected') return 'bg-price-up';
  if (props.status === 'reconnecting') return 'bg-yellow-400';
  return 'bg-price-down';
});

const timeLabel = computed(() => {
  if (!props.eventTime) return '--';
  return new Date(props.eventTime).toLocaleTimeString('zh-TW', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
});
</script>
