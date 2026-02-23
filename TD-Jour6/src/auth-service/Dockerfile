# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production && npm cache clean --force

# Stage 2: Production
FROM node:20-alpine

LABEL maintainer="cloudshop-team"
LABEL version="1.0.0"
LABEL description="CloudShop Auth Service - JWT Authentication"

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules

COPY --chown=appuser:appgroup app.js package.json ./

ENV NODE_ENV=production
ENV PORT=8081

EXPOSE 8081

USER appuser

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8081/auth/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "app.js"]
