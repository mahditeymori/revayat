#!/bin/sh
# nginx refuses to start when ssl_certificate points at a missing file, but
# certbot's webroot challenge needs nginx already serving :80 to obtain one.
# Break the deadlock with a self-signed placeholder: nginx boots, certbot
# replaces the files with a real certificate, the 12h reload picks it up.
set -e

LIVE=/etc/letsencrypt/live/revayat.shop

if [ ! -f "$LIVE/fullchain.pem" ]; then
  echo "[nginx] no certificate found — generating self-signed placeholder"
  mkdir -p "$LIVE"
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "$LIVE/privkey.pem" \
    -out "$LIVE/fullchain.pem" \
    -subj "/CN=revayat.shop" 2>/dev/null
  echo "[nginx] placeholder in place — run certbot to obtain the real certificate"
fi

# Reload periodically so renewed certificates are picked up without a restart.
while :; do
  sleep 12h & wait $!
  nginx -s reload
done &

exec nginx -g 'daemon off;'
