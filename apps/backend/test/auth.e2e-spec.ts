import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createTestApp, cleanDatabase } from "./test-utils";

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
      .send({ email: "a@test.com", password: "password123", name: "A", acceptedTerms: false, termsVersion: "v1" })
      .expect(400);
  });

  it("registers, logs in, refreshes, and logout invalidates the refresh token", async () => {
    const registerRes = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email: "a@test.com", password: "password123", name: "A", acceptedTerms: true, termsVersion: "v1" })
      .expect(201);
    expect(registerRes.body.accessToken).toBeDefined();
    expect(registerRes.body.refreshToken).toBeDefined();

    await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email: "a@test.com", password: "password123", name: "A", acceptedTerms: true, termsVersion: "v1" })
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
