import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { PrismaClient, UserStatus } from "@prisma/client";
import { createTestApp, cleanDatabase } from "./test-utils";
import { GoogleStrategy } from "../src/auth/strategies/google.strategy";

// The whole sign-in, from Google sending the person back to /auth/google/callback to the redirect
// into the app, with only Google's two network calls (code → token, token → profile) faked.
describe("Google sign-in (e2e)", () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  let profile: { id: string; displayName: string; emails: { value: string; verified: boolean }[]; photos: [] };

  beforeAll(async () => {
    app = await createTestApp();
    // passport-oauth2 internals: the token exchange and the profile request.
    const strategy = app.get(GoogleStrategy) as unknown as {
      _oauth2: { getOAuthAccessToken: (code: string, params: unknown, cb: (...args: unknown[]) => void) => void };
      userProfile: (token: string, done: (err: unknown, profile?: unknown) => void) => void;
    };
    strategy._oauth2.getOAuthAccessToken = (_code, _params, cb) => cb(null, "google-access-token", undefined, {});
    strategy.userProfile = (_token, done) => done(null, { provider: "google", ...profile });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    profile = { id: "google-777", displayName: "Google Person", emails: [{ value: "person@gmail.com", verified: true }], photos: [] };
  });

  // Where the callback sends the browser: the app's /auth/callback page, with the result after #.
  async function signIn(query = "code=from-google") {
    const res = await request(app.getHttpServer()).get(`/auth/google/callback?${query}`).expect(302);
    const location = new URL(res.headers.location);
    expect(location.pathname).toBe("/auth/callback");
    return new URLSearchParams(location.hash.slice(1));
  }

  it("signs a new person in and creates their account", async () => {
    const result = await signIn();
    expect(result.get("error")).toBeNull();
    expect(result.get("accessToken")).toBeTruthy();
    const user = await prisma.user.findUnique({ where: { email: "person@gmail.com" } });
    expect(user?.googleId).toBe("google-777");
  });

  it("signs an existing account in again", async () => {
    await signIn();
    const again = await signIn();
    expect(again.get("error")).toBeNull();
    expect(again.get("accessToken")).toBeTruthy();
    expect(await prisma.user.count()).toBe(1);
  });

  it("sends a refused sign-in back with the reason", async () => {
    await signIn();
    await prisma.user.update({ where: { email: "person@gmail.com" }, data: { status: UserStatus.suspended } });
    const result = await signIn();
    expect(result.get("accessToken")).toBeNull();
    expect(result.get("error")).toBe("This account has been suspended");
  });

  it("sends a cancelled sign-in back with the general message", async () => {
    const result = await signIn("error=access_denied");
    expect(result.get("accessToken")).toBeNull();
    expect(result.get("error")).toBe("Google sign-in failed. Please try again.");
  });
});
