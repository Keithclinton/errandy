import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createTestApp, cleanDatabase, verifyUserKyc } from "./test-utils";

describe("Tokens (e2e)", () => {
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
    return { accessToken: res.body.accessToken as string, userId: res.body.user.id as string };
  }

  function createListing(accessToken: string, title = "Buy groceries") {
    return request(app.getHttpServer())
      .post("/listings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title, description: "Pick up groceries today", category: "Errands", location: "Nairobi" });
  }

  it("grants exactly 2 tokens on verification, once", async () => {
    const owner = await register("owner@test.com");

    const before = await prisma.user.findUniqueOrThrow({ where: { id: owner.userId } });
    expect(before.tokenBalance).toBe(0);

    await verifyUserKyc(app, owner.accessToken);

    const balanceRes = await request(app.getHttpServer())
      .get("/tokens/balance")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(balanceRes.body.balance).toBe(2);

    const ledger = await prisma.tokenTransaction.findMany({ where: { userId: owner.userId } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].type).toBe("signup_grant");
    expect(ledger[0].amount).toBe(2);

    // Re-verifying (e.g. switching phone numbers) must not grant tokens again. Clear the
    // prior OTP row directly so the resend cooldown doesn't block this second attempt.
    await prisma.phoneOtp.deleteMany({ where: { userId: owner.userId } });
    await verifyUserKyc(app, owner.accessToken);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: owner.userId } });
    expect(after.tokenBalance).toBe(2);
    const ledgerAfter = await prisma.tokenTransaction.findMany({ where: { userId: owner.userId, type: "signup_grant" } });
    expect(ledgerAfter).toHaveLength(1);
  });

  it("debits 1 token per posted task and blocks posting at 0 balance", async () => {
    const owner = await register("owner@test.com");
    await verifyUserKyc(app, owner.accessToken);

    await createListing(owner.accessToken, "Task 1").expect(201);
    let balance = await prisma.user.findUniqueOrThrow({ where: { id: owner.userId } });
    expect(balance.tokenBalance).toBe(1);

    await createListing(owner.accessToken, "Task 2").expect(201);
    balance = await prisma.user.findUniqueOrThrow({ where: { id: owner.userId } });
    expect(balance.tokenBalance).toBe(0);

    const before = await prisma.listing.count();
    await createListing(owner.accessToken, "Task 3").expect(409);
    const after = await prisma.listing.count();
    expect(after).toBe(before);

    const ledger = await prisma.tokenTransaction.findMany({
      where: { userId: owner.userId, type: "listing_post" },
    });
    expect(ledger).toHaveLength(2);
    expect(ledger[0].amount).toBe(-1);
  });

  it("debits the bidder (not the poster) 1 token when their offer is accepted", async () => {
    const owner = await register("owner@test.com");
    const bidder = await register("bidder@test.com");
    await verifyUserKyc(app, owner.accessToken);
    await verifyUserKyc(app, bidder.accessToken);

    const listingRes = await createListing(owner.accessToken).expect(201);
    const listingId = listingRes.body.id;

    const bidRes = await request(app.getHttpServer())
      .post(`/listings/${listingId}/bids`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .send({ amount: 450 })
      .expect(201);

    const ownerBalanceBefore = await prisma.user.findUniqueOrThrow({ where: { id: owner.userId } });

    await request(app.getHttpServer())
      .patch(`/bids/${bidRes.body.id}/accept`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    const bidderBalance = await prisma.user.findUniqueOrThrow({ where: { id: bidder.userId } });
    expect(bidderBalance.tokenBalance).toBe(1); // 2 free - 1 debited on accept

    const ownerBalanceAfter = await prisma.user.findUniqueOrThrow({ where: { id: owner.userId } });
    expect(ownerBalanceAfter.tokenBalance).toBe(ownerBalanceBefore.tokenBalance); // unaffected

    const ledger = await prisma.tokenTransaction.findMany({
      where: { userId: bidder.userId, type: "bid_accept_deduction" },
    });
    expect(ledger).toHaveLength(1);
  });

  it("blocks accepting an offer from a bidder with 0 tokens, and notifies them", async () => {
    const owner = await register("owner@test.com");
    const bidder = await register("bidder@test.com");
    await verifyUserKyc(app, owner.accessToken);
    await verifyUserKyc(app, bidder.accessToken);

    // Drain the bidder's 2 free tokens by having them post two listings of their own.
    await createListing(bidder.accessToken, "Bidder's task 1").expect(201);
    await createListing(bidder.accessToken, "Bidder's task 2").expect(201);
    const drained = await prisma.user.findUniqueOrThrow({ where: { id: bidder.userId } });
    expect(drained.tokenBalance).toBe(0);

    const listingRes = await createListing(owner.accessToken).expect(201);
    const listingId = listingRes.body.id;

    const bidRes = await request(app.getHttpServer())
      .post(`/listings/${listingId}/bids`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .send({ amount: 450 })
      .expect(201);

    const acceptRes = await request(app.getHttpServer())
      .patch(`/bids/${bidRes.body.id}/accept`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(409);
    expect(acceptRes.body.code).toBe("BIDDER_INSUFFICIENT_TOKENS");

    const bid = await prisma.bid.findUniqueOrThrow({ where: { id: bidRes.body.id } });
    expect(bid.status).toBe("pending");
    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listing.status).toBe("open");

    const notifications = await request(app.getHttpServer())
      .get("/notifications")
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .expect(200);
    expect(notifications.body.items.some((n: any) => n.type === "bidder_token_required")).toBe(true);
  });

  it("lists token packs and completes a purchase instantly under the simulated payment stub", async () => {
    const owner = await register("owner@test.com");
    await verifyUserKyc(app, owner.accessToken);

    const packsRes = await request(app.getHttpServer())
      .get("/tokens/packs")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(packsRes.body).toHaveLength(3);

    const pack = packsRes.body[1]; // 5-token pack
    const purchaseRes = await request(app.getHttpServer())
      .post("/tokens/purchases/initiate")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ packId: pack.id, phone: "0712345678" })
      .expect(201);
    expect(purchaseRes.body.status).toBe("completed");
    expect(purchaseRes.body.balance).toBe(2 + pack.tokens);

    const purchase = await prisma.tokenPurchase.findUniqueOrThrow({ where: { id: purchaseRes.body.purchaseId } });
    expect(purchase.simulated).toBe(true);
    expect(purchase.status).toBe("completed");

    const notifications = await request(app.getHttpServer())
      .get("/notifications")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(notifications.body.items.some((n: any) => n.type === "tokens_purchased")).toBe(true);
  });
});
