import WebSocket from 'ws';
import type { Logger } from 'pino';

export function calcBackoffDelay(attempt: number): number {
  if (attempt <= 0) return 0;
  return Math.min(Math.pow(2, attempt - 1) * 1000, 30000);
}

export class BinanceWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private staleTimer: NodeJS.Timeout | null = null;
  private lastMessageAt = 0;
  private shouldReconnect = true;

  constructor(
    private readonly url: string,
    private readonly logger: Logger,
    private readonly onMessage: (data: unknown) => void,
  ) {}

  connect(): void {
    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      this.reconnectAttempt = 0;
      this.lastMessageAt = Date.now();
      this.logger.info({ url: this.url, attempt: this.reconnectAttempt }, 'Binance WS connected');
      this.startStaleWatch();
    });

    this.ws.on('message', (data) => {
      this.lastMessageAt = Date.now();
      try {
        this.onMessage(JSON.parse(data.toString()));
      } catch {
        this.logger.error({ raw: data.toString() }, 'Failed to parse WS message');
      }
    });

    this.ws.on('ping', () => {
      this.ws?.pong();
    });

    this.ws.on('close', () => {
      this.stopStaleWatch();
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err) => {
      this.logger.error({ err: err.message }, 'Binance WS error');
    });
  }

  private scheduleReconnect(): void {
    const delay = calcBackoffDelay(this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.logger.warn(
      { attempt: this.reconnectAttempt, delayMs: delay },
      'Binance WS reconnecting',
    );
    setTimeout(() => { this.connect(); }, delay);
  }

  private startStaleWatch(): void {
    this.staleTimer = setInterval(() => {
      if (Date.now() - this.lastMessageAt > 60_000) {
        this.logger.warn('No message received for 60s, forcing reconnect');
        this.ws?.terminate();
      }
    }, 30_000);
  }

  private stopStaleWatch(): void {
    if (this.staleTimer) {
      clearInterval(this.staleTimer);
      this.staleTimer = null;
    }
  }

  close(): void {
    this.shouldReconnect = false;
    this.stopStaleWatch();
    this.ws?.close();
  }
}
