# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV HOSTNAME=0.0.0.0
ENV LOCAL_MEDIA_ROOT=/data/echoline/media
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
