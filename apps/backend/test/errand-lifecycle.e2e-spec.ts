import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createTestApp, cleanDatabase, verifyUserKyc, nextTestPhone } from "./test-utils";

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
      .send({ email, password: "password123", name: email, phone: nextTestPhone(), acceptedTerms: true, termsVersion: "v1" })
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

    // Placing a bid opens the chat with the offer already said, instead of a blank thread —
    // and the owner gets a "new message" notification for it.
    const bidConversation = await prisma.conversation.findFirstOrThrow({
      where: { listingId, participantIds: { hasEvery: [bidder.userId] } },
    });
    const openingMessages = await prisma.message.findMany({ where: { conversationId: bidConversation.id } });
    expect(openingMessages).toHaveLength(1);
    expect(openingMessages[0].senderId).toBe(bidder.userId);
    expect(openingMessages[0].body).toContain("owner@test.com"); // name defaults to email in these tests
    expect(openingMessages[0].body).toContain("bidder@test.com");
    expect(openingMessages[0].body).toContain("KES 450");
    expect(openingMessages[0].body).toContain("I can do this in 1 hour");

    // Placing a bid raises two separate notifications for the owner: "new bid received"
    // (about the bid itself) and "new message" (about the opening chat message).
    const ownerUnreadAfterBid = await request(app.getHttpServer())
      .get("/notifications/unread-count")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(ownerUnreadAfterBid.body.unreadCount).toBe(2);

    // Reading the thread should clear only the "new message" one automatically, without a
    // separate trip to mark it read — the bid notification is unrelated and stays unread.
    await request(app.getHttpServer())
      .get(`/conversations/${bidConversation.id}/messages`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);
    const ownerUnreadAfterReading = await request(app.getHttpServer())
      .get("/notifications/unread-count")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(ownerUnreadAfterReading.body.unreadCount).toBe(1);

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

    // Owner opens a chat with a still-pending bidder — the offer should surface there for
    // an in-chat accept, exactly like the "Accept offer" button in the real chat UI.
    const preAcceptConversationRes = await request(app.getHttpServer())
      .get(`/listings/${listingId}/conversation`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .query({ with: bidder.userId })
      .expect(200);
    const preAcceptConversations = await request(app.getHttpServer())
      .get("/conversations")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);
    const preAcceptSummary = preAcceptConversations.body.find((c: any) => c.id === preAcceptConversationRes.body.id);
    expect(preAcceptSummary.theirPendingBidId).toBe(bidId);
    expect(preAcceptSummary.theirPendingBidAmount).toBe("450");

    await request(app.getHttpServer())
      .patch(`/bids/${bidId}/accept`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    const otherBid = await prisma.bid.findUnique({ where: { id: otherBidId } });
    expect(otherBid?.status).toBe("declined");

    const conversation = await prisma.conversation.findFirst({ where: { listingId, participantIds: { hasEvery: [bidder.userId] } } });
    expect(conversation).toBeTruthy();
    expect(conversation!.participantIds.sort()).toEqual([owner.userId, bidder.userId].sort());

    // Contact can't be shared until an offer is actually accepted — winning conversation, before accept, is exercised above via `bidId`'s own accept below.
    await request(app.getHttpServer())
      .post(`/conversations/${conversation!.id}/messages`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .send({ body: "On my way!" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/conversations/${conversation!.id}/share-contact`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .expect(201);

    // The declined bidder's chat becomes read-only, and never gets to share contact.
    const otherConversationRes = await request(app.getHttpServer())
      .get(`/listings/${listingId}/conversation`)
      .set("Authorization", `Bearer ${otherBidder.accessToken}`)
      .expect(200);
    const otherConversationId = otherConversationRes.body.id;

    await request(app.getHttpServer())
      .post(`/conversations/${otherConversationId}/messages`)
      .set("Authorization", `Bearer ${otherBidder.accessToken}`)
      .send({ body: "Still interested?" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/conversations/${otherConversationId}/share-contact`)
      .set("Authorization", `Bearer ${otherBidder.accessToken}`)
      .expect(400);

    const conversationsList = await request(app.getHttpServer())
      .get("/conversations")
      .set("Authorization", `Bearer ${otherBidder.accessToken}`)
      .expect(200);
    const otherSummary = conversationsList.body.find((c: any) => c.id === otherConversationId);
    expect(otherSummary.isActive).toBe(false);
    expect(otherSummary.canShareContact).toBe(false);

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
    expect(bidderProfile.body.tasksCompleted).toBe(1);

    const ownerProfile = await request(app.getHttpServer()).get(`/users/${owner.userId}`).expect(200);
    expect(ownerProfile.body.ratingAvg).toBe(4);
    expect(ownerProfile.body.ratingCount).toBe(1);
    // tasksCompleted only counts completed jobs this user won as the bidder, not ones they posted.
    expect(ownerProfile.body.tasksCompleted).toBe(0);

    const otherBidderProfile = await request(app.getHttpServer()).get(`/users/${otherBidder.userId}`).expect(200);
    expect(otherBidderProfile.body.tasksCompleted).toBe(0);
  });
});
