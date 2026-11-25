import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createTestApp, cleanDatabase, nextTestPhone } from "./test-utils";

// Every request in a test comes from the same address, as it would for many people on one
// Safaricom connection.
describe("Rate limits (e2e)", () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const suiteSignInLimit = process.env.THROTTLE_SIGN_IN_LIMIT_PER_MINUTE;

  beforeAll(async () => {
    delete process.env.THROTTLE_SIGN_IN_LIMIT_PER_MINUTE; // the real limit, 10 a minute
    app = await createTestApp();
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    process.env.THROTTLE_SIGN_IN_LIMIT_PER_MINUTE = suiteSignInLimit;
    await app.close();
    await prisma.$disconnect();
  });

  async function register(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password: "password123", name: email, phone: nextTestPhone(), acceptedTerms: true, termsVersion: "v1" })
      .expect(201);
    return res.body.accessToken;
  }

  async function hit(times: number, path: string, token?: string): Promise<number[]> {
    const statuses: number[] = [];
    for (let i = 0; i < times; i++) {
      const req = request(app.getHttpServer()).get(path);
      if (token) req.set("Authorization", `Bearer ${token}`);
      statuses.push((await req).status);
    }
    return statuses;
  }

  it("gives each signed-in person their own allowance, however many share the address", async () => {
    const first = await register("first@test.com");
    const second = await register("second@test.com");

    expect(await hit(100, "/notifications/unread-count", first)).toEqual(Array(100).fill(200));
    expect(await hit(1, "/notifications/unread-count", first)).toEqual([429]);
    // Counted by address, this would be refused too.
    expect(await hit(1, "/notifications/unread-count", second)).toEqual([200]);
  });

  it("lets 300 signed-out requests a minute through from one address", async () => {
    const token = await register("browser@test.com");

    expect(await hit(300, "/listings")).toEqual(Array(300).fill(200));
    expect(await hit(1, "/listings")).toEqual([429]);
    expect(await hit(1, "/listings", token)).toEqual([200]);
  });

  it("doesn't count a made-up or expired token as a sign-in", async () => {
    // Header and payload of a token for an account id it doesn't own, with a wrong signature.
    const forged = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url")}.${Buffer.from('{"sub":"someone-else"}').toString("base64url")}.bad`;
    // The previous test used up this address's allowance for /listings.
    expect(await hit(1, "/listings", forged)).toEqual([429]);
  });

  it("allows 10 sign-in attempts a minute per address, signed in or not", async () => {
    const token = await register("guess-target@test.com");
    const attempt = (withToken = false) => {
      const req = request(app.getHttpServer()).post("/auth/login").send({ email: "guess-target@test.com", password: "wrong-password" });
      return withToken ? req.set("Authorization", `Bearer ${token}`) : req;
    };

    for (let i = 0; i < 10; i++) await attempt().expect(401);
    await attempt().expect(429);
    await attempt(true).expect(429);
  });
});
