import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { WS_MESSAGE_TYPES, ERROR_CODES } from '@market-os/config';
import type { MarketBroadcast } from '../services/marketBroadcast.js';

const WS_MAX_CONNECTIONS = Number(process.env['WS_MAX_CONNECTIONS'] ?? 50);
let connectionCount = 0;

export interface WsDeps {
  broadcast: MarketBroadcast;
}

export function registerWebSocketRoutes(fastify: FastifyInstance, deps: WsDeps): void {
  fastify.get('/ws/market', { websocket: true }, (socket: WebSocket) => {
    if (connectionCount >= WS_MAX_CONNECTIONS) {
      socket.close(1013, 'Maximum connections reached');
      fastify.log.warn({ connectionCount, max: WS_MAX_CONNECTIONS }, 'WS connection rejected: max limit');
      return;
    }

    connectionCount++;
    fastify.log.info({ totalConnections: connectionCount }, 'WS client connected');

    const onUpdate = (msg: unknown): void => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(msg));
      }
    };

    deps.broadcast.on('market:update', onUpdate);

    socket.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as { type?: string };
        if (msg.type === WS_MESSAGE_TYPES.PING) {
          socket.send(JSON.stringify({ type: WS_MESSAGE_TYPES.PONG, timestamp: Date.now() }));
        }
      } catch {
        // ignore malformed messages
      }
    });

    socket.on('close', () => {
      connectionCount--;
      deps.broadcast.off('market:update', onUpdate);
      fastify.log.info({ totalConnections: connectionCount }, 'WS client disconnected');
    });

    socket.on('error', (err) => {
      fastify.log.error({ err: err.message }, 'WS client error');
    });

    if (!deps.broadcast.connected) {
      socket.send(JSON.stringify({
        type: WS_MESSAGE_TYPES.MARKET_ERROR,
        data: { code: ERROR_CODES.SOURCE_DISCONNECTED, message: 'Market data source temporarily unavailable' },
      }));
    }
  });
}
