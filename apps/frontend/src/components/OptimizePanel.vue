<template>
  <div class="bg-bg-card border border-border-dim rounded-lg p-4 mt-4">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-sm font-semibold text-white">參數最佳化 — MA 交叉策略</h2>
      <span class="text-xs text-price-flat">指標：{{ metricLabel }}</span>
    </div>

    <!-- 最佳組合 -->
    <div class="flex gap-4 mb-4 flex-wrap">
      <div class="bg-bg-primary rounded p-3 flex-1 min-w-32">
        <p class="text-xs text-price-flat mb-1">最佳 SMA</p>
        <p class="text-lg font-bold text-teal-400">{{ result.best.smaPeriod }}</p>
      </div>
      <div class="bg-bg-primary rounded p-3 flex-1 min-w-32">
        <p class="text-xs text-price-flat mb-1">最佳 EMA</p>
        <p class="text-lg font-bold text-teal-400">{{ result.best.emaPeriod }}</p>
      </div>
      <div class="bg-bg-primary rounded p-3 flex-1 min-w-32">
        <p class="text-xs text-price-flat mb-1">最佳值</p>
        <p class="text-lg font-bold" :class="result.best.value >= 0 ? 'text-price-up' : 'text-price-down'">
          {{ fmtValue(result.best.value) }}
        </p>
      </div>
    </div>

    <!-- 熱力圖 -->
    <div ref="chartRef" class="w-full" style="height: 320px"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import type { OptimizeResult } from '@market-os/shared-types';

const props = defineProps<{ result: OptimizeResult }>();

const COLORS = { bg: '#131722', grid: '#2a2e39', text: '#90a4ae' } as const;

const chartRef = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

const metricLabel = {
  totalReturn: '總報酬 (%)',
  winRate:     '勝率 (%)',
  sharpeRatio: 'Sharpe Ratio',
}[props.result.metric] ?? props.result.metric;

function fmtValue(v: number): string {
  const suffix = props.result.metric === 'totalReturn' || props.result.metric === 'winRate' ? '%' : '';
  return (v >= 0 ? '+' : '') + v.toFixed(2) + suffix;
}

function buildOption(r: OptimizeResult): echarts.EChartsOption {
  const values = r.data.map((d) => d[2]);
  const minV = Math.min(...values), maxV = Math.max(...values);

  return {
    backgroundColor: COLORS.bg,
    animation: false,
    grid: { left: 48, right: 60, top: 16, bottom: 48 },
    xAxis: {
      type: 'category',
      data: r.emaValues.map(String),
      name: 'EMA',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: { color: COLORS.text, fontSize: 11 },
      axisLabel: { color: COLORS.text, fontSize: 10 },
      axisLine: { lineStyle: { color: COLORS.grid } },
    },
    yAxis: {
      type: 'category',
      data: r.smaValues.map(String),
      name: 'SMA',
      nameLocation: 'middle',
      nameGap: 36,
      nameTextStyle: { color: COLORS.text, fontSize: 11 },
      axisLabel: { color: COLORS.text, fontSize: 10 },
      axisLine: { lineStyle: { color: COLORS.grid } },
    },
    visualMap: {
      min: minV, max: maxV,
      calculable: true,
      orient: 'vertical',
      right: 4, top: 'center',
      textStyle: { color: COLORS.text, fontSize: 10 },
      inRange: { color: ['#ef5350', '#1e222d', '#26a69a'] },
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1e222d',
      borderColor: COLORS.grid,
      textStyle: { color: '#fff', fontSize: 11 },
      formatter: (p: unknown) => {
        const { data } = p as { data: [number, number, number] };
        const sma = r.smaValues[data[0]]!, ema = r.emaValues[data[1]]!;
        const suffix = r.metric === 'totalReturn' || r.metric === 'winRate' ? '%' : '';
        return `SMA ${sma} × EMA ${ema}<br/>${metricLabel}：${data[2] >= 0 ? '+' : ''}${data[2]}${suffix}`;
      },
    },
    series: [{
      type: 'heatmap',
      data: r.data,
      emphasis: { itemStyle: { borderColor: '#fff', borderWidth: 1 } },
    }],
  };
}

function render(): void {
  if (!chart) return;
  chart.setOption(buildOption(props.result), { notMerge: true });
}

onMounted(() => {
  if (!chartRef.value) return;
  chart = echarts.init(chartRef.value, null, { renderer: 'canvas' });
  render();
  new ResizeObserver(() => chart?.resize()).observe(chartRef.value);
});

watch(() => props.result, render, { deep: false });
onUnmounted(() => { chart?.dispose(); chart = null; });
</script>
