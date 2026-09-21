import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createTestApp, cleanDatabase, verifyUserKyc, nextTestPhone } from "./test-utils";

describe("Self-service account deletion (e2e)", () => {
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
      .send({ email, password: "password123", name: email, phone: nextTestPhone(), acceptedTerms: true, termsVersion: "v1" })
      .expect(201);
    return { accessToken: res.body.accessToken as string, userId: res.body.user.id as string };
  }

  it("lets a user delete their own account, cascading their listings/bids/chats, and revokes their session", async () => {
    const owner = await register("owner@test.com");
    const bidder = await register("bidder@test.com");
    await verifyUserKyc(app, owner.accessToken);
    await verifyUserKyc(app, bidder.accessToken);

    const listingRes = await request(app.getHttpServer())
      .post("/listings")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ title: "Buy groceries", description: "Pick up groceries today", category: "Errands", location: "Nairobi" })
      .expect(201);
    const listingId = listingRes.body.id;

    const bidRes = await request(app.getHttpServer())
      .post(`/listings/${listingId}/bids`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .send({ amount: 450 })
      .expect(201);
    const bidId = bidRes.body.id;

    const conversation = await prisma.conversation.findFirstOrThrow({ where: { listingId } });

    await request(app.getHttpServer())
      .delete("/users/me")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(await prisma.user.findUnique({ where: { id: owner.userId } })).toBeNull();
    expect(await prisma.listing.findUnique({ where: { id: listingId } })).toBeNull();
    expect(await prisma.bid.findUnique({ where: { id: bidId } })).toBeNull();
    expect(await prisma.conversation.findUnique({ where: { id: conversation.id } })).toBeNull();

    // The bidder's own account is untouched.
    expect(await prisma.user.findUnique({ where: { id: bidder.userId } })).not.toBeNull();

    // Their old access token no longer authenticates anything, since the user is gone.
    await request(app.getHttpServer())
      .get("/users/me")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(401);
  });
});
