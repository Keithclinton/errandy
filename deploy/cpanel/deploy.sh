#!/bin/bash
# Installs a new Errandspot version on the cPanel server, or goes back to the previous one.
# Installed as ~/bin/errandspot-deploy (each successful deploy refreshes that copy).
#
#   errandspot-deploy pull                      install the latest build from GitHub, if it's new
#   errandspot-deploy deploy < errandspot.tgz   install the package read from stdin
#   errandspot-deploy deploy errandspot.tgz     install a package file
#   errandspot-deploy rollback                  switch back to the version before the current one
#   errandspot-deploy status                    show what's running and what's kept
#
# Automatic deploys: CI tests every push to main, then publishes the package on the GitHub release
# "cpanel-build"; cron runs `pull` every 2 minutes. The server fetches, so GitHub holds no key to it.
#
# The running version keeps serving until the new one has proven itself:
#   1. unpack into ~/releases/<id>, copy the server's .env in, install packages (npm ci)
#   2. apply database migrations, after a backup if the version brings new ones
#   3. start a trial copy on 127.0.0.1 and check it answers /api/health as the new version
#   4. swap folders (~/errandspot <-> ~/releases/<id>), restart, check the live site
#   5. if the live check fails, swap back and restart, so the previous version runs again
# Rollbacks don't undo migrations, so a migration must keep working with the version before it:
# add tables and columns; drop or rename them only in a later release.
set -uo pipefail
umask 022

APP="$HOME/errandspot"
RELEASES="$HOME/releases"
NODE_BIN="/opt/alt/alt-nodejs22/root/usr/bin"
# cPanel's virtual environment for the app. Its node_modules is made a link to the running
# version's packages, so cPanel's own Start/Restart buttons keep working (see adopt_layout).
VENV_MODULES="$HOME/nodevenv/errandspot/22/lib/node_modules"
SITE="${ERRANDSPOT_URL:-https://errandspot.com}"
BUILDS="${ERRANDSPOT_BUILDS:-https://github.com/Keithclinton/errandy/releases/download/cpanel-build}"
KEEP=3
LOG="$RELEASES/deploy.log"

export PATH="$NODE_BIN:$PATH"
export TOKIO_WORKER_THREADS=2 # see server.js
export NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false
export PRISMA_HIDE_UPDATE_MESSAGE=1

mkdir -p "$RELEASES"
TRIAL_PID=""
TMP_DIR=""
cleanup() {
  [[ -n "$TRIAL_PID" ]] && kill "$TRIAL_PID" 2>/dev/null
  [[ -n "$TMP_DIR" ]] && rm -rf "$TMP_DIR"
}
trap cleanup EXIT

log() { echo "$(date -u +%FT%TZ) $*" | tee -a "$LOG" >&2; }
die() { log "FAILED: $*"; exit 1; }

release_id() { sed -n 's/.*"id": *"\([^"]*\)".*/\1/p' "$1/release.json" 2>/dev/null | head -1; }

# The release id answering /api/health at the given base URL, or nothing.
answering() { curl -fsS -m 15 "$1/api/health${2:-}" 2>/dev/null | sed -n 's/.*"release":"\([^"]*\)".*/\1/p'; }

# wait_for <base url> <release id> <seconds>: true once that release answers, database included.
# The original install predates /api/health, so for it the home page has to do.
wait_for() {
  local deadline=$((SECONDS + $3)) got=""
  while ((SECONDS < deadline)); do
    if [[ "$2" == "before-releases" ]]; then
      curl -fsS -m 15 "$1/" 2>/dev/null | grep -q "<title>Errandspot" && return 0
    else
      got=$(answering "$1" "?db=1")
      [[ "$got" == "$2" ]] && return 0
    fi
    sleep 3
  done
  log "expected $2 at $1, got: ${got:-no answer}"
  return 1
}

restart_app() {
  mkdir -p "$APP/tmp" && touch "$APP/tmp/restart.txt" # what cloudlinux-selector restart does
  RESTARTED_AT=$(date +%s)
}

# switch_to <release id>: restarts the app in ~/errandspot and waits until that release answers.
# After the folders were swapped LiteSpeed doesn't always notice restart.txt and keeps the old
# process (still running the old code from its new place under ~/releases), so if the new
# version isn't answering soon, stop the old process: the next request starts the new one.
switch_to() {
  restart_app
  # The original install has no /api/health, so there's no telling which version answers.
  if [[ "$1" != "before-releases" ]] && wait_for "$SITE" "$1" 15; then return 0; fi
  stop_stale_processes
  wait_for "$SITE" "$1" 105
}

# LiteSpeed starts a new process after a restart but leaves the old one idling, holding ~37 of
# the account's 100 processes/threads. Stop app processes that started before the restart.
stop_stale_processes() {
  # (A pipe, not < <(...): CageFS has no /dev/fd for process substitution.)
  local now
  now=$(date +%s)
  ps -u "$(id -un)" -o pid=,etimes=,args= | awk -v app="lsnode:$APP/" '$3 == app { print $1, $2 }' |
    while read -r pid age; do
      if ((now - age < RESTARTED_AT - 1)); then
        kill "$pid" 2>/dev/null && log "stopped stale app process $pid"
      fi
    done
}

# move_aside <dir> <name>: moves a version folder into ~/releases under a free name, prints it.
move_aside() {
  local dest="$RELEASES/$2"
  [[ -e "$dest" ]] && dest="$dest-$(date +%s)"
  mv "$1" "$dest" && touch "$dest" && echo "$dest"
}

# Gives each version its own packages, in <version>/.modules with node_modules linking to it, and
# points cPanel's environment at the running version's. Converts the original layout (where
# node_modules linked to the environment) the first time.
adopt_layout() {
  local dir=$1
  if [[ -L "$dir/node_modules" && ! -e "$dir/.modules" && -d "$VENV_MODULES" && ! -L "$VENV_MODULES" ]]; then
    mv "$VENV_MODULES" "$dir/.modules" && ln -sfn .modules "$dir/node_modules" || return 1
    log "moved the original packages into $(basename "$dir")"
  fi
  if [[ ! -L "$VENV_MODULES" ]]; then
    [[ -e "$VENV_MODULES" ]] && return 1
    ln -s "$APP/.modules" "$VENV_MODULES" || return 1
  fi
}

prune() {
  local dir
  # Keep the newest $KEEP versions besides the running one.
  ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r dir; do
    rm -rf "$dir" && log "removed old version $(basename "$dir")"
  done
}

install_self() {
  mkdir -p "$HOME/bin"
  cp "$APP/deploy.sh" "$HOME/bin/.errandspot-deploy.new" && chmod 700 "$HOME/bin/.errandspot-deploy.new" &&
    mv "$HOME/bin/.errandspot-deploy.new" "$HOME/bin/errandspot-deploy"
}

deploy() {
  local source=${1:--}
  TMP_DIR=$(mktemp -d "$RELEASES/.incoming-XXXXXX")
  if [[ "$source" == "-" ]]; then tar -xzf - -C "$TMP_DIR"; else tar -xzf "$source" -C "$TMP_DIR"; fi ||
    die "couldn't unpack the package"
  [[ -f "$TMP_DIR/errandspot/release.json" ]] || die "that isn't an Errandspot package"

  local id current new
  id=$(release_id "$TMP_DIR/errandspot")
  current=$(release_id "$APP")
  current=${current:-before-releases}
  [[ -n "$id" ]] || die "the package has no release id"
  [[ "$id" != "$current" ]] || die "$id is already running"
  log "deploying $id (running now: $current)"

  new="$RELEASES/$id"
  rm -rf "$new"
  mv "$TMP_DIR/errandspot" "$new" || die "couldn't move the package into place"
  # Packages made on Windows mark every file world-writable.
  find "$new" -type d -exec chmod 755 {} + && find "$new" -type f -exec chmod 644 {} + && chmod 700 "$new"/*.sh
  rm -f "$new/.env"
  cp -p "$APP/.env" "$new/.env" && chmod 600 "$new/.env" || die "couldn't copy the server's .env"

  log "installing packages"
  (cd "$new" && timeout 900 npm ci --omit=dev --loglevel=error >"$new/npm-install.log" 2>&1) ||
    die "npm ci failed: $(tail -c 600 "$new/npm-install.log")"
  mv "$new/node_modules" "$new/.modules" && ln -s .modules "$new/node_modules" || die "couldn't set up node_modules"

  # (Builds made on Windows have CRLF line endings, CI's have LF: that isn't a change.)
  if ! diff -rq --strip-trailing-cr "$APP/prisma/migrations" "$new/prisma/migrations" >/dev/null 2>&1; then
    log "this version has database changes: backing up the database first"
    bash "$new/backup.sh" "before-$id" || die "the database backup failed, so nothing was changed"
  fi
  (cd "$new" && node node_modules/prisma/build/index.js migrate deploy >"$new/migrate.log" 2>&1) ||
    die "migrations failed (the running version is untouched): $(tail -c 600 "$new/migrate.log")"

  local port=$((20000 + RANDOM % 20000))
  log "starting a trial copy on port $port"
  (cd "$new" && PORT=$port LISTEN_HOST=127.0.0.1 exec node server.js >"$new/trial.log" 2>&1) &
  TRIAL_PID=$!
  if ! wait_for "http://127.0.0.1:$port" "$id" 90 ||
    ! curl -fsS -m 15 "http://127.0.0.1:$port/" | grep -q "<title>Errandspot"; then
    die "the trial copy didn't work: $(tail -c 800 "$new/trial.log")"
  fi
  kill "$TRIAL_PID" 2>/dev/null
  wait "$TRIAL_PID" 2>/dev/null
  TRIAL_PID=""

  # Switch. The old folder is kept under ~/releases, for rollbacks.
  local previous
  previous=$(move_aside "$APP" "$current") || die "couldn't move the running version aside"
  if ! mv "$new" "$APP"; then
    mv "$previous" "$APP"
    die "couldn't move the new version into place"
  fi
  adopt_layout "$previous" || log "WARNING: couldn't point cPanel's environment at the new packages"
  if switch_to "$id"; then
    echo "$(basename "$previous")" >"$RELEASES/.previous"
    log "$id is live (previous version kept as $(basename "$previous"))"
    stop_stale_processes
    install_self
    prune
    return 0
  fi

  log "$id failed the live check: switching back to $current"
  move_aside "$APP" "$id-failed" >/dev/null && mv "$previous" "$APP"
  if switch_to "$current"; then stop_stale_processes; else log "WARNING: $current isn't answering either"; fi
  die "$id was rolled back"
}

rollback() {
  local current target target_id
  current=$(release_id "$APP")
  target=$(cat "$RELEASES/.previous" 2>/dev/null)
  [[ -n "$target" && -d "$RELEASES/$target" ]] || die "there's no previous version to go back to"
  target_id=$(release_id "$RELEASES/$target")
  target_id=${target_id:-before-releases}
  log "rolling back from $current to $target_id"
  cp -p "$APP/.env" "$RELEASES/$target/.env" # keep settings changed since
  local parked
  parked=$(move_aside "$APP" "${current:-before-releases}") || die "couldn't move the running version aside"
  if ! mv "$RELEASES/$target" "$APP"; then
    mv "$parked" "$APP"
    die "couldn't move $target_id into place"
  fi
  echo "$(basename "$parked")" >"$RELEASES/.previous"
  # Otherwise `pull` would install the version just rolled back from again.
  [[ -n "$current" ]] && echo "$current" >>"$RELEASES/.skip"
  switch_to "$target_id" || die "$target_id isn't answering after the rollback"
  stop_stale_processes
  log "rolled back: $target_id is live ($(basename "$parked") kept; automatic updates resume with the next build)"
}

# Installs the latest build published by CI, if it's newer than what runs. Quiet otherwise.
pull() {
  local meta id sha current fails package="$RELEASES/.download.tgz"
  meta=$(curl -fsSL -m 30 "$BUILDS/release.json" 2>/dev/null) || return 0
  id=$(echo "$meta" | sed -n 's/.*"id": *"\([^"]*\)".*/\1/p')
  sha=$(echo "$meta" | sed -n 's/.*"sha256": *"\([0-9a-f]*\)".*/\1/p')
  current=$(release_id "$APP")
  [[ -n "$id" && -n "$sha" && "$id" != "$current" ]] || return 0
  grep -qxF "$id" "$RELEASES/.skip" 2>/dev/null && return 0
  # A build that failed 3 times (it rolls back each time) waits for the next push.
  fails=$(grep -cxF "$id" "$RELEASES/.failures" 2>/dev/null)
  ((${fails:-0} >= 3)) && return 0
  curl -fsSL -m 300 -o "$package" "$BUILDS/errandspot.tgz" || return 0
  # CI uploads the package before release.json, so a mismatch means an upload is under way.
  echo "$sha  $package" | sha256sum -c --status || { rm -f "$package"; return 0; }
  if ! (trap cleanup EXIT; deploy "$package"); then
    echo "$id" >>"$RELEASES/.failures"
  fi
  rm -f "$package"
}

status() {
  echo "installed: $(release_id "$APP")"
  echo "answering: $(answering "$SITE")"
  echo "previous:  $(cat "$RELEASES/.previous" 2>/dev/null)"
  echo "kept:      $(ls -1t "$RELEASES" | tr '\n' ' ')"
  echo "latest build: $(curl -fsSL -m 30 "$BUILDS/release.json" 2>/dev/null | sed -n 's/.*"id": *"\([^"]*\)".*/\1/p')"
  echo "last backup: $(tail -1 "$HOME/backups/db/backup.log" 2>/dev/null)"
  tail -5 "$LOG" 2>/dev/null
}

exec 9>"$RELEASES/.lock"
case "${1:-status}" in
deploy)
  flock -n 9 || die "another deploy is running"
  deploy "${2:--}"
  ;;
pull)
  flock -n 9 || exit 0 # a deploy is already running
  pull
  ;;
rollback)
  flock -n 9 || die "a deploy is running"
  rollback
  ;;
status) status ;;
*)
  echo "usage: errandspot-deploy pull | deploy [package.tgz] | rollback | status" >&2
  exit 2
  ;;
esac
