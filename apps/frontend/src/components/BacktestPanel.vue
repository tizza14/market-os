<template>
  <div class="bg-bg-card border border-border-dim rounded-lg p-4 mt-4">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-sm font-semibold text-white">回測結果 — {{ strategyLabel }}</h2>
      <span class="text-xs text-price-flat">{{ periodLabel }}</span>
    </div>

    <!-- Metrics -->
    <div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-4">
      <MetricCard label="總報酬"    :value="fmt(metrics.totalReturn) + '%'"  :positive="metrics.totalReturn >= 0" />
      <MetricCard label="勝率"      :value="fmt(metrics.winRate) + '%'"       :positive="metrics.winRate >= 50" />
      <MetricCard label="交易次數"  :value="String(metrics.tradeCount)" />
      <MetricCard label="平均報酬"  :value="fmt(metrics.avgReturn) + '%'"     :positive="metrics.avgReturn >= 0" />
      <MetricCard label="最大回撤"  :value="fmt(metrics.maxDrawdown) + '%'"   :positive="false" :negative="true" />
      <MetricCard label="Sharpe"    :value="fmt(metrics.sharpeRatio)"          :positive="metrics.sharpeRatio >= 0" />
      <MetricCard label="Calmar"    :value="fmt(metrics.calmarRatio)"          :positive="metrics.calmarRatio >= 0" />
    </div>

    <!-- Equity curve -->
    <div v-if="result.equityCurve.length > 1" class="mb-4">
      <p class="text-xs text-price-flat mb-1 px-1">資金曲線</p>
      <EquityCurveChart :points="result.equityCurve" :height="180" />
    </div>

    <!-- Trade list -->
    <div v-if="trades.length > 0" class="overflow-x-auto">
      <table class="w-full text-xs text-price-flat">
        <thead>
          <tr class="border-b border-border-dim text-left">
            <th class="pb-2 pr-4">買入時間</th>
            <th class="pb-2 pr-4">買入價</th>
            <th class="pb-2 pr-4">賣出時間</th>
            <th class="pb-2 pr-4">賣出價</th>
            <th class="pb-2 text-right">損益</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(t, i) in trades"
            :key="i"
            class="border-b border-border-dim/40 hover:bg-white/5"
          >
            <td class="py-1 pr-4">{{ fmtTime(t.buyTime) }}</td>
            <td class="py-1 pr-4">{{ t.buyPrice.toFixed(2) }}</td>
            <td class="py-1 pr-4">{{ fmtTime(t.sellTime) }}</td>
            <td class="py-1 pr-4">{{ t.sellPrice.toFixed(2) }}</td>
            <td class="py-1 text-right font-medium" :class="t.isWin ? 'text-price-up' : 'text-price-down'">
              {{ t.pnl >= 0 ? '+' : '' }}{{ fmt(t.pnl) }}%
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-else class="text-xs text-price-flat text-center py-2">此期間無完整交叉訊號</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { BacktestResult } from '@market-os/shared-types';
import EquityCurveChart from './EquityCurveChart.vue';

const props = defineProps<{ result: BacktestResult }>();

const metrics = computed(() => props.result.metrics);
const trades  = computed(() => props.result.trades);

const strategyLabel = computed(() =>
  props.result.strategy === 'rsi' ? 'RSI(14) 超買超賣策略' : 'MA 黃金/死亡交叉策略',
);

const periodLabel = computed(() => {
  const from = new Date(props.result.from).toLocaleString('zh-TW', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const to   = new Date(props.result.to  ).toLocaleString('zh-TW', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  return `${from} ～ ${to}`;
});

function fmt(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(2);
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-TW', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
</script>

<script lang="ts">
// MetricCard as inline component
import { defineComponent, h } from 'vue';

export const MetricCard = defineComponent({
  props: {
    label:    { type: String, required: true },
    value:    { type: String, required: true },
    positive: { type: Boolean, default: undefined },
    negative: { type: Boolean, default: false },
  },
  setup(props) {
    return () => h('div', { class: 'bg-bg-primary rounded p-3' }, [
      h('p', { class: 'text-xs text-price-flat mb-1' }, props.label),
      h('p', {
        class: [
          'text-lg font-bold',
          props.negative ? 'text-price-down' :
          props.positive === true  ? 'text-price-up' :
          props.positive === false ? 'text-price-down' :
          'text-white',
        ],
      }, props.value),
    ]);
  },
});
</script>
