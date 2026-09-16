import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createTestApp, cleanDatabase, nextTestPhone, FakeSmsService } from "./test-utils";

describe("Auth (e2e)", () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it("rejects registration without accepting terms", async () => {
    await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email: "a@test.com", password: "password123", name: "A", phone: nextTestPhone(), acceptedTerms: false, termsVersion: "v1" })
      .expect(400);
  });

  it("rejects registration with a phone already claimed by a verified account", async () => {
    const phone = nextTestPhone();
    const first = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email: "first@test.com", password: "password123", name: "First", phone, acceptedTerms: true, termsVersion: "v1" })
      .expect(201);
    const normalized = `+254${phone.slice(1)}`;
    const code = FakeSmsService.sentCodes.get(normalized)!;
    await request(app.getHttpServer())
      .post("/kyc/phone/verify-otp")
      .set("Authorization", `Bearer ${first.body.accessToken}`)
      .send({ phone, code })
      .expect(201);

    await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email: "second@test.com", password: "password123", name: "Second", phone, acceptedTerms: true, termsVersion: "v1" })
      .expect(409);
  });

  it("sends a phone OTP automatically on registration, and verifying it grants KYC + signup tokens", async () => {
    const phone = nextTestPhone();
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email: "fresh@test.com", password: "password123", name: "Fresh", phone, acceptedTerms: true, termsVersion: "v1" })
      .expect(201);
    expect(res.body.user.kycStatus).toBe("none");

    const normalized = `+254${phone.slice(1)}`;
    const code = FakeSmsService.sentCodes.get(normalized);
    expect(code).toBeDefined();

    await request(app.getHttpServer())
      .post("/kyc/phone/verify-otp")
      .set("Authorization", `Bearer ${res.body.accessToken}`)
      .send({ phone, code })
      .expect(201);

    const balanceRes = await request(app.getHttpServer())
      .get("/tokens/balance")
      .set("Authorization", `Bearer ${res.body.accessToken}`)
      .expect(200);
    expect(balanceRes.body.balance).toBe(3);
  });

  it("registers, logs in, refreshes, and logout invalidates the refresh token", async () => {
    const registerRes = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email: "a@test.com", password: "password123", name: "A", phone: nextTestPhone(), acceptedTerms: true, termsVersion: "v1" })
      .expect(201);
    expect(registerRes.body.accessToken).toBeDefined();
    expect(registerRes.body.refreshToken).toBeDefined();

    await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email: "a@test.com", password: "password123", name: "A", phone: nextTestPhone(), acceptedTerms: true, termsVersion: "v1" })
      .expect(409);

    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "a@test.com", password: "password123" })
      .expect(201);

    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "a@test.com", password: "wrong-password" })
      .expect(401);

    const refreshRes = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: loginRes.body.refreshToken })
      .expect(201);
    expect(refreshRes.body.accessToken).toBeDefined();

    // Old refresh token was rotated out and should no longer work.
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: loginRes.body.refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post("/auth/logout")
      .set("Authorization", `Bearer ${refreshRes.body.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: refreshRes.body.refreshToken })
      .expect(401);
  });
});
