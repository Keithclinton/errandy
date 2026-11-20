#!/bin/bash
# Backs up the database into ~/backups/db and keeps 30 days of backups.
# Run daily by cron, and by deploy.sh before it applies new migrations: backup.sh [label]
# Restore (into an empty database): see README.md.
set -uo pipefail
umask 077

HERE="$(cd "$(dirname "$0")" && pwd)"
PG="$HOME/pgsql18" # PostgreSQL 18 client tools, installed by hand (see README.md)
DEST="$HOME/backups/db"
KEEP_DAYS=30
LABEL="${1:-daily}"
mkdir -p "$DEST"
export LD_LIBRARY_PATH="$PG/lib"

fail() {
  echo "$(date -u +%FT%TZ) FAILED $LABEL: $*" >>"$DEST/backup.log"
  echo "Database backup failed: $*" >&2
  exit 1
}

# The connection comes from DIRECT_URL (pg_dump can't go through Neon's pooler) and is passed in
# the environment, so the password never shows in a process list.
settings=$(python3 - "$HERE/.env" <<'PY'
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

url = urlsplit(env.get("DIRECT_URL") or env["DATABASE_URL"])
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
) || fail "couldn't read the database settings from .env"
eval "$settings"

file="$DEST/errandspot-$(date -u +%Y%m%d-%H%M%S)-$LABEL.dump"
"$PG/bin/pg_dump" --format=custom --no-owner --no-privileges --file="$file.part" 2>"$DEST/.error" ||
  fail "$(tail -c 400 "$DEST/.error")"
"$PG/bin/pg_restore" --list "$file.part" >/dev/null 2>"$DEST/.error" || fail "the backup can't be read back"
mv "$file.part" "$file"
rm -f "$DEST/.error"

find "$DEST" -name 'errandspot-*.dump' -mtime +"$KEEP_DAYS" -delete
find "$DEST" -name '*.part' -mmin +120 -delete
echo "$(date -u +%FT%TZ) ok $LABEL $(du -h "$file" | cut -f1) $(basename "$file")" >>"$DEST/backup.log"
