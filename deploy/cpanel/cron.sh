#!/bin/bash
# Run by cPanel Cron Jobs (see README.md):
#   cron.sh reconcile-payments | digest   in place of vercel.json's crons
#   cron.sh watchdog                      every few minutes: keeps the app awake, restarts it if stuck
cd "$(dirname "$0")" || exit 1
SITE=https://errandspot.com
APP_DIR=$(pwd)

if [ "$1" = "watchdog" ]; then
  # Without ?db=1: only whether the app answers. Restarting it wouldn't fix the database.
  healthy() { curl -fsS -m 20 -o /dev/null "$SITE/api/health"; }
  healthy && exit 0
  sleep 30
  healthy && exit 0
  # LiteSpeed restarts a crashed app by itself; this is for one that is running but stuck.
  mkdir -p "$HOME/releases"
  exec 9>"$HOME/releases/.lock"
  flock -n 9 || exit 0 # a deploy is restarting it anyway
  echo "$(date -u +%FT%TZ) not answering: restarting" >>"$HOME/releases/watchdog.log"
  pkill -u "$(id -un)" -f "^lsnode:$APP_DIR/"
  mkdir -p tmp && touch tmp/restart.txt
  healthy || echo "$(date -u +%FT%TZ) still not answering after the restart" >>"$HOME/releases/watchdog.log"
  exit 0
fi

# CRON_SECRET comes from .env and goes to curl on stdin, so it never appears in a process list.
SECRET=$(grep '^CRON_SECRET=' .env | cut -d= -f2- | tr -d '"')
printf 'Authorization: Bearer %s\n' "$SECRET" |
  curl -fsS -m 120 -H @- "$SITE/api/cron/$1" >/dev/null
