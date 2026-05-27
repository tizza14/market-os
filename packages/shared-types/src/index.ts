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

export type WebSocketMessage =
  | { type: 'market:update'; data: MarketTick }
  | { type: 'market:error'; data: { code: string; message: string } }
  | { type: 'pong'; timestamp: number };
