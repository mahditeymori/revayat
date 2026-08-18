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
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_ENAMAD_CODE=$NEXT_PUBLIC_ENAMAD_CODE
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Seed data ships in a separate directory, NOT in /app/data. /app/data is the
# mount point for the production volume — anything copied there would be
# shadowed by the volume at runtime, leaving the image copy permanently stale
# while the app writes to the volume. docker-entrypoint.sh copies missing files
# across on first boot instead.
COPY --from=builder --chown=nextjs:nodejs /app/data ./data-seed
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0 DATA_DIR=/app/data
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
