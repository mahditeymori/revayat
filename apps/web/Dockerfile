FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_ENAMAD_CODE
# Build-time-only placeholder. db/client.ts throws at module load if
# DATABASE_URL is unset, and Next traces/loads every route module during
# `next build` regardless of force-dynamic — but postgres-js's postgres()
# call is lazy and never actually connects until a query runs, so a fake
# connection string satisfies the module load without needing a reachable
# database during the image build. The real value comes from the `db`
# compose service at container start.
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_ENAMAD_CODE=$NEXT_PUBLIC_ENAMAD_CODE \
    DATABASE_URL=$DATABASE_URL
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Migrations run on every boot via docker-entrypoint.sh (idempotent — Drizzle
# tracks applied migrations in its own table). scripts/migrate.mjs uses only
# drizzle-orm/postgres, not drizzle-kit, since devDependencies aren't shipped
# in this image; both packages are zero-dependency, so copying just their
# folders (rather than relying on Next's standalone trace) is sufficient.
COPY --from=builder --chown=nextjs:nodejs /app/src/db/migrations ./src/db/migrations
COPY --chown=nextjs:nodejs scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/postgres ./node_modules/postgres

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0 MEDIA_UPLOADS_DIR=/app/uploads
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
