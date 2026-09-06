# ============================================
#  Author App — Docker 多阶段构建
# ============================================
#  用法:
#    docker compose up -d          # 启动
#    docker compose down           # 停止
#    docker compose up -d --build  # 重新构建
# ============================================

# Node 24 LTS; refresh the tag and digest together (see DOCKER.md).
FROM node:24.20.0-alpine3.24@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS base

# ---- 阶段1: 安装依赖 ----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Electron is a build-time dependency of the repository, not a Docker runtime.
# Fetch mirrored lockfile URLs from the official registry, retaining locked
# versions and integrity hashes; do not depend on a regional mirror CDN.
RUN ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --registry=https://registry.npmjs.org --replace-registry-host=registry.npmmirror.com

# ---- 阶段2: 构建 ----
FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Firebase 环境变量（构建时注入，用于云同步功能）
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID

RUN npm run build

# ---- 阶段3: 生产运行 ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV DATA_DIR="/app/data"

# 从构建产物复制 standalone + static + public
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 创建数据持久化目录
RUN mkdir -p /app/data && chown -R node:node /app/data
VOLUME /app/data

USER node

EXPOSE 3000

CMD ["node", "server.js"]
