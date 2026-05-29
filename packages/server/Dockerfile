# =============================================================================
# Ad Studio — Server Dockerfile
# Multi-stage build: development hot-reload + production optimized image
# Oracle Cloud Container Instances compatible
# =============================================================================

FROM node:20-slim AS base

# Install system dependencies required by Puppeteer and FFmpeg
RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use the system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./

# ── Development stage ────────────────────────────────────────────────────────
FROM base AS development

RUN npm install
COPY . .
CMD ["npm", "run", "dev"]

# ── Build stage ──────────────────────────────────────────────────────────────
FROM base AS build

RUN npm ci --only=production
COPY . .
RUN npm run build

# ── Production stage ─────────────────────────────────────────────────────────
FROM node:20-slim AS production

# Only runtime deps for Puppeteer/FFmpeg in prod image
RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 3001

# Run as non-root for Oracle Cloud security compliance
RUN useradd -r -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

CMD ["node", "dist/index.js"]
