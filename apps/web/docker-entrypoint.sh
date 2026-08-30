#!/bin/sh
# Runs pending Drizzle migrations, then starts the server. Migrations are
# idempotent (Drizzle tracks what's already applied), so running this on
# every boot is safe and means a deploy never ships schema-behind code.
set -e

: "${MEDIA_UPLOADS_DIR:=/app/uploads}"
mkdir -p "$MEDIA_UPLOADS_DIR"

echo "[entrypoint] running database migrations"
node scripts/migrate.mjs

# A container without a merchant id serves a storefront nobody can buy from,
# and the failure only shows up when a customer reaches the last step of
# checkout. Say so once, loudly, at boot — this is exactly the misconfiguration
# that reached production. Not fatal: the catalogue should stay browsable.
if [ -z "${ZIBAL_MERCHANT:-}" ]; then
  echo "[entrypoint] WARNING: ZIBAL_MERCHANT is not set — checkout cannot take payments."
  echo "[entrypoint]          Set it in the server .env, then: docker compose up -d --force-recreate web"
elif [ "${ZIBAL_MERCHANT}" = "zibal" ]; then
  echo "[entrypoint] NOTICE: using Zibal's SANDBOX merchant — no real money will be transferred."
fi

exec "$@"
