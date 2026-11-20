# Hosting on cPanel

Errandspot runs on cPanel hosting with CloudLinux's **Setup Node.js App**. One Node process
(`server.js`) serves the site and the API under `/api`, so every URL is the same as on Vercel
(the M-Pesa and Google callback URLs don't change).

Live setup (since 2026-11-19): account `errandsp` on 91.204.209.17 (Brixly, UK), app root
`~/errandspot`, Node 22. The account may use 1 CPU core, 2 GB of memory, 30 simultaneous
requests and 100 processes and threads in all.

## Updating

**Automatically:** push to `main`. CI runs the tests, builds the package and publishes it on the
GitHub release `cpanel-build`; the server checks for it every 2 minutes (`errandspot-deploy pull`
in cron) and installs it. The CI run stays open until errandspot.com reports the new version, and
fails (GitHub emails you) if it doesn't within 15 minutes. GitHub holds no key to the server.

**By hand** (over SSH):

```sh
node deploy/cpanel/build.mjs                                  # on your machine
ssh errandsp@HOST '~/bin/errandspot-deploy deploy' < deploy/cpanel/out/errandspot.tgz
ssh errandsp@HOST '~/bin/errandspot-deploy status'            # what runs, what's kept, last backup
ssh errandsp@HOST '~/bin/errandspot-deploy rollback'          # back to the previous version
```

A deploy leaves the running version alone until the new one has proven itself: it installs the
new version in `~/releases/<id>`, backs up the database if there are new migrations, applies them,
starts a trial copy on 127.0.0.1 and checks `/api/health?db=1`, then swaps folders and restarts.
If the live site doesn't answer as the new version within 2 minutes, it swaps back. The last 3
versions are kept for `rollback`, which takes seconds. After a rollback, automatic updates skip
the version rolled back from and resume with the next push. A build that fails 3 times is skipped
too. Progress and errors: `~/releases/deploy.log`.

**Migrations must keep working with the previous version**, because a rollback doesn't undo them:
add tables and columns; drop or rename them only in a later release.

## How the server is laid out

- `~/errandspot`: the running version. Its packages are in `.modules`, and `node_modules` links
  to them, so every version has its own packages and switching back needs no install.
- `~/nodevenv/errandspot/22/lib/node_modules` (cPanel's environment for the app) links to
  `~/errandspot/.modules`, so cPanel's **Restart** button keeps working. Don't press **Run NPM
  Install**: deploys install packages themselves.
- `~/errandspot/.env`: the settings. Edit it there, then restart (deploys copy it forward).
- `~/releases`: previous versions, `deploy.log`, `watchdog.log`.
- `~/bin/errandspot-deploy`: the deploy script (`deploy.sh`; each deploy refreshes it).
- `~/pgsql18`: PostgreSQL 18 client tools, unpacked from the PGDG packages for RHEL 9
  (`postgresql18` and `postgresql18-libs`). The system's are version 13, too old for Neon.
- `~/backups/db`: database backups.

**Restarts:** LiteSpeed doesn't always notice `tmp/restart.txt` after the folders are swapped,
and after a restart it leaves the old process idling, holding part of the 100-process allowance.
`deploy.sh` stops such processes. `server.js` also caps Prisma's engine at 2 threads
(`TOKIO_WORKER_THREADS`); left alone it starts one per core it can see, 24 on this server.

## Cron

```
5 * * * *    cron.sh reconcile-payments   # payments whose M-Pesa callback never came
0 6 * * *    cron.sh digest               # unread-messages emails
*/4 * * * *  cron.sh watchdog             # keeps the app awake; restarts it if it stops answering
*/2 * * * *  errandspot-deploy pull       # installs new builds
30 23 * * *  backup.sh                    # 02:30 in Nairobi
```

The host adds a random delay of up to a minute to each job and sets `MAILTO=""`. To get an email
when a backup fails, enter your address under cPanel → Cron Jobs → Cron Email.

The watchdog checks `/api/health` without `?db=1`, so it doesn't wake the database and Neon can
still suspend when idle (the free plan has limited compute hours). The same goes for the uptime
check in `.github/workflows/uptime.yml`, which checks the database once an hour.

## Backups

`backup.sh` writes `~/backups/db/errandspot-<time>-<label>.dump` (pg_dump's custom format) daily
and before each deploy that brings migrations, checks that the file reads back, and keeps 30 days.
Results go to `~/backups/db/backup.log`. Photos aren't included: they live in Vercel Blob.

To restore into an empty database (a new Neon database, say), with its connection string in
`$TARGET_URL`:

```sh
LD_LIBRARY_PATH=~/pgsql18/lib ~/pgsql18/bin/pg_restore --no-owner --no-privileges \
  --dbname="$TARGET_URL" ~/backups/db/errandspot-<time>-<label>.dump
```

## Logs

- App errors: `~/errandspot/stderr.log`
- Deploys: `~/releases/deploy.log`; packages, migrations and the trial run of the version in
  place: `~/errandspot/{npm-install,migrate,trial}.log`
- Health: `https://errandspot.com/api/health` (add `?db=1` to include the database)

## Load testing

`deploy/loadtest/errandspot.js` (k6) simulates people using the site at once: half browsing signed
out, half signed in with the app open. Run it from GitHub (Actions → **Load test** → Run workflow),
which spreads it over 4 runners. Don't run it from your own connection: the host's firewall may
block your address, cPanel and SSH included. The test makes its own throwaway accounts.

```sh
scp deploy/loadtest/data.js errandsp@HOST:~/loadtest-data.js
ssh errandsp@HOST
cd ~/errandspot && node ~/loadtest-data.js seed               # 40 test listings, so pages have data
echo 'THROTTLE_LIMIT_PER_MINUTE=1000000' >> .env && touch tmp/restart.txt
#   ... run the workflow, once per number of users ...
sed -i '/^THROTTLE_LIMIT_PER_MINUTE=/d' .env && touch tmp/restart.txt   # never leave it raised
node ~/loadtest-data.js cleanup                               # test listings and accounts
```

(After `touch tmp/restart.txt`, check `/api/health` shows the app restarted; if LiteSpeed missed
it, `pkill -f '^lsnode:/home/errandsp/errandspot/'` and the next request starts it.)

## Setting up a new server

1. In cPanel: **SSH Access** → import or generate a key and authorize it.
2. Build with the production settings (delete `prod.env` afterwards; the package then holds
   secrets, so keep it private). Vercel hides "sensitive" values such as `BLOB_READ_WRITE_TOKEN`:
   add those to the server's `.env` by hand.

   ```sh
   npx vercel env pull prod.env --environment=production
   node deploy/cpanel/build.mjs --env prod.env
   ```

3. Upload and create the app:

   ```sh
   scp errandspot.tgz errandsp@HOST:~/ && ssh errandsp@HOST
   tar xzf errandspot.tgz && rm errandspot.tgz && cd ~/errandspot
   find . -type d -exec chmod 755 {} + && find . -type f -exec chmod 644 {} + && chmod 600 .env && chmod 700 *.sh
   cloudlinux-selector create --json --interpreter nodejs --version 22 --app-root errandspot \
     --domain errandspot.com --app-uri "" --app-mode production --startup-file server.js
   cloudlinux-selector install-modules --json --interpreter nodejs --app-root errandspot
   mv ~/public_html/index.html ~/coming-soon-index.html.bak   # the host's placeholder page
   mkdir -p ~/bin && cp deploy.sh ~/bin/errandspot-deploy && chmod 700 ~/bin/errandspot-deploy
   ```

   `install-modules` runs npm in `~/nodevenv/errandspot/22/lib`, where `package.json` links back
   to the app; the `postinstall` script follows the link to find `prisma/schema.prisma`. The
   first deploy moves those packages into the release layout above.

4. **HTTPS:** cPanel's "Force HTTPS Redirect" doesn't take effect for the Node app, so put this at
   the top of `~/public_html/.htaccess` (it leaves `/.well-known/` alone so certificate renewal
   keeps working):

   ```
   # BEGIN errandspot force https
   RewriteEngine On
   RewriteCond %{HTTPS} !=on
   RewriteCond %{REQUEST_URI} !^/\.well-known/
   RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
   # END errandspot force https
   ```

5. Install the PostgreSQL 18 client tools into `~/pgsql18` (see the layout above) and the cron
   jobs above (`crontab -e`).
