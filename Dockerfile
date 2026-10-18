# Multi-stage Dockerfile for Jobee (Single-port API + Web SPA & Worker)
FROM node:22-bookworm-slim AS base

WORKDIR /app

# Install system dependencies needed for Playwright / Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxkbcommon0 \
    && rm -rf /var/lib/apt/lists/*

# Builder stage
FROM base AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY apps/ ./apps/
COPY tsconfig.json tsconfig.base.json ./
COPY scripts/sync-preview-assets.mjs ./scripts/sync-preview-assets.mjs

# Install all dependencies including devDependencies for compilation
RUN npm ci

# Build all packages and applications (shared, database, config, api, worker, web)
RUN npm run build

# Runner stage
FROM base AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV API_PORT=3000
ENV API_HOST=0.0.0.0

# Configure Playwright shared browser cache path accessible by non-root node user
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json

# Install Chromium browser binary for Playwright and grant non-root permissions
RUN mkdir -p /ms-playwright && \
    npx playwright install chromium && \
    chown -R node:node /app /ms-playwright

# Drop root privileges for defense-in-depth Playwright and container security
USER node

EXPOSE 3000

# Default entrypoint runs the unified API & Web server
CMD ["node", "apps/api/dist/index.js"]
