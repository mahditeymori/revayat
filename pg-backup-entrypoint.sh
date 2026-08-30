#!/bin/sh
# Scheduled pg_dump loop for the `backup` compose service. Runs a dump
# immediately on boot, then every BACKUP_INTERVAL_HOURS (default 24), pruning
# dumps older than BACKUP_RETENTION_DAYS (default 14). Plain custom-format
# pg_dump (-Fc) so a single file restores with pg_restore --clean --if-exists.
set -e

: "${BACKUP_DIR:=/backups}"
: "${BACKUP_INTERVAL_HOURS:=24}"
: "${BACKUP_RETENTION_DAYS:=14}"
: "${PGHOST:=db}"

mkdir -p "$BACKUP_DIR"

while true; do
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  dest="$BACKUP_DIR/revayat-$stamp.dump"
  echo "[backup] dumping to $dest"
  if pg_dump -Fc -f "$dest"; then
    echo "[backup] ok"
  else
    echo "[backup] pg_dump failed, leaving previous backups in place" >&2
    rm -f "$dest"
  fi

  find "$BACKUP_DIR" -name 'revayat-*.dump' -mtime "+$BACKUP_RETENTION_DAYS" -print -delete

  sleep "$((BACKUP_INTERVAL_HOURS * 3600))"
done
