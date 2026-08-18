#!/bin/sh
# nginx refuses to start when ssl_certificate points at a missing file, but
# certbot's webroot challenge needs nginx already serving :80 to obtain one.
# The certbot container writes a self-signed placeholder on boot (it has
# openssl; nginx:alpine does not), so here we just wait for it to appear.
# certbot later replaces it with the real certificate and the 12h reload
# picks that up without a restart.
set -e

LIVE=/etc/letsencrypt/live/revayat.shop

i=0
while [ ! -f "$LIVE/fullchain.pem" ]; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "[nginx] no certificate after 60s — is the certbot container running?" >&2
    exit 1
  fi
  [ "$i" = 1 ] && echo "[nginx] waiting for certificate…"
  sleep 1
done

# Reload periodically so renewed certificates are picked up without a restart.
while :; do
  sleep 12h & wait $!
  nginx -s reload
done &

exec nginx -g 'daemon off;'
