#!/bin/sh
# Owns the certificate lifecycle.
#
# 1. On first boot, drop a self-signed placeholder so nginx can start at all —
#    without it nginx dies on a missing ssl_certificate, and then certbot's
#    webroot challenge has no server on :80 to answer it.
# 2. Then renew on a loop. `certbot renew` is a no-op until a real certificate
#    exists, so obtaining the first one stays a deliberate manual step
#    (see DEPLOY.md) rather than something that silently burns rate limits.
set -e

DOMAIN="${CERT_DOMAIN:-revayat.shop}"
LIVE="/etc/letsencrypt/live/$DOMAIN"

if [ ! -f "$LIVE/fullchain.pem" ]; then
  echo "[certbot] no certificate for $DOMAIN — writing self-signed placeholder"
  mkdir -p "$LIVE"
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "$LIVE/privkey.pem" \
    -out "$LIVE/fullchain.pem" \
    -subj "/CN=$DOMAIN" 2>/dev/null
  echo "[certbot] placeholder ready — run the certonly command in DEPLOY.md to get a real certificate"
fi

trap exit TERM
while :; do
  certbot renew --webroot -w /var/www/certbot --quiet || true
  sleep 12h & wait $!
done
