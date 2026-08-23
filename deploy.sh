#!/usr/bin/env bash
# Deploy one image tag, verify it serves traffic, roll back if it does not.
#
#   ./deploy.sh ghcr.io/mahditeymori/revayat-web:<sha>   # deploy that image
#   ./deploy.sh                                          # redeploy current pin
#   ./rollback.sh                                        # return to previous
#
# Data lives in the revayat_data volume and is never touched here.
set -euo pipefail

cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.yml"
PIN=.deploy-image        # image currently deployed
PREV=.deploy-image.prev  # last image known to have served traffic

[ -f .env ] || { echo "error: .env missing on this host — copy .env.example and fill it in"; exit 1; }

# A deploy without the gateway credential brings up a site that cannot take
# money. Catching it here beats finding out from a customer at checkout.
grep -qE '^ZIBAL_MERCHANT=.+' .env || {
  echo "error: ZIBAL_MERCHANT is missing or empty in .env — checkout would be unable to take payments"
  exit 1
}

NEW_IMAGE="${1:-}"
if [ -z "$NEW_IMAGE" ]; then
  [ -f "$PIN" ] || { echo "error: no image given and no $PIN to fall back on"; exit 1; }
  NEW_IMAGE="$(cat "$PIN")"
fi

OLD_IMAGE=""
[ -f "$PIN" ] && OLD_IMAGE="$(cat "$PIN")"

echo "==> deploying $NEW_IMAGE"
docker pull "$NEW_IMAGE"

echo "$NEW_IMAGE" > "$PIN"
WEB_IMAGE="$NEW_IMAGE" $COMPOSE up -d --no-deps web

# Wait for the container healthcheck rather than a fixed sleep.
echo "==> waiting for health"
for i in $(seq 1 30); do
  cid="$($COMPOSE ps -q web)"
  state="$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo starting)"
  case "$state" in
    healthy) echo "==> healthy"; break ;;
    unhealthy) state=unhealthy; break ;;
  esac
  [ "$i" = 30 ] && state=timeout
  sleep 2
done

if [ "$state" != "healthy" ]; then
  echo "!! deploy failed ($state)"
  if [ -n "$OLD_IMAGE" ] && [ "$OLD_IMAGE" != "$NEW_IMAGE" ]; then
    echo "==> rolling back to $OLD_IMAGE"
    echo "$OLD_IMAGE" > "$PIN"
    WEB_IMAGE="$OLD_IMAGE" $COMPOSE up -d --no-deps web
  fi
  exit 1
fi

# Only record a known-good image after it proved healthy.
[ -n "$OLD_IMAGE" ] && [ "$OLD_IMAGE" != "$NEW_IMAGE" ] && echo "$OLD_IMAGE" > "$PREV"

$COMPOSE up -d          # reconcile nginx/certbot if their config changed
docker image prune -f --filter "until=168h" >/dev/null 2>&1 || true
echo "==> deployed $NEW_IMAGE"
