import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createTestApp, cleanDatabase, verifyUserKyc, nextTestPhone } from "./test-utils";

describe("Mandatory rating gate (e2e)", () => {
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
      .send({ email, password: "password123", name: email, phone: nextTestPhone(), acceptedTerms: true, termsVersion: "v1" })
      .expect(201);
    const accessToken = res.body.accessToken as string;
    const userId = res.body.user.id as string;
    await verifyUserKyc(app, accessToken);
    return { accessToken, userId };
  }

  function createListing(accessToken: string, title = "Buy groceries") {
    return request(app.getHttpServer())
      .post("/listings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title, description: "Pick up groceries today", category: "Errands", location: "Nairobi" });
  }

  it("blocks posting and bidding while a completed job is unrated, for both the owner and the winning bidder", async () => {
    const owner = await registerVerified("owner@test.com");
    const bidder = await registerVerified("bidder@test.com");
    const stranger = await registerVerified("stranger@test.com");

    const listingRes = await createListing(owner.accessToken).expect(201);
    const listingId = listingRes.body.id;

    const bidRes = await request(app.getHttpServer())
      .post(`/listings/${listingId}/bids`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .send({ amount: 450 })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/bids/${bidRes.body.id}/accept`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/listings/${listingId}/complete`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    // Neither party has rated the completed job yet — both are blocked from posting/bidding
    // anything else, Uber-style.
    const blockedPost = await createListing(owner.accessToken, "Another task").expect(409);
    expect(blockedPost.body.code).toBe("UNRATED_COMPLETED_LISTING");
    expect(blockedPost.body.listingId).toBe(listingId);

    const strangerListingRes = await createListing(stranger.accessToken, "Stranger's task").expect(201);
    const strangerListingId = strangerListingRes.body.id;
    const blockedBid = await request(app.getHttpServer())
      .post(`/listings/${strangerListingId}/bids`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .send({ amount: 200 })
      .expect(409);
    expect(blockedBid.body.code).toBe("UNRATED_COMPLETED_LISTING");

    // The owner is gated on bidding too, not just posting.
    await request(app.getHttpServer())
      .post(`/listings/${strangerListingId}/bids`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ amount: 300 })
      .expect(409);

    // Owner rates the bidder — owner can post again, but the bidder is still gated.
    await request(app.getHttpServer())
      .post(`/listings/${listingId}/ratings`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ stars: 5, comment: "Great job" })
      .expect(201);

    await createListing(owner.accessToken, "Another task").expect(201);
    const stillBlockedBid = await request(app.getHttpServer())
      .post(`/listings/${strangerListingId}/bids`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .send({ amount: 200 })
      .expect(409);
    expect(stillBlockedBid.body.code).toBe("UNRATED_COMPLETED_LISTING");

    // Bidder rates the owner — now free to bid again too.
    await request(app.getHttpServer())
      .post(`/listings/${listingId}/ratings`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .send({ stars: 4, comment: "Good client" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/listings/${strangerListingId}/bids`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .send({ amount: 200 })
      .expect(201);
  });
});
