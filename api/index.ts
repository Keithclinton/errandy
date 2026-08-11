import type { VercelRequest, VercelResponse } from "@vercel/node";
import express from "express";
// Import the *compiled* output, not the TS source. Vercel's default TS handling
// (esbuild) doesn't emit `emitDecoratorMetadata`, which breaks NestJS's constructor
// injection. Building via `nest build` first (see vercel.json's buildCommand) produces
// correctly-compiled JS that already has the metadata baked in, sidestepping the issue.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createApp } = require("../apps/backend/dist/create-app") as typeof import("../apps/backend/src/create-app");

const server = express();

// Cached across warm invocations of the same Lambda instance so we don't
// re-bootstrap Nest (DB connection, module graph, etc.) on every request.
let bootstrap: Promise<void> | null = null;

function ensureBootstrapped(): Promise<void> {
  if (!bootstrap) {
    bootstrap = createApp(server).then(async (app) => {
      await app.init();
    });
  }
  return bootstrap;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureBootstrapped();
  // This function is reached via the /api/(.*) rewrite in vercel.json, so the
  // incoming path still has the "/api" prefix (e.g. "/api/auth/login"). Nest's
  // routes are unprefixed (e.g. "/auth/login") — same as local dev — so strip it
  // here rather than teaching every route about a prefix it only has in prod.
  if (req.url) {
    req.url = req.url.replace(/^\/api(?=\/|$)/, "") || "/";
  }
  server(req, res);
}
