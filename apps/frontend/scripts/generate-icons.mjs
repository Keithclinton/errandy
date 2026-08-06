import sharp from "sharp";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(dir, "../public");

const icon = readFileSync(path.join(dir, "icon-source.svg"));
const maskable = readFileSync(path.join(dir, "icon-maskable-source.svg"));

await sharp(icon).resize(192, 192).png().toFile(path.join(publicDir, "icon-192.png"));
await sharp(icon).resize(512, 512).png().toFile(path.join(publicDir, "icon-512.png"));
await sharp(icon).resize(180, 180).png().toFile(path.join(publicDir, "apple-touch-icon.png"));
await sharp(maskable).resize(512, 512).png().toFile(path.join(publicDir, "icon-maskable-512.png"));

console.log("Icons generated.");
