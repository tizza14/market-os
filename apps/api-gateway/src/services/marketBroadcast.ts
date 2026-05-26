import { EventEmitter } from 'node:events';
import Redis from 'ioredis';
import { REDIS_CHANNELS } from '@market-os/config';
import type { Logger } from 'pino';

export class MarketBroadcast extends EventEmitter {
  private subscriber: Redis;
  private _connected = false;

  constructor(
    private readonly redisUrl: string,
    private readonly logger: Logger,
  ) {
    super();
    this.setMaxListeners(100);
    this.subscriber = new Redis(redisUrl);
  }

  get connected(): boolean {
    return this._connected;
  }

  async start(): Promise<void> {
    this.subscriber.on('connect', () => {
      this._connected = true;
      this.logger.info('MarketBroadcast Redis connected');
    });

    this.subscriber.on('error', (err) => {
      this._connected = false;
      this.logger.error({ err: err.message }, 'MarketBroadcast Redis error');
    });

    this.subscriber.on('close', () => {
      this._connected = false;
    });

    await this.subscriber.subscribe(REDIS_CHANNELS.BTCUSDT);
    this._connected = true;

    this.subscriber.on('message', (_channel, payload) => {
      try {
        const msg: unknown = JSON.parse(payload);
        this.emit('market:update', msg);
      } catch {
        this.logger.warn({ payload }, 'Failed to parse Redis message');
      }
    });
  }

  async stop(): Promise<void> {
    await this.subscriber.quit();
    this.removeAllListeners();
  }
}
