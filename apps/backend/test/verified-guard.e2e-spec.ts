import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createTestApp, cleanDatabase, verifyUserKyc } from "./test-utils";

describe("Verified guard (e2e)", () => {
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

  async function register(email: string) {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password: "password123", name: email, acceptedTerms: true, termsVersion: "v1" })
      .expect(201);
    return res.body.accessToken as string;
  }

  it("blocks unverified users from posting or bidding, then allows it once verified", async () => {
    const ownerToken = await register("owner@test.com");
    const bidderToken = await register("bidder@test.com");

    await request(app.getHttpServer())
      .post("/listings")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Buy groceries", description: "Pick up groceries today", category: "errands", location: "Nairobi" })
      .expect(403);

    await verifyUserKyc(app, ownerToken);

    const listingRes = await request(app.getHttpServer())
      .post("/listings")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Buy groceries", description: "Pick up groceries today", category: "errands", location: "Nairobi" })
      .expect(201);
    const listingId = listingRes.body.id;

    await request(app.getHttpServer())
      .post(`/listings/${listingId}/bids`)
      .set("Authorization", `Bearer ${bidderToken}`)
      .send({ amount: 100 })
      .expect(403);

    await verifyUserKyc(app, bidderToken);

    await request(app.getHttpServer())
      .post(`/listings/${listingId}/bids`)
      .set("Authorization", `Bearer ${bidderToken}`)
      .send({ amount: 100 })
      .expect(201);
  });
});
