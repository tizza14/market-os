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

export type WebSocketMessage =
  | { type: 'market:update'; data: MarketTick }
  | { type: 'market:error'; data: { code: string; message: string } }
  | { type: 'pong'; timestamp: number };
