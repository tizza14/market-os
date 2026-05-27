import type { WebSocketMessage } from '@market-os/shared-types';

export class MarketWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  constructor(
    private url: string,
    private onMessage: (msg: WebSocketMessage) => void,
    private onStatusChange: (s: 'connected' | 'reconnecting' | 'disconnected') => void,
  ) {}

  connect(): void {
    if (this.destroyed) return;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.onStatusChange('connected');
      this.startPing();
    };

    this.ws.onmessage = (e: MessageEvent<string>) => {
      try {
        this.onMessage(JSON.parse(e.data) as WebSocketMessage);
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.stopPing();
      if (!this.destroyed) {
        this.onStatusChange('reconnecting');
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect(): void {
    this.destroyed = true;
    this.stopPing();
    this.onStatusChange('disconnected');
    this.ws?.close();
  }

  private scheduleReconnect(): void {
    const delay = Math.min(Math.pow(2, this.reconnectAttempt) * 1000, 30000);
    this.reconnectAttempt += 1;
    setTimeout(() => this.connect(), delay);
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
