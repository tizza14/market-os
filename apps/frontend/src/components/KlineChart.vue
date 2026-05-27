<template>
  <div ref="chartRef" class="w-full" :style="{ height: height + 'px' }"></div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import type { CallbackDataParams } from 'echarts/types/dist/shared';
import type { Kline, IndicatorResult, TradeSignal } from '@market-os/shared-types';

const CHART_COLORS = {
  up:         '#26a69a',
  down:       '#ef5350',
  background: '#131722',
  grid:       '#2a2e39',
  text:       '#90a4ae',
  sma:        '#f9a825',
  ema:        '#7c4dff',
  rsiLine:    '#26c6da',
  rsiOb:      '#ef5350',
  rsiOs:      '#26a69a',
} as const;

const props = defineProps<{
  klines: Kline[];
  indicators?: IndicatorResult | null;
  signals?: TradeSignal[];
  height?: number;
  interval?: string;
}>();

const height = props.height ?? 560;
const chartRef = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

function hasRsiData(ind: IndicatorResult | null | undefined): boolean {
  if (!ind) return false;
  return ind.rsi14.some((v) => v !== null);
}

function buildOption(klines: Kline[], ind: IndicatorResult | null | undefined): echarts.EChartsOption {
  const times   = klines.map((k) => formatTime(k.openTime));
  const candle  = klines.map((k) => [parseFloat(k.open), parseFloat(k.close), parseFloat(k.low), parseFloat(k.high)]);
  const volumes = klines.map((k) => parseFloat(k.volume));
  const colors  = klines.map((k) => parseFloat(k.close) >= parseFloat(k.open) ? CHART_COLORS.up : CHART_COLORS.down);
  const showRsi = hasRsiData(ind);

  // Grid layout (bottom-up): dataZoom(40px) → RSI(85px) → gap → Volume(65px) → gap → Candle
  const mainBottom  = showRsi ? 230 : 140;
  const volBottom   = showRsi ? 140 : 55;

  const grids: echarts.GridComponentOption[] = [
    { left: 65, right: 20, top: 20, bottom: mainBottom },
    { left: 65, right: 20, height: 65, bottom: volBottom },
  ];
  const xAxes: echarts.XAXisComponentOption[] = [
    { type: 'category', data: times, axisLine: { lineStyle: { color: CHART_COLORS.grid } }, axisLabel: { color: CHART_COLORS.text, fontSize: 11 }, splitLine: { lineStyle: { color: CHART_COLORS.grid } }, gridIndex: 0 },
    { type: 'category', data: times, axisLabel: { show: false }, axisLine: { lineStyle: { color: CHART_COLORS.grid } }, gridIndex: 1 },
  ];
  const yAxes: echarts.YAXisComponentOption[] = [
    { scale: true, splitLine: { lineStyle: { color: CHART_COLORS.grid } }, axisLabel: { color: CHART_COLORS.text, fontSize: 11, formatter: (v: number) => v.toFixed(0) }, gridIndex: 0 },
    { scale: true, splitLine: { show: false }, axisLabel: { color: CHART_COLORS.text, fontSize: 10 }, gridIndex: 1 },
  ];

  if (showRsi) {
    grids.push({ left: 65, right: 20, height: 80, bottom: 45 });
    xAxes.push({ type: 'category', data: times, axisLabel: { show: false }, axisLine: { lineStyle: { color: CHART_COLORS.grid } }, gridIndex: 2 });
    yAxes.push({ min: 0, max: 100, splitNumber: 2, splitLine: { show: false }, axisLabel: { color: CHART_COLORS.text, fontSize: 10 }, gridIndex: 2 });
  }

  const xAxisIndexAll = showRsi ? [0, 1, 2] : [0, 1];

  const series: echarts.SeriesOption[] = [
    {
      name: 'K線',
      type: 'candlestick',
      xAxisIndex: 0,
      yAxisIndex: 0,
      data: candle,
      itemStyle: { color: CHART_COLORS.up, color0: CHART_COLORS.down, borderColor: CHART_COLORS.up, borderColor0: CHART_COLORS.down },
    },
    {
      name: '成交量',
      type: 'bar',
      xAxisIndex: 1,
      yAxisIndex: 1,
      data: volumes,
      itemStyle: { color: (p: { dataIndex: number }) => colors[p.dataIndex] ?? CHART_COLORS.up, opacity: 0.7 },
    },
  ];

  if (ind?.sma20) {
    series.push({ name: 'SMA20', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: ind.sma20, smooth: false, symbol: 'none', lineStyle: { color: CHART_COLORS.sma, width: 1.2 }, z: 3 });
  }
  if (ind?.ema20) {
    series.push({ name: 'EMA20', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: ind.ema20, smooth: false, symbol: 'none', lineStyle: { color: CHART_COLORS.ema, width: 1.2 }, z: 3 });
  }

  const signals = props.signals ?? [];
  if (signals.length > 0) {
    const buyPoints = signals
      .filter((s) => s.type === 'buy')
      .map((s) => {
        const idx = klines.findIndex((k) => k.openTime === s.time);
        if (idx === -1) return null;
        return { value: [times[idx], parseFloat(klines[idx]!.low) * 0.9993] };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    const sellPoints = signals
      .filter((s) => s.type === 'sell')
      .map((s) => {
        const idx = klines.findIndex((k) => k.openTime === s.time);
        if (idx === -1) return null;
        return { value: [times[idx], parseFloat(klines[idx]!.high) * 1.0007] };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    series.push({
      name: '買入',
      type: 'scatter',
      xAxisIndex: 0,
      yAxisIndex: 0,
      data: buyPoints,
      symbol: 'triangle',
      symbolSize: 10,
      itemStyle: { color: CHART_COLORS.up },
      z: 5,
    });
    series.push({
      name: '賣出',
      type: 'scatter',
      xAxisIndex: 0,
      yAxisIndex: 0,
      data: sellPoints,
      symbol: 'triangle',
      symbolRotate: 180,
      symbolSize: 10,
      itemStyle: { color: CHART_COLORS.down },
      z: 5,
    });
  }
  if (showRsi && ind?.rsi14) {
    series.push({
      name: 'RSI14',
      type: 'line',
      xAxisIndex: 2,
      yAxisIndex: 2,
      data: ind.rsi14,
      smooth: false,
      symbol: 'none',
      lineStyle: { color: CHART_COLORS.rsiLine, width: 1.2 },
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: { type: 'dashed', width: 1 },
        data: [
          { yAxis: 70, lineStyle: { color: CHART_COLORS.rsiOb } },
          { yAxis: 30, lineStyle: { color: CHART_COLORS.rsiOs } },
        ],
      },
    });
  }

  return {
    backgroundColor: CHART_COLORS.background,
    animation: false,
    legend: {
      top: 4,
      right: 20,
      textStyle: { color: CHART_COLORS.text, fontSize: 11 },
      itemWidth: 16,
      data: ['SMA20', 'EMA20'],
    },
    grid: grids,
    xAxis: xAxes,
    yAxis: yAxes,
    dataZoom: [
      { type: 'inside', xAxisIndex: xAxisIndexAll, start: 60, end: 100 },
      { type: 'slider', xAxisIndex: xAxisIndexAll, bottom: 8, height: 28, borderColor: CHART_COLORS.grid, textStyle: { color: CHART_COLORS.text } },
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
        const rsi = params.find((p) => p.seriesName === 'RSI14');
        const sma = params.find((p) => p.seriesName === 'SMA20');
        const ema = params.find((p) => p.seriesName === 'EMA20');
        if (!c) return '';
        const [o, cl, l, h] = c.value as number[];
        const idx = c.dataIndex ?? 0;
        const kline = klines[idx];
        const lines = [
          `<b>${times[idx] ?? ''}</b>`,
          `開 ${o?.toFixed(2) ?? '--'}　高 ${h?.toFixed(2) ?? '--'}`,
          `低 ${l?.toFixed(2) ?? '--'}　收 ${cl?.toFixed(2) ?? '--'}`,
          `量 ${v ? (v.value as number).toFixed(4) : '--'} BTC`,
          `筆數 ${kline?.tradeCount ?? '--'}`,
        ];
        if (sma?.value != null) lines.push(`<span style="color:${CHART_COLORS.sma}">SMA20 ${(sma.value as number).toFixed(2)}</span>`);
        if (ema?.value != null) lines.push(`<span style="color:${CHART_COLORS.ema}">EMA20 ${(ema.value as number).toFixed(2)}</span>`);
        if (rsi?.value != null) lines.push(`<span style="color:${CHART_COLORS.rsiLine}">RSI14 ${(rsi.value as number).toFixed(2)}</span>`);
        return lines.join('<br/>');
      },
    },
    series,
  };
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  if (props.interval === '1h') {
    return d.toLocaleString('zh-TW', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });
}

function renderChart(): void {
  if (!chart) return;
  chart.setOption(buildOption(props.klines, props.indicators), { notMerge: true });
}

onMounted(() => {
  if (!chartRef.value) return;
  chart = echarts.init(chartRef.value, null, { renderer: 'canvas' });
  renderChart();

  const ro = new ResizeObserver(() => chart?.resize());
  ro.observe(chartRef.value);
});

watch([() => props.klines, () => props.indicators, () => props.signals, () => props.interval], () => renderChart(), { deep: false });

onUnmounted(() => {
  chart?.dispose();
  chart = null;
});
</script>
