// Builds the package that deploy.sh installs on the cPanel server. See README.md here.
// Usage: node deploy/cpanel/build.mjs [--env <file from `vercel env pull`>]
// Normal updates don't need --env: the server keeps its own .env. With --env (only for setting up
// a new server), the package includes the production .env, so it holds secrets: keep it private.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const BACKEND = path.join(ROOT, "apps/backend");
const FRONTEND = path.join(ROOT, "apps/frontend");
const OUT = path.join(HERE, "out");
const APP = path.join(OUT, "errandspot");

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: true, ...options });
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed`);
}

function installedVersion(name) {
  for (const dir of [path.join(BACKEND, "node_modules"), path.join(ROOT, "node_modules")]) {
    const file = path.join(dir, name, "package.json");
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")).version;
  }
  throw new Error(`${name} isn't installed; run npm install first`);
}

function quoteEnv(value) {
  if (!value.includes('"')) return `"${value.replace(/\n/g, "\\n")}"`;
  if (!value.includes("'") && !value.includes("\n")) return `'${value}'`;
  throw new Error("A value contains both quote characters; write it to .env by hand");
}

// 1. Build both apps. A stale tsbuildinfo makes `nest build` silently skip files.
fs.rmSync(path.join(BACKEND, "tsconfig.build.tsbuildinfo"), { force: true });
run("npm", ["run", "build", "--workspace=@errandy/backend"], { cwd: ROOT });
// Passed straight to the child process, so Git Bash can't rewrite "/api" into a Windows path.
run("npx", ["vite", "build"], { cwd: FRONTEND, env: { ...process.env, VITE_API_URL: "/api" } });
for (const file of fs.readdirSync(path.join(FRONTEND, "dist/assets"))) {
  if (/localhost:\d+|Program Files/.test(fs.readFileSync(path.join(FRONTEND, "dist/assets", file), "utf8"))) {
    throw new Error(`The frontend build points at the wrong API address (${file})`);
  }
}

// 2. Assemble the app folder.
fs.rmSync(APP, { recursive: true, force: true });
fs.mkdirSync(path.join(APP, "prisma"), { recursive: true });
fs.cpSync(path.join(BACKEND, "dist"), path.join(APP, "dist"), { recursive: true });
fs.cpSync(path.join(FRONTEND, "dist"), path.join(APP, "web"), { recursive: true });
fs.copyFileSync(path.join(BACKEND, "prisma/schema.prisma"), path.join(APP, "prisma/schema.prisma"));
fs.cpSync(path.join(BACKEND, "prisma/migrations"), path.join(APP, "prisma/migrations"), { recursive: true });
fs.copyFileSync(path.join(HERE, "server.js"), path.join(APP, "server.js"));
// bash on the server fails on Windows line endings.
for (const script of ["cron.sh", "backup.sh", "deploy.sh"]) {
  fs.writeFileSync(path.join(APP, script), fs.readFileSync(path.join(HERE, script), "utf8").replace(/\r\n/g, "\n"));
}

// Which build this is: deploy.sh and /api/health use the id to tell versions apart.
const git = (...args) => spawnSync("git", args, { cwd: ROOT, encoding: "utf8" }).stdout.trim();
const commit = process.env.GITHUB_SHA || git("rev-parse", "HEAD");
const uncommitted = !process.env.GITHUB_SHA && git("status", "--porcelain", "--", "apps", "deploy", "vercel.json") !== "";
const builtAt = new Date();
const stamp = builtAt.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 13); // 20261120-0830
const release = { id: `${stamp}-${commit.slice(0, 7)}${uncommitted ? "-local" : ""}`, commit, builtAt: builtAt.toISOString() };
fs.writeFileSync(path.join(APP, "release.json"), `${JSON.stringify(release, null, 2)}\n`);

// The page headers stay defined in one place: vercel.json.
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const pageHeaders = Object.fromEntries(vercel.headers[0].headers.map((h) => [h.key, h.value]));
pageHeaders["Strict-Transport-Security"] = "max-age=63072000"; // Vercel adds this itself; cPanel doesn't
fs.writeFileSync(path.join(APP, "page-headers.json"), `${JSON.stringify(pageHeaders, null, 2)}\n`);

// Exact versions of what the backend runs with today, plus what server.js and `prisma generate` need.
const backendPkg = JSON.parse(fs.readFileSync(path.join(BACKEND, "package.json"), "utf8"));
const dependencies = {};
for (const name of [...Object.keys(backendPkg.dependencies), "express", "prisma"].sort()) {
  dependencies[name] = installedVersion(name);
}
const appPkg = {
  name: "errandspot",
  private: true,
  version: "1.0.0",
  main: "server.js",
  engines: { node: ">=20" },
  scripts: {
    // cPanel runs npm from ~/nodevenv/<app>/<version>/lib, where package.json is a symlink back to
    // the app folder; following it finds prisma/schema.prisma from either place.
    postinstall: 'prisma generate --schema "$(dirname "$(readlink -f package.json)")/prisma/schema.prisma"',
    start: "node server.js",
  },
  dependencies,
};
fs.writeFileSync(path.join(APP, "package.json"), `${JSON.stringify(appPkg, null, 2)}\n`);
// A lockfile makes the server's install fetch exact versions instead of resolving the whole tree,
// which is faster, repeatable, and avoids an npm hang seen when resolving this tree from scratch.
run("npm", ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: APP });

// 3. The server's settings, taken from the production env (only the keys the app uses).
const envIndex = process.argv.indexOf("--env");
if (envIndex > -1) {
  const source = dotenv.parse(fs.readFileSync(process.argv[envIndex + 1]));
  const keys = [...fs.readFileSync(path.join(BACKEND, ".env.example"), "utf8").matchAll(/^([A-Z][A-Z0-9_]*)=/gm)]
    .map((m) => m[1])
    .filter((key) => key !== "PORT" && key !== "NODE_ENV");
  const lines = ["NODE_ENV=production"];
  const missing = [];
  for (const key of keys) {
    if (source[key]) lines.push(`${key}=${quoteEnv(source[key])}`);
    else missing.push(key);
  }
  fs.writeFileSync(path.join(APP, ".env"), `${lines.join("\n")}\n`, { mode: 0o600 });
  console.log(`.env written with ${lines.length - 1} settings. Not set in production: ${missing.join(", ") || "none"}`);
}

// 4. Pack it. On Windows this is the system's own bsdtar, not Git Bash's tar, which would read
// "C:" as a remote host.
const pkg = path.join(OUT, "errandspot.tgz");
fs.rmSync(pkg, { force: true });
const tar = process.platform === "win32" ? "C:\\Windows\\System32\\tar.exe" : "tar";
run(tar, ["-czf", "errandspot.tgz", "errandspot"], { cwd: OUT });
console.log(`\nReady: ${pkg} (release ${release.id})`);
