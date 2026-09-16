import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createTestApp, cleanDatabase, verifyUserKyc } from "./test-utils";

describe("Reports and admin (e2e)", () => {
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

  it("files a report, admin resolves it, reporter is notified, admin suspends a user", async () => {
    const reporter = await register("reporter@test.com");
    const target = await register("target@test.com");
    const admin = await register("admin@test.com");
    await prisma.user.update({ where: { id: admin.userId }, data: { isAdmin: true } });

    const reportRes = await request(app.getHttpServer())
      .post("/reports")
      .set("Authorization", `Bearer ${reporter.accessToken}`)
      .send({ targetType: "user", targetId: target.userId, reason: "scam", details: "did not show up" })
      .expect(201);
    const reportId = reportRes.body.id;

    await request(app.getHttpServer())
      .get("/admin/reports")
      .set("Authorization", `Bearer ${reporter.accessToken}`)
      .expect(403);

    const listRes = await request(app.getHttpServer())
      .get("/admin/reports")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(listRes.body.some((r: any) => r.id === reportId)).toBe(true);

    await request(app.getHttpServer())
      .patch(`/admin/reports/${reportId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ status: "dismissed" })
      .expect(200);

    const notifications = await request(app.getHttpServer())
      .get("/notifications")
      .set("Authorization", `Bearer ${reporter.accessToken}`)
      .expect(200);
    expect(notifications.body.items.some((n: any) => n.type === "report_resolved")).toBe(true);

    await request(app.getHttpServer())
      .patch(`/admin/users/${target.userId}/suspend`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "target@test.com", password: "password123" })
      .expect(401);
  });

  it("admin deletes a user, cascading their owned listings, others' bids/ratings/chat on those listings, and their own activity", async () => {
    const owner = await register("owner@test.com");
    const bidder = await register("bidder@test.com");
    const admin = await register("admin@test.com");
    await prisma.user.update({ where: { id: admin.userId }, data: { isAdmin: true } });
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

    await request(app.getHttpServer())
      .get(`/listings/${listingId}/conversation`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .expect(200);
    const conversation = await prisma.conversation.findFirstOrThrow({ where: { listingId } });
    await request(app.getHttpServer())
      .post(`/conversations/${conversation.id}/messages`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .send({ body: "Interested!" })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/bids/${bidId}/accept`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/listings/${listingId}/complete`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/listings/${listingId}/ratings`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .send({ stars: 5, comment: "Great client" })
      .expect(201);

    // Non-admin can't delete anyone; admin can't delete themselves.
    await request(app.getHttpServer())
      .delete(`/admin/users/${owner.userId}`)
      .set("Authorization", `Bearer ${bidder.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/admin/users/${admin.userId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/admin/users/${owner.userId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);

    expect(await prisma.user.findUnique({ where: { id: owner.userId } })).toBeNull();
    expect(await prisma.listing.findUnique({ where: { id: listingId } })).toBeNull();
    expect(await prisma.bid.findUnique({ where: { id: bidId } })).toBeNull();
    expect(await prisma.conversation.findUnique({ where: { id: conversation.id } })).toBeNull();
    expect(await prisma.message.findMany({ where: { conversationId: conversation.id } })).toHaveLength(0);
    expect(await prisma.rating.findMany({ where: { listingId } })).toHaveLength(0);

    // The bidder themselves is untouched — only the owner and what the owner's
    // listing dragged in got removed.
    const bidderStillExists = await prisma.user.findUnique({ where: { id: bidder.userId } });
    expect(bidderStillExists).not.toBeNull();
  });
});
