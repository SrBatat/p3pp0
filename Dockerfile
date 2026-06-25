# =============================================
# p3pp4 — Dockerfile para fly.io
# =============================================
# Build:  docker build -t p3pp4 .
# Run:    docker run -p 3000:3000 -v p3pp4-data:/app/db p3pp4
# =============================================

FROM node:20-slim AS base

# Instalar dependências do sistema + Python + Playwright
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    wget \
    git \
    build-essential \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    libwayland-client0 \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# Instalar Playwright browsers
RUN npx playwright install --with-deps chromium

# Instalar z-ai CLI globalmente
RUN npm install -g z-ai-web-dev-sdk

# Instalar dependências Python para o solver
RUN pip3 install --break-system-packages playwright || true
RUN python3 -m playwright install chromium || true

WORKDIR /app

# =============================================
# Stage: Install dependencies
# =============================================
FROM base AS deps

COPY package.json bun.lock* ./

RUN npm install

# =============================================
# Stage: Build
# =============================================
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Gerar Prisma Client
RUN npx prisma generate

# Build do Next.js (sem standalone para rodar com npm)
RUN npm run build 2>/dev/null || npx next build

# =============================================
# Stage: Production
# =============================================
FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Criar usuário não-root
RUN groupadd --gid 1001 appuser && \
    useradd --uid 1001 --gid appuser --shell /bin/bash --create-home appuser

# Criar diretórios necessários
RUN mkdir -p /app/db /app/download/physics-bot/screenshots /app/upload /app/public && \
    chown -R appuser:appuser /app

WORKDIR /app

# Copiar arquivos do build
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src

# Copiar .env.example como fallback (o fly.io injeta as env vars reais)
COPY --from=builder /app/.env.example ./.env.example

# Gerar Prisma Client no runner também
RUN npx prisma generate

# Criar .env com DATABASE_URL apontando para o volume persistente
RUN echo 'DATABASE_URL="file:./db/custom.db"' > .env

# Criar banco de dados inicial
RUN mkdir -p db && npx prisma db push || true

USER appuser

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Comando para iniciar
CMD ["node", "server.js"]
