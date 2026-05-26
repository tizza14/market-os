import type { MarketTick } from '@market-os/shared-types';
import { REDIS_CHANNELS } from '@market-os/config';

// Wave 1 空殼：驗證 shared-types 與 config 可正確 import
const _tick: MarketTick = {
  symbol: 'BTCUSDT',
  price: '104523.45',
  quantity: '0.001',
  isBuyerMaker: false,
  tradeId: 1,
  eventTime: Date.now(),
};

console.log(`api-gateway started, redis channel=${REDIS_CHANNELS.BTCUSDT}`);
