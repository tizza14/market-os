import { Decimal128, MongoClient, MongoServerError } from 'mongodb';
import type { Logger } from 'pino';
import type { ExtendedTick } from '../services/tickProcessor.js';

export class TickRepository {
  constructor(
    private readonly client: MongoClient,
    private readonly logger: Logger,
  ) {}

  private get col() {
    return this.client.db('market-os').collection('market_ticks');
  }

  async ensureIndexes(): Promise<void> {
    await this.col.createIndex({ tradeId: 1 }, { unique: true });
    await this.col.createIndex({ symbol: 1, eventTime: -1 });
    await this.col.createIndex({ createdAt: 1 }, { expireAfterSeconds: 604_800 });
  }

  async save(tick: ExtendedTick): Promise<void> {
    try {
      await this.col.insertOne({
        symbol: tick.symbol,
        tradeId: tick.tradeId,
        price: Decimal128.fromString(tick.price),
        quantity: Decimal128.fromString(tick.quantity),
        isBuyerMaker: tick.isBuyerMaker,
        buyerOrderId: tick.buyerOrderId,
        sellerOrderId: tick.sellerOrderId,
        eventTime: tick.eventTime,
        createdAt: new Date(),
      });
    } catch (err) {
      if (err instanceof MongoServerError && err.code === 11000) {
        this.logger.debug({ tradeId: tick.tradeId }, 'Duplicate tick ignored');
        return;
      }
      throw err;
    }
  }

  async findLatest(): Promise<{ symbol: string; price: string; quantity: string; eventTime: number } | null> {
    const doc = await this.col.findOne({}, { sort: { eventTime: -1 } });
    if (!doc) return null;
    return {
      symbol: doc['symbol'] as string,
      price: (doc['price'] as Decimal128).toString(),
      quantity: (doc['quantity'] as Decimal128).toString(),
      eventTime: doc['eventTime'] as number,
    };
  }
}
