import { Decimal128, MongoClient } from 'mongodb';
import type { KlineState } from '../services/klineAggregator.js';

export class KlineRepository {
  constructor(private readonly client: MongoClient) {}

  private get col() {
    return this.client.db('market-os').collection('klines');
  }

  async ensureIndexes(): Promise<void> {
    await this.col.createIndex({ symbol: 1, interval: 1, openTime: 1 }, { unique: true });
    await this.col.createIndex({ symbol: 1, interval: 1, openTime: -1 });
  }

  async findByOpenTime(symbol: string, interval: string, openTime: number): Promise<KlineState | null> {
    const doc = await this.col.findOne({ symbol, interval, openTime });
    if (!doc) return null;
    return docToKlineState(doc);
  }

  async findRecent(symbol: string, interval: string, limit: number): Promise<KlineState[]> {
    const docs = await this.col
      .find({ symbol, interval })
      .sort({ openTime: -1 })
      .limit(limit)
      .toArray();
    return docs.reverse().map(docToKlineState);
  }

  async findLatestOpenTime(symbol: string, interval: string): Promise<number | null> {
    const doc = await this.col.findOne({ symbol, interval }, { sort: { openTime: -1 } });
    return doc ? (doc['openTime'] as number) : null;
  }

  async countBySymbolInterval(symbol: string, interval: string): Promise<number> {
    return this.col.countDocuments({ symbol, interval });
  }

  async bulkUpsert(klines: KlineState[]): Promise<void> {
    if (klines.length === 0) return;
    await this.col.bulkWrite(
      klines.map((k) => ({
        updateOne: {
          filter: { symbol: k.symbol, interval: k.interval, openTime: k.openTime },
          update: {
            $set: {
              symbol:     k.symbol,
              interval:   k.interval,
              openTime:   k.openTime,
              closeTime:  k.closeTime,
              open:       Decimal128.fromString(k.open),
              close:      Decimal128.fromString(k.close),
              high:       Decimal128.fromString(k.high),
              low:        Decimal128.fromString(k.low),
              volume:     Decimal128.fromString(k.volume),
              tradeCount: k.tradeCount,
              updatedAt:  new Date(),
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  async upsert(kline: KlineState): Promise<void> {
    await this.col.updateOne(
      { symbol: kline.symbol, interval: kline.interval, openTime: kline.openTime },
      {
        $set: {
          symbol: kline.symbol,
          interval: kline.interval,
          openTime: kline.openTime,
          closeTime: kline.closeTime,
          open: Decimal128.fromString(kline.open),
          close: Decimal128.fromString(kline.close),
          high: Decimal128.fromString(kline.high),
          low: Decimal128.fromString(kline.low),
          volume: Decimal128.fromString(kline.volume),
          tradeCount: kline.tradeCount,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
  }
}

function docToKlineState(doc: Record<string, unknown>): KlineState {
  return {
    symbol: doc['symbol'] as string,
    interval: doc['interval'] as string,
    openTime: doc['openTime'] as number,
    closeTime: doc['closeTime'] as number,
    open: (doc['open'] as Decimal128).toString(),
    high: (doc['high'] as Decimal128).toString(),
    low: (doc['low'] as Decimal128).toString(),
    close: (doc['close'] as Decimal128).toString(),
    volume: (doc['volume'] as Decimal128).toString(),
    tradeCount: doc['tradeCount'] as number,
  };
}
