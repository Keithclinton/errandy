# Hosting on cPanel

Errandspot runs on cPanel hosting with CloudLinux's **Setup Node.js App**. One Node process
(`server.js`) serves the site and the API under `/api`, so every URL is the same as on Vercel
(the M-Pesa and Google callback URLs don't change).

Live setup (since 2026-11-19): account `errandsp` on 91.204.209.17, app root `~/errandspot`,
Node 22, SSH key `~/.ssh/errandspot_cpanel` on the maintainer's machine.

## Build

```sh
npx vercel env pull prod.env --environment=production   # delete prod.env afterwards
node deploy/cpanel/build.mjs --env prod.env              # omit --env for code-only updates
```

Writes `deploy/cpanel/out/errandspot.zip` (git-ignored). With `--env` it contains the production
`.env`, so treat it as a secret. Vercel hides "sensitive" values such as `BLOB_READ_WRITE_TOKEN`;
add those to the server's `.env` by hand.

## First install (over SSH)

```sh
scp errandspot.zip errandsp@HOST:~/ && ssh errandsp@HOST
unzip -q errandspot.zip && rm errandspot.zip
# Zips made on Windows carry world-writable modes: tighten them.
cd ~/errandspot && find . -type d -exec chmod 755 {} + && find . -type f -exec chmod 644 {} + \
  && chmod 600 .env && chmod 700 cron.sh
cloudlinux-selector create --json --interpreter nodejs --version 22 --app-root errandspot \
  --domain errandspot.com --app-uri "" --app-mode production --startup-file server.js
cloudlinux-selector install-modules --json --interpreter nodejs --app-root errandspot
mv ~/public_html/index.html ~/coming-soon-index.html.bak   # the host's placeholder page
cloudlinux-selector restart --json --interpreter nodejs --app-root errandspot
```

`install-modules` runs npm inside `~/nodevenv/errandspot/22/lib`, where `package.json` is a symlink
back to the app; the `postinstall` script follows it to find `prisma/schema.prisma`.

**HTTPS:** cPanel's "Force HTTPS Redirect" doesn't take effect for the Node app here, so the top of
`~/public_html/.htaccess` has a rewrite rule (between `# BEGIN/END errandspot force https`) that
redirects to https, except `/.well-known/` so certificate renewal keeps working.

**Cron** (`crontab -l`):

```
5 * * * *   /bin/bash /home/errandsp/errandspot/cron.sh reconcile-payments
0 6 * * *   /bin/bash /home/errandsp/errandspot/cron.sh digest
*/4 * * * * curl -s -o /dev/null -m 30 https://errandspot.com/   # keeps the app from sleeping
```

The keep-awake ping hits a page, not the database, so Neon can still suspend when idle.

## Logs and restarts

- Startup and runtime errors: `~/errandspot/stderr.log`
- Restart: `cloudlinux-selector restart --json --interpreter nodejs --app-root errandspot`

## Updating

Apply new database migrations first (they're additive, so the running version keeps working):
`cd ~/errandspot && ~/nodevenv/errandspot/22/bin/npx prisma migrate deploy`. Then upload the new
build, keep the server's `.env`, run `install-modules` and restart.
