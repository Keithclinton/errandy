import { ExecutionContext, ForbiddenException, INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { PrismaClient } from "@prisma/client";
import type { Profile } from "passport-google-oauth20";
import { createTestApp, cleanDatabase, verifyUserKyc, nextTestPhone } from "./test-utils";
import { AuthService } from "../src/auth/auth.service";
import { GoogleCallbackGuard } from "../src/auth/guards/google-callback.guard";
import { canonicalEmail } from "../src/account-blocks/account-blocks.service";

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

  function registerRequest(email: string, phone: string) {
    return request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password: "password123", name: email, phone, acceptedTerms: true, termsVersion: "v1" });
  }

  async function register(email: string, phone = nextTestPhone()) {
    const res = await registerRequest(email, phone).expect(201);
    return { accessToken: res.body.accessToken as string, userId: res.body.user.id as string };
  }

  function googleProfile(id: string, email: string): Profile {
    return {
      id,
      displayName: "Google Person",
      emails: [{ value: email, verified: true }],
      photos: [],
      provider: "google",
    } as unknown as Profile;
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

  it("blocks signing up again with the deleted account's email or verified phone for 90 days", async () => {
    const phone = nextTestPhone();
    const user = await register("Jane.Doe@test.com", phone);
    await verifyUserKyc(app, user.accessToken);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.userId } })).tokenBalance).toBe(3);

    await request(app.getHttpServer()).delete("/users/me").set("Authorization", `Bearer ${user.accessToken}`).expect(200);

    // The block holds hashes only, never the email or number itself.
    const blocks = await prisma.accountDeletionBlock.findMany();
    expect(blocks).toHaveLength(2);
    const blockedForDays = (blocks[0].blockedUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(blockedForDays).toBeGreaterThan(89.9);
    expect(blockedForDays).toBeLessThanOrEqual(90);
    expect(JSON.stringify(blocks)).not.toMatch(/jane|test\.com|\+254/i);

    const sameEmail = await registerRequest("jane.doe@test.com", nextTestPhone()).expect(403);
    expect(sameEmail.body.code).toBe("ACCOUNT_RECENTLY_DELETED");
    expect(sameEmail.body.message).toMatch(/this email address was deleted recently/);
    expect(sameEmail.body.message).toMatch(/from \d{1,2} \w+ \d{4}/);

    // A "+tag" alias still reaches the same inbox, so it's blocked too.
    await registerRequest("jane.doe+again@test.com", nextTestPhone()).expect(403);

    const samePhone = await registerRequest("someone.new@test.com", phone).expect(403);
    expect(samePhone.body.message).toMatch(/this phone number was deleted recently/);

    // An existing account can't take the number over through phone verification either.
    const other = await register("other@test.com");
    const otp = await request(app.getHttpServer())
      .post("/kyc/phone/request-otp")
      .set("Authorization", `Bearer ${other.accessToken}`)
      .send({ phone })
      .expect(403);
    expect(otp.body.code).toBe("ACCOUNT_RECENTLY_DELETED");

    // Logging in to the deleted account explains what happened instead of "invalid password".
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "Jane.Doe@test.com", password: "password123" })
      .expect(401);
    expect(login.body.message).toMatch(/This account was deleted/);

    // Nothing was created by the refused sign-ups.
    expect(await prisma.user.count()).toBe(1);

    // Once the block runs out, they can sign up again.
    await prisma.accountDeletionBlock.updateMany({ data: { blockedUntil: new Date(Date.now() - 1000) } });
    await register("jane.doe@test.com", phone);
  });

  it("doesn't let Google sign-in silently recreate a recently deleted account", async () => {
    const auth = app.get(AuthService);
    const profile = googleProfile("google-123", "google.person@gmail.com");

    const googleUser = await auth.validateGoogleUser(profile);
    const { accessToken } = await auth.issueTokensForGoogleUser(googleUser);
    await request(app.getHttpServer()).delete("/users/me").set("Authorization", `Bearer ${accessToken}`).expect(200);

    await expect(auth.validateGoogleUser(profile)).rejects.toBeInstanceOf(ForbiddenException);
    // A different Google account with the same Gmail inbox (dots don't matter to Gmail) is blocked too.
    await expect(auth.validateGoogleUser(googleProfile("google-456", "Google.Person@gmail.com"))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(await prisma.user.count()).toBe(0);
  });

  it("sends a failed Google sign-in back to the app with the reason instead of raw JSON", () => {
    const req: { googleAuthError?: string } = {};
    const context = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
    const guard = new GoogleCallbackGuard();

    expect(guard.handleRequest(new ForbiddenException("Blocked for a while"), false, undefined, context)).toBeNull();
    expect(req.googleAuthError).toBe("Blocked for a while");

    expect(guard.handleRequest(null, false, undefined, context)).toBeNull();
    expect(req.googleAuthError).toBe("Google sign-in failed. Please try again.");
  });

  it("doesn't let admins delete their own account", async () => {
    const admin = await register("admin@test.com");
    await prisma.user.update({ where: { id: admin.userId }, data: { isAdmin: true } });
    const res = await request(app.getHttpServer())
      .delete("/users/me")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(403);
    expect(res.body.message).toMatch(/Ask the super admin/);

    await prisma.user.update({ where: { id: admin.userId }, data: { isSuperAdmin: true } });
    await request(app.getHttpServer()).delete("/users/me").set("Authorization", `Bearer ${admin.accessToken}`).expect(403);

    expect(await prisma.user.findUnique({ where: { id: admin.userId } })).not.toBeNull();
  });

  it("canonicalizes emails the way inboxes do", () => {
    expect(canonicalEmail(" Jane.Doe+promo@GMail.com ")).toBe("janedoe@gmail.com");
    expect(canonicalEmail("jane.doe@googlemail.com")).toBe("janedoe@gmail.com");
    // Outside Gmail, dots can matter, so only the +tag is dropped.
    expect(canonicalEmail("Jane.Doe+x@example.co.ke")).toBe("jane.doe@example.co.ke");
  });
});
