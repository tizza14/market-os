<template>
  <div ref="chartRef" class="w-full" :style="{ height: height + 'px' }"></div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import type { CallbackDataParams } from 'echarts/types/dist/shared';
import type { Kline } from '@market-os/shared-types';

const CHART_COLORS = {
  up:         '#26a69a',
  down:       '#ef5350',
  background: '#131722',
  grid:       '#2a2e39',
  text:       '#90a4ae',
} as const;

const props = defineProps<{
  klines: Kline[];
  height?: number;
}>();

const height = props.height ?? 480;
const chartRef = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

function buildOption(klines: Kline[]): echarts.EChartsOption {
  const times  = klines.map((k) => formatTime(k.openTime));
  const candle = klines.map((k) => [
    parseFloat(k.open),
    parseFloat(k.close),
    parseFloat(k.low),
    parseFloat(k.high),
  ]);
  const volumes = klines.map((k) => parseFloat(k.volume));
  const colors  = klines.map((k) =>
    parseFloat(k.close) >= parseFloat(k.open) ? CHART_COLORS.up : CHART_COLORS.down,
  );

  return {
    backgroundColor: CHART_COLORS.background,
    animation: false,
    grid: [
      { left: 60, right: 20, top: 20, bottom: 160 },
      { left: 60, right: 20, top: 'auto', height: 80, bottom: 60 },
    ],
    xAxis: [
      {
        type: 'category',
        data: times,
        axisLine: { lineStyle: { color: CHART_COLORS.grid } },
        axisLabel: { color: CHART_COLORS.text, fontSize: 11 },
        splitLine: { lineStyle: { color: CHART_COLORS.grid } },
        gridIndex: 0,
      },
      {
        type: 'category',
        data: times,
        axisLabel: { show: false },
        axisLine: { lineStyle: { color: CHART_COLORS.grid } },
        gridIndex: 1,
      },
    ],
    yAxis: [
      {
        scale: true,
        splitLine: { lineStyle: { color: CHART_COLORS.grid } },
        axisLabel: {
          color: CHART_COLORS.text,
          fontSize: 11,
          formatter: (v: number) => v.toFixed(2),
        },
        gridIndex: 0,
      },
      {
        scale: true,
        splitLine: { show: false },
        axisLabel: { color: CHART_COLORS.text, fontSize: 10 },
        gridIndex: 1,
      },
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], start: 60, end: 100 },
      { type: 'slider', xAxisIndex: [0, 1], bottom: 10, height: 30, borderColor: CHART_COLORS.grid, textStyle: { color: CHART_COLORS.text } },
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', lineStyle: { color: CHART_COLORS.text } },
      backgroundColor: '#1e222d',
      borderColor: CHART_COLORS.grid,
      textStyle: { color: '#fff', fontSize: 12 },
      formatter(raw: CallbackDataParams | CallbackDataParams[]) {
        const params = Array.isArray(raw) ? raw : [raw];
        const c = params.find((p) => p.seriesName === 'K線');
        const v = params.find((p) => p.seriesName === '成交量');
        if (!c) return '';
        const [o, cl, l, h] = c.value as number[];
        const idx = c.dataIndex ?? 0;
        const kline = klines[idx];
        return [
          `<b>${times[idx] ?? ''}</b>`,
          `開 ${o?.toFixed(2) ?? '--'}　高 ${h?.toFixed(2) ?? '--'}`,
          `低 ${l?.toFixed(2) ?? '--'}　收 ${cl?.toFixed(2) ?? '--'}`,
          `量 ${v ? (v.value as number).toFixed(4) : '--'} BTC`,
          `筆數 ${kline?.tradeCount ?? '--'}`,
        ].join('<br/>');
      },
    },
    series: [
      {
        name: 'K線',
        type: 'candlestick',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: candle,
        itemStyle: {
          color: CHART_COLORS.up,
          color0: CHART_COLORS.down,
          borderColor: CHART_COLORS.up,
          borderColor0: CHART_COLORS.down,
        },
      },
      {
        name: '成交量',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumes,
        itemStyle: { color: (p: { dataIndex: number }) => colors[p.dataIndex] ?? CHART_COLORS.up, opacity: 0.7 },
      },
    ],
  };
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });
}

function renderChart(klines: Kline[]): void {
  if (!chart) return;
  chart.setOption(buildOption(klines), { notMerge: false, replaceMerge: ['series'] });
}

onMounted(() => {
  if (!chartRef.value) return;
  chart = echarts.init(chartRef.value, null, { renderer: 'canvas' });
  renderChart(props.klines);

  const ro = new ResizeObserver(() => chart?.resize());
  ro.observe(chartRef.value);
});

watch(() => props.klines, (klines) => renderChart(klines), { deep: false });

onUnmounted(() => {
  chart?.dispose();
  chart = null;
});
</script>
