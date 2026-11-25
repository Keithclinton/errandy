"use strict";
// Startup file for cPanel's "Setup Node.js App". One Node process serves the React site and the
// API under /api: the same URLs as on Vercel, so the M-Pesa and Google callback URLs stay valid.
// Built into a deployable folder by build.mjs next to this file.
const fs = require("fs");
const path = require("path");

// cPanel may start the app from another directory; .env and prisma/ are read relative to this one.
process.chdir(__dirname);
process.env.NODE_ENV = process.env.NODE_ENV || "production";
// Prisma's engine starts a worker thread per CPU core it can see (24 on the server), but the
// hosting account may run only 100 processes and threads in all, and gets one core anyway.
// At 37 threads a process, a second copy during a restart nearly used the allowance up.
process.env.TOKIO_WORKER_THREADS = process.env.TOKIO_WORKER_THREADS || "2";
// Which build this is (written by build.mjs); /api/health reports it so a deploy can tell the
// new version is the one answering.
process.env.RELEASE_ID = readReleaseId();

function readReleaseId() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "release.json"), "utf8")).id;
  } catch {
    return "unknown";
  }
}

const express = require("express");
const { createApp } = require("./dist/create-app");

const WEB_DIR = path.join(__dirname, "web");
// The headers vercel.json put on every page. API responses get theirs from helmet instead.
const PAGE_HEADERS = require("./page-headers.json");
const setPageHeaders = (res) => {
  for (const [name, value] of Object.entries(PAGE_HEADERS)) res.setHeader(name, value);
};

const site = express();
site.disable("x-powered-by");
// LiteSpeed sits in front and adds the visitor's address to X-Forwarded-For. Trust exactly that one
// hop, so rate limits count each visitor separately rather than everyone as one address.
site.set("trust proxy", 1);

// Express strips the /api prefix before the API sees the request, as api/index.ts did on Vercel.
const api = express();
site.use("/api", api);

site.use(
  express.static(WEB_DIR, {
    index: false,
    setHeaders(res, filePath) {
      setPageHeaders(res);
      const relative = path.relative(WEB_DIR, filePath).replace(/\\/g, "/");
      // Build files have a content hash in their name, so they never change once published.
      res.setHeader("Cache-Control", relative.startsWith("assets/") ? "public, max-age=31536000, immutable" : "no-cache");
    },
  }),
);

// A missing build file is a real 404, not the app's page. So is a missing photo: LiteSpeed sends
// the ones that exist straight from UPLOADS_DIR (~/public_html/uploads) without asking the app.
site.use("/assets", (_req, res) => res.status(404).end());
site.use("/uploads", (_req, res) => res.status(404).end());

// Every other address is a page of the React app, which works out the route itself.
site.get("*", (_req, res) => {
  setPageHeaders(res);
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(WEB_DIR, "index.html"));
});

createApp(api)
  .then((app) => app.init())
  .then(() => {
    const port = process.env.PORT || 3000;
    // deploy.sh starts a trial copy of a new version with LISTEN_HOST=127.0.0.1 before switching
    // to it. cPanel's own start passes only PORT, so that path is left exactly as it was.
    const listenArgs = process.env.LISTEN_HOST ? [port, process.env.LISTEN_HOST] : [port];
    site.listen(...listenArgs, () => console.log(`Errandspot ${process.env.RELEASE_ID} is running (port ${port})`));
  })
  .catch((err) => {
    console.error("Errandspot failed to start:", err);
    process.exit(1);
  });
