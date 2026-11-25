#!/bin/bash
# Backs up the database into ~/backups/db: backup.sh [label]
#   hourly  (cron, every hour)  kept 2 days
#   daily   (cron, every night) kept 30 days, and loaded into the off-site copy (below)
#   other   (deploy.sh passes before-<version> ahead of new migrations) kept 30 days
# The database runs on this server, so its backups alone wouldn't survive losing the server or
# the account. The daily one is also loaded into the Neon database in NEON_BACKUP_URL (the app's
# database before 2026-11-25), which then holds a full working copy, at most a day old.
# Each night it also copies the uploaded photos (UPLOADS_DIR) into ~/backups/photos/<date>, kept
# 30 days. Photos never change, so each copy shares the unchanged ones with the night before and
# only takes space for the new ones.
# Restore: see README.md.
set -uo pipefail
umask 077

HERE="$(cd "$(dirname "$0")" && pwd)"
PG="$HOME/pgsql18" # PostgreSQL 18 client tools, installed by hand (see README.md)
DEST="$HOME/backups/db"
LABEL="${1:-daily}"
mkdir -p "$DEST"
export LD_LIBRARY_PATH="$PG/lib"

log() { echo "$(date -u +%FT%TZ) $*" >>"$DEST/backup.log"; }
fail() {
  log "FAILED $LABEL: $*"
  echo "Database backup failed: $*" >&2
  exit 1
}

# Prints `export PG...=` lines for the database in .env setting $1, so the password is passed in
# the environment and never shows in a process list.
connection() {
  python3 - "$HERE/.env" "$1" <<'PY'
import shlex, sys
from urllib.parse import parse_qs, unquote, urlsplit

env = {}
for line in open(sys.argv[1], encoding="utf-8"):
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1]
    env[key.strip()] = value

if not env.get(sys.argv[2]):
    sys.exit(3)
url = urlsplit(env[sys.argv[2]])
query = parse_qs(url.query)
for key, value in {
    "PGHOST": url.hostname,
    "PGPORT": str(url.port or 5432),
    "PGUSER": unquote(url.username or ""),
    "PGPASSWORD": unquote(url.password or ""),
    "PGDATABASE": unquote(url.path.lstrip("/")),
    "PGSSLMODE": query.get("sslmode", ["require"])[0],
}.items():
    print(f"export {key}={shlex.quote(value)}")
PY
}

# DIRECT_URL: the app's database without a connection pooler in front.
settings=$(connection DIRECT_URL) || fail "couldn't read DIRECT_URL from .env"
eval "$settings"
live_host=$PGHOST

file="$DEST/errandspot-$(date -u +%Y%m%d-%H%M%S)-$LABEL.dump"
"$PG/bin/pg_dump" --format=custom --no-owner --no-privileges --file="$file.part" 2>"$DEST/.error" ||
  fail "$(tail -c 400 "$DEST/.error")"
"$PG/bin/pg_restore" --list "$file.part" >/dev/null 2>"$DEST/.error" || fail "the backup can't be read back"
mv "$file.part" "$file"
rm -f "$DEST/.error"

find "$DEST" -name 'errandspot-*-hourly.dump' -mmin +$((48 * 60)) -delete
find "$DEST" -name 'errandspot-*.dump' -mtime +30 -delete
find "$DEST" -name '*.part' -mmin +120 -delete
log "ok $LABEL $(du -h "$file" | cut -f1) $(basename "$file")"

[ "$LABEL" = daily ] || exit 0

# The photos. A failure here is logged but doesn't stop the off-site copy below.
copy_photos() {
  local source dest today previous cutoff snapshot
  source=$(grep '^UPLOADS_DIR=' "$HERE/.env" | tail -1 | cut -d= -f2- | tr -d "\"'")
  [ -n "$source" ] || return 0 # not set up
  [ -d "$source" ] || { log "FAILED photos: $source doesn't exist"; return 1; }
  dest="$HOME/backups/photos"
  today=$(date -u +%Y%m%d)
  mkdir -p "$dest"
  previous=$(find "$dest" -mindepth 1 -maxdepth 1 -type d -name '2*' ! -name "$today" | sort | tail -1)
  rm -rf "$dest/$today.part"
  rsync -a --exclude='*.part' ${previous:+--link-dest="$previous"} "$source/" "$dest/$today.part/" 2>"$DEST/.error" ||
    { log "FAILED photos: $(tail -c 400 "$DEST/.error")"; return 1; }
  rm -rf "${dest:?}/$today" && mv "$dest/$today.part" "$dest/$today"
  rm -f "$DEST/.error"
  # By the date in the name: rsync gives each copy the photo folder's own dates.
  cutoff=$(date -u -d '30 days ago' +%Y%m%d)
  for snapshot in "$dest"/2*; do
    [ -d "$snapshot" ] && [[ "$(basename "$snapshot")" < "$cutoff" ]] && rm -rf "$snapshot"
  done
  log "ok photos $(find "$dest/$today" -type f -name '*.jpg' | wc -l) in $dest/$today"
}
copy_photos || echo "Photo backup failed" >&2

# The off-site copy, from the daily backup. In one transaction, so if loading fails the copy
# keeps the previous day's data.
offsite=$(connection NEON_BACKUP_URL)
case $? in
  0) ;;
  3) exit 0 ;; # not set up
  *) fail "couldn't read NEON_BACKUP_URL from .env" ;;
esac
(
  eval "$offsite"
  # If the app has been pointed back at Neon, loading last night's backup into it would undo
  # everything since.
  if [ "$PGHOST" = "$live_host" ]; then
    log "skipped the off-site copy: the app uses that database"
    exit 0
  fi
  "$PG/bin/pg_restore" --clean --if-exists --no-owner --no-privileges --single-transaction \
    --exit-on-error --dbname="$PGDATABASE" "$file" 2>"$DEST/.error" ||
    { log "FAILED off-site copy: $(tail -c 400 "$DEST/.error")"; echo "Off-site copy failed" >&2; exit 1; }
  rm -f "$DEST/.error"
  log "ok off-site copy loaded into $PGHOST"
)
