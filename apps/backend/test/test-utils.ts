import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { json, urlencoded } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import * as request from "supertest";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { SmileIdService } from "../src/kyc/smile-id.service";

/**
 * Stands in for the real SmileIdService in e2e tests so no test ever makes a
 * live call to Smile ID's API. Signature verification still runs the real
 * algorithm (keyed by the same test credentials verifyUserKyc signs with),
 * so the webhook auth path itself stays covered.
 */
class FakeSmileIdService {
  async generateWebToken(userId: string) {
    const jobId = `${userId}-${Date.now()}`;
    return { jobId, token: `test-token-${jobId}`, partnerId: process.env.SMILE_ID_PARTNER_ID };
  }

  verifyWebhookSignature(timestamp: string | undefined, signature: string | undefined): boolean {
    const apiKey = process.env.SMILE_ID_API_KEY;
    const partnerId = process.env.SMILE_ID_PARTNER_ID;
    if (!apiKey || !partnerId || !timestamp || !signature) return false;
    const expectedBuffer = Buffer.from(
      createHmac("sha256", apiKey).update(timestamp).update(partnerId).update("sid_request").digest("base64"),
      "base64",
    );
    const actualBuffer = Buffer.from(signature, "base64");
    if (expectedBuffer.length !== actualBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, actualBuffer);
  }
}

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SmileIdService)
    .useClass(FakeSmileIdService)
    .compile();
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
  const payload = { status: "clear", partner_params: { job_id: jobId } };
  const timestamp = new Date().toISOString();
  const signature = createHmac("sha256", process.env.SMILE_ID_API_KEY!)
    .update(timestamp)
    .update(process.env.SMILE_ID_PARTNER_ID!)
    .update("sid_request")
    .digest("base64");
  await request(app.getHttpServer())
    .post("/kyc/webhook")
    .set("response-timestamp", timestamp)
    .set("response-signature", signature)
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
