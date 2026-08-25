import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { json, urlencoded } from "express";
import { createHmac } from "crypto";
import * as request from "supertest";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleFixture.createNestApplication({ bodyParser: false });
  app.use(
    json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(urlencoded({ extended: true }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.init();
  return app;
}

/** Drives a user through KYC via the real start + webhook endpoints (stubbed Smile ID job id, real HMAC). */
export async function verifyUserKyc(app: INestApplication, accessToken: string): Promise<void> {
  const startRes = await request(app.getHttpServer())
    .post("/kyc/start")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ consent: true })
    .expect(201);
  const jobId = startRes.body.smileJobId;
  const payload = { job_id: jobId, status: "approved" };
  const timestamp = new Date().toISOString();
  const signature = createHmac("sha256", process.env.SMILE_ID_API_KEY!)
    .update(timestamp)
    .update(process.env.SMILE_ID_PARTNER_ID!)
    .update("sid_request")
    .digest("base64");
  await request(app.getHttpServer())
    .post("/kyc/webhook")
    .set("smileid-timestamp", timestamp)
    .set("smileid-request-signature", signature)
    .send(payload)
    .expect(201);
}

export async function cleanDatabase(prisma: PrismaClient) {
  await prisma.analyticsEvent.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.report.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.kycVerification.deleteMany();
  await prisma.user.deleteMany();
}
