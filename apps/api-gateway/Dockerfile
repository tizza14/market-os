FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages/shared-types ./packages/shared-types
COPY packages/config ./packages/config
COPY apps/api-gateway ./apps/api-gateway

RUN npm ci --include-workspace-root --workspaces
RUN npm run build -w packages/shared-types
RUN npm run build -w packages/config
RUN npm run build -w apps/api-gateway

FROM node:20-alpine AS runtime
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared-types ./packages/shared-types
COPY packages/config ./packages/config
COPY apps/api-gateway/package.json ./apps/api-gateway/

RUN npm ci --include-workspace-root --workspaces --omit=dev

COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/apps/api-gateway/dist ./apps/api-gateway/dist

WORKDIR /app/apps/api-gateway
ENV NODE_ENV=production
USER node

CMD ["node", "dist/main.js"]
