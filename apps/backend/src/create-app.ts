import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, INestApplication } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ExpressAdapter } from "@nestjs/platform-express";
import helmet from "helmet";
import { json, urlencoded, Express } from "express";
import { AppModule } from "./app.module";

/**
 * Builds and initializes the Nest app without starting a listener, so the same
 * setup can back both the local dev server (main.ts) and the Vercel serverless
 * handler (api/index.ts).
 */
export async function createApp(expressInstance?: Express): Promise<INestApplication> {
  // bodyParser disabled here so we can install our own json() below with a `verify`
  // hook that stashes the raw bytes — needed to check the Smile ID webhook's HMAC signature.
  const app = expressInstance
    ? await NestFactory.create(AppModule, new ExpressAdapter(expressInstance), { bodyParser: false })
    : await NestFactory.create(AppModule, { bodyParser: false });

  app.use(helmet());
  app.use(
    json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(urlencoded({ extended: true }));
  // The frontend authenticates with a manually-attached Bearer header, never
  // browser-managed cookies, so there's no `credentials: true` to justify reflecting
  // arbitrary origins — fail closed (deny cross-origin) if CORS_ORIGIN isn't set,
  // rather than defaulting to allow-all.
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("Errandspot API")
    .setDescription("Errands marketplace backend")
    .setVersion("0.1")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  return app;
}
