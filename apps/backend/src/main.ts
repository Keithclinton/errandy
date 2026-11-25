import * as path from "path";
import { static as serveStatic } from "express";
import { createApp } from "./create-app";

async function bootstrap() {
  const app = await createApp();
  // Uploaded photos (see photos.service.ts). On the server the web server sends them; locally the
  // API does, and Vite passes /uploads on to it.
  app.use("/uploads", serveStatic(path.resolve(process.env.UPLOADS_DIR || "uploads"), { index: false }));
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap();
