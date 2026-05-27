export interface MarketTick {
  symbol: string;
  price: string;
  quantity: string;
  isBuyerMaker: boolean;
  tradeId: number;
  eventTime: number;
}

export interface Kline {
  openTime: number;
  closeTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  tradeCount: number;
}

export interface TwStockKline {
  date: string;
  stockId: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  spread: number;
  turnover: number;
}

export interface IndicatorResult {
  sma20: (number | null)[];
  ema20: (number | null)[];
  rsi14: (number | null)[];
}

export interface TradeSignal {
  type: 'buy' | 'sell';
  time: number;
  price: number;
}

export interface BacktestTrade {
  buyTime: number;
  buyPrice: number;
  sellTime: number;
  sellPrice: number;
  pnl: number;
  isWin: boolean;
}

export interface BacktestMetrics {
  totalReturn: number;
  tradeCount: number;
  winRate: number;
  maxDrawdown: number;
  avgReturn: number;
  sharpeRatio: number;
  calmarRatio: number;
}

export interface EquityPoint {
  time: number;
  equity: number;
}

export interface BacktestResult {
  symbol: string;
  interval: string;
  strategy: string;
  from: number;
  to: number;
  metrics: BacktestMetrics;
  trades: BacktestTrade[];
  signals: TradeSignal[];
  equityCurve: EquityPoint[];
}

export interface OptimizeCell {
  smaPeriod: number;
  emaPeriod: number;
  value: number;
}

export interface OptimizeResult {
  symbol: string;
  interval: string;
  metric: string;
  smaValues: number[];
  emaValues: number[];
  data: [number, number, number][];  // [smaIdx, emaIdx, metricValue]
  best: OptimizeCell;
}

export type WebSocketMessage =
  | { type: 'market:update'; data: MarketTick }
  | { type: 'market:error'; data: { code: string; message: string } }
  | { type: 'pong'; timestamp: number };
