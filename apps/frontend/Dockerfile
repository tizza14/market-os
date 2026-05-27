FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages/shared-types ./packages/shared-types
COPY packages/config ./packages/config
COPY apps/frontend ./apps/frontend

RUN npm ci --include-workspace-root --workspaces
RUN npm run build -w packages/shared-types
RUN npm run build -w packages/config
RUN npm run build -w apps/frontend

FROM nginx:alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
