# syntax=docker/dockerfile:1

FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json ./
COPY domains/projects-workflow/package.json domains/projects-workflow/package.json
COPY packages/requirements-engine/package.json packages/requirements-engine/package.json
COPY packages/gis/package.json packages/gis/package.json
COPY packages/location-intelligence/package.json packages/location-intelligence/package.json
COPY packages/properties/package.json packages/properties/package.json
COPY packages/decision-analytics/package.json packages/decision-analytics/package.json
COPY packages/financial-engine/package.json packages/financial-engine/package.json
COPY packages/domain-due-diligence/package.json packages/domain-due-diligence/package.json
COPY packages/decision-output/package.json packages/decision-output/package.json
COPY packages/data-ai-automation/package.json packages/data-ai-automation/package.json
RUN npm install --no-audit --no-fund

FROM dependencies AS builder
WORKDIR /app
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
