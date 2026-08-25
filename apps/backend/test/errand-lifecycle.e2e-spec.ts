import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createTestApp, cleanDatabase, verifyUserKyc } from "./test-utils";

describe("Errand lifecycle (e2e)", () => {
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

  async function registerVerified(email: string) {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password: "password123", name: email, acceptedTerms: true, termsVersion: "v1" })
      .expect(201);
    const accessToken = res.body.accessToken as string;
    const userId = res.body.user.id as string;
    await verifyUserKyc(app, accessToken);
    return { accessToken, userId };
  }

  it("runs the full happy path: post -> bid -> accept -> chat -> complete -> blind ratings -> reveal", async () => {
    const owner = await registerVerified("owner@test.com");
    const bidder = await registerVerified("bidder@test.com");
    const otherBidder = await registerVerified("other-bidder@test.com");

    const listingRes = await request(app.getHttpServer())
      .post("/listings")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ title: "Buy groceries", description: "Pick up groceries today", category: "Errands", location: "Nairobi", budget: 500 })
      .expect(201);
    const listingId = listingRes.body.id;

    const bidRes = await request(app.getHttpServer())
      .post(`/listings/${listingId}/bids`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .send({ amount: 450, message: "I can do this in 1 hour" })
      .expect(201);
    const bidId = bidRes.body.id;

    const otherBidRes = await request(app.getHttpServer())
      .post(`/listings/${listingId}/bids`)
      .set("Authorization", `Bearer ${otherBidder.accessToken}`)
      .send({ amount: 480 })
      .expect(201);
    const otherBidId = otherBidRes.body.id;

    // Self-bidding is blocked.
    await request(app.getHttpServer())
      .post(`/listings/${listingId}/bids`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ amount: 100 })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/bids/${bidId}/accept`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    const otherBid = await prisma.bid.findUnique({ where: { id: otherBidId } });
    expect(otherBid?.status).toBe("declined");

    const conversation = await prisma.conversation.findFirst({ where: { listingId } });
    expect(conversation).toBeTruthy();
    expect(conversation!.participantIds.sort()).toEqual([owner.userId, bidder.userId].sort());

    await request(app.getHttpServer())
      .post(`/conversations/${conversation!.id}/messages`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .send({ body: "On my way!" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/conversations/${conversation!.id}/share-contact`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .expect(201);

    // Only the owner can complete, and only once a bid is accepted.
    await request(app.getHttpServer())
      .patch(`/listings/${listingId}/complete`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/listings/${listingId}/complete`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/listings/${listingId}/ratings`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ stars: 5, comment: "Great job" })
      .expect(201);

    // Blind until both have rated.
    const blindView = await request(app.getHttpServer())
      .get(`/listings/${listingId}/ratings`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .expect(200);
    expect(blindView.body[0].visible).toBe(false);
    expect(blindView.body[0].stars).toBeNull();

    await request(app.getHttpServer())
      .post(`/listings/${listingId}/ratings`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .send({ stars: 4, comment: "Good client" })
      .expect(201);

    const revealedView = await request(app.getHttpServer())
      .get(`/listings/${listingId}/ratings`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .expect(200);
    expect(revealedView.body.every((r: any) => r.visible)).toBe(true);

    const bidderProfile = await request(app.getHttpServer()).get(`/users/${bidder.userId}`).expect(200);
    expect(bidderProfile.body.ratingAvg).toBe(5);
    expect(bidderProfile.body.ratingCount).toBe(1);

    const ownerProfile = await request(app.getHttpServer()).get(`/users/${owner.userId}`).expect(200);
    expect(ownerProfile.body.ratingAvg).toBe(4);
    expect(ownerProfile.body.ratingCount).toBe(1);
  });
});
