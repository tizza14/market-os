import type { MarketTick } from '@market-os/shared-types';
import type { BinanceTrade } from '../schemas/binanceTrade.js';

export interface ExtendedTick extends MarketTick {
  buyerOrderId?: number;
  sellerOrderId?: number;
}

export function formatTick(trade: BinanceTrade): ExtendedTick {
  return {
    symbol: trade.s.toUpperCase(),
    price: trade.p,
    quantity: trade.q,
    isBuyerMaker: trade.m,
    tradeId: trade.t,
    eventTime: trade.E,
    ...(trade.b !== undefined ? { buyerOrderId: trade.b } : {}),
    ...(trade.a !== undefined ? { sellerOrderId: trade.a } : {}),
  };
}
