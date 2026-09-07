import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { json, urlencoded } from "express";
import * as request from "supertest";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { SmsService } from "../src/sms/sms.service";

/** Captures OTP codes instead of sending real SMS, so tests can read back what was "sent". */
class FakeSmsService {
  static sentCodes = new Map<string, string>();
  async sendOtp(phone: string, code: string): Promise<void> {
    FakeSmsService.sentCodes.set(phone, code);
  }
}

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SmsService)
    .useClass(FakeSmsService)
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

let testPhoneCounter = 0;
/** Generates a fresh, valid-looking Kenyan phone number so parallel test users never collide on the unique constraint. */
function nextTestPhone(): string {
  testPhoneCounter += 1;
  return `0722${testPhoneCounter.toString().padStart(6, "0")}`;
}

/** Drives a user through phone + OTP verification via the real endpoints (OTP captured from the fake SMS service). */
export async function verifyUserKyc(app: INestApplication, accessToken: string): Promise<void> {
  const phone = nextTestPhone();
  await request(app.getHttpServer())
    .post("/kyc/phone/request-otp")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ phone })
    .expect(201);
  const normalized = `+254${phone.slice(1)}`;
  const code = FakeSmsService.sentCodes.get(normalized);
  await request(app.getHttpServer())
    .post("/kyc/phone/verify-otp")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ phone, code })
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
  await prisma.phoneOtp.deleteMany();
  await prisma.kycVerification.deleteMany();
  await prisma.tokenTransaction.deleteMany();
  await prisma.tokenPurchase.deleteMany();
  await prisma.user.deleteMany();
}
