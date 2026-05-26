import type { FastifyInstance } from 'fastify';
import { ERROR_CODES } from '@market-os/config';

export interface HealthDeps {
  mongoConnected: () => boolean;
  redisConnected: () => boolean;
}

export function registerHealthRoutes(fastify: FastifyInstance, deps: HealthDeps): void {
  fastify.get('/api/health', async (_req, reply) => {
    const mongo = deps.mongoConnected() ? 'connected' : 'disconnected';
    const redis = deps.redisConnected() ? 'connected' : 'disconnected';
    const status = mongo === 'connected' && redis === 'connected' ? 'ok' : 'degraded';

    return reply
      .status(status === 'ok' ? 200 : 503)
      .send({ status, timestamp: Date.now(), services: { mongo, redis } });
  });

  void ERROR_CODES; // satisfy no-unused
}
