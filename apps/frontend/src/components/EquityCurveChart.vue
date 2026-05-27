<template>
  <div ref="chartRef" class="w-full" :style="{ height: height + 'px' }"></div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import type { EquityPoint } from '@market-os/shared-types';

const props = defineProps<{ points: EquityPoint[]; height?: number }>();
const height   = props.height ?? 180;
const chartRef = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

const COLORS = { bg: '#131722', grid: '#2a2e39', text: '#90a4ae', up: '#26a69a', down: '#ef5350' } as const;

function buildOption(points: EquityPoint[]): echarts.EChartsOption {
  const times   = points.map((p) => new Date(p.time).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }));
  const values  = points.map((p) => p.equity);
  const isProfit = (points[points.length - 1]?.equity ?? 1) >= 1;

  return {
    backgroundColor: COLORS.bg,
    animation: false,
    grid: { left: 60, right: 20, top: 16, bottom: 36 },
    xAxis: {
      type: 'category', data: times,
      axisLine: { lineStyle: { color: COLORS.grid } },
      axisLabel: { color: COLORS.text, fontSize: 10 },
    },
    yAxis: {
      scale: true,
      splitLine: { lineStyle: { color: COLORS.grid } },
      axisLabel: {
        color: COLORS.text, fontSize: 10,
        formatter: (v: number) => `${((v - 1) * 100).toFixed(1)}%`,
      },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e222d',
      borderColor: COLORS.grid,
      textStyle: { color: '#fff', fontSize: 11 },
      formatter: (raw: unknown) => {
        const p = raw as { dataIndex: number }[];
        const i = p[0]?.dataIndex ?? 0;
        const eq = values[i] ?? 1;
        const pct = ((eq - 1) * 100).toFixed(2);
        return `${times[i]}<br/>資金 ${pct.startsWith('-') ? pct : '+' + pct}%`;
      },
    },
    series: [{
      type: 'line',
      data: values,
      symbol: 'none',
      lineStyle: { color: isProfit ? COLORS.up : COLORS.down, width: 1.5 },
      areaStyle: { color: isProfit ? COLORS.up : COLORS.down, opacity: 0.08 },
      markLine: {
        silent: true, symbol: 'none',
        lineStyle: { color: COLORS.text, type: 'dashed', width: 1 },
        data: [{ yAxis: 1 }],
      },
    }],
  };
}

function render(): void {
  if (!chart) return;
  chart.setOption(buildOption(props.points), { notMerge: true });
}

onMounted(() => {
  if (!chartRef.value) return;
  chart = echarts.init(chartRef.value, null, { renderer: 'canvas' });
  render();
  new ResizeObserver(() => chart?.resize()).observe(chartRef.value);
});

watch(() => props.points, render, { deep: false });
onUnmounted(() => { chart?.dispose(); chart = null; });
</script>
