#!/bin/sh
# Seed DATA_DIR from the image's data-seed/ on first boot only.
#
# Production data (products.json, settings.json, orders.json, uploads/) lives in
# a Docker volume so it survives image rebuilds. Files are copied only when
# missing — an existing file is never overwritten, so a deploy can never clobber
# admin edits. This replaces the old approach of COPYing data into /app/data,
# where the volume mount shadowed the image copy and left the two out of sync.
set -e

: "${DATA_DIR:=/app/data}"
mkdir -p "$DATA_DIR/uploads"

if [ -d /app/data-seed ]; then
  for src in /app/data-seed/*.json; do
    [ -e "$src" ] || continue
    dest="$DATA_DIR/$(basename "$src")"
    if [ ! -e "$dest" ]; then
      echo "[entrypoint] seeding $(basename "$src")"
      cp "$src" "$dest"
    fi
  done
fi

exec "$@"
