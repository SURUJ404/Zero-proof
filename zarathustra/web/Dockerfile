FROM node:20-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS runtime
WORKDIR /app
RUN groupadd -r zarathustra && useradd -r -g zarathustra -m -d /app zarathustra

COPY --from=builder /app/node_modules ./node_modules
COPY package.json server.js ./
COPY public/ ./public/

RUN mkdir -p /app/work /data/work && \
    chown -R zarathustra:zarathustra /app /data

USER zarathustra
EXPOSE 4000

ENV PORT=4000
ENV HOST=0.0.0.0
ENV NODE_ENV=production
ENV WORK_DIR=/app/work

VOLUME /data

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/api/health', r => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
