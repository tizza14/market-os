import Redis from 'ioredis';
import type { MarketTick } from '@market-os/shared-types';
import { REDIS_CHANNELS, WS_MESSAGE_TYPES } from '@market-os/config';

export class RedisPublisher {
  private readonly client: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl);
  }

  async publish(tick: MarketTick): Promise<void> {
    const payload = JSON.stringify({
      type: WS_MESSAGE_TYPES.MARKET_UPDATE,
      data: {
        symbol: tick.symbol,
        price: tick.price,
        quantity: tick.quantity,
        isBuyerMaker: tick.isBuyerMaker,
        tradeId: tick.tradeId,
        eventTime: tick.eventTime,
      },
    });
    await this.client.publish(REDIS_CHANNELS.BTCUSDT, payload);
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
