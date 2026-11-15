import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createTestApp, cleanDatabase, nextTestPhone } from "./test-utils";

describe("Admins and the super admin (e2e)", () => {
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

  async function register(email: string, role: "user" | "admin" | "super" = "user") {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password: "password123", name: email, phone: nextTestPhone(), acceptedTerms: true, termsVersion: "v1" })
      .expect(201);
    const userId = res.body.user.id as string;
    if (role !== "user") {
      await prisma.user.update({ where: { id: userId }, data: { isAdmin: true, isSuperAdmin: role === "super" } });
    }
    return { token: res.body.accessToken as string, userId };
  }

  const as = (token: string) => ({
    patch: (url: string) => request(app.getHttpServer()).patch(url).set("Authorization", `Bearer ${token}`),
    delete: (url: string) => request(app.getHttpServer()).delete(url).set("Authorization", `Bearer ${token}`),
    get: (url: string) => request(app.getHttpServer()).get(url).set("Authorization", `Bearer ${token}`),
  });

  it("only lets the super admin suspend, reinstate or delete an admin, and no one touches the super admin", async () => {
    const boss = await register("boss@test.com", "super");
    const admin = await register("admin@test.com", "admin");
    const otherAdmin = await register("other-admin@test.com", "admin");
    const user = await register("user@test.com");

    const me = await as(boss.token).get("/users/me").expect(200);
    expect(me.body.isSuperAdmin).toBe(true);

    // A regular admin can still act on regular users...
    await as(admin.token).patch(`/admin/users/${user.userId}/suspend`).expect(200);
    await as(admin.token).patch(`/admin/users/${user.userId}/reinstate`).expect(200);

    // ...but not on other admins, or on the super admin.
    const denied = await as(admin.token).delete(`/admin/users/${otherAdmin.userId}`).expect(403);
    expect(denied.body.message).toMatch(/Only the super admin/);
    await as(admin.token).patch(`/admin/users/${otherAdmin.userId}/suspend`).expect(403);
    await as(admin.token).patch(`/admin/users/${boss.userId}/suspend`).expect(403);
    await as(admin.token).delete(`/admin/users/${boss.userId}`).expect(403);

    // The super admin can't be deleted or suspended even by themselves.
    await as(boss.token).delete(`/admin/users/${boss.userId}`).expect(400);
    await as(boss.token).patch(`/admin/users/${boss.userId}/suspend`).expect(400);

    // The super admin can.
    await as(boss.token).patch(`/admin/users/${otherAdmin.userId}/suspend`).expect(200);
    await as(boss.token).patch(`/admin/users/${otherAdmin.userId}/reinstate`).expect(200);
    await as(boss.token).delete(`/admin/users/${otherAdmin.userId}`).expect(200);
    expect(await prisma.user.findUnique({ where: { id: otherAdmin.userId } })).toBeNull();

    // An account an admin deletes is blocked from signing up again, same as one deleted by its owner.
    await as(admin.token).delete(`/admin/users/${user.userId}`).expect(200);
    const again = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email: "user@test.com", password: "password123", name: "Again", phone: nextTestPhone(), acceptedTerms: true, termsVersion: "v1" })
      .expect(403);
    expect(again.body.code).toBe("ACCOUNT_RECENTLY_DELETED");
  });

  it("lets only the super admin make and remove admins", async () => {
    const boss = await register("boss@test.com", "super");
    const otherBoss = await register("other-boss@test.com", "super");
    const admin = await register("admin@test.com", "admin");
    const user = await register("user@test.com");

    await as(admin.token).patch(`/admin/users/${user.userId}/admin`).send({ isAdmin: true }).expect(403);
    await as(user.token).get("/admin/users").expect(403);

    const made = await as(boss.token).patch(`/admin/users/${user.userId}/admin`).send({ isAdmin: true }).expect(200);
    expect(made.body.isAdmin).toBe(true);
    expect(made.body.passwordHash).toBeUndefined();
    await as(user.token).get("/admin/users").expect(200);

    await as(boss.token).patch(`/admin/users/${user.userId}/admin`).send({ isAdmin: false }).expect(200);
    await as(user.token).get("/admin/users").expect(403);

    await as(boss.token).patch(`/admin/users/${boss.userId}/admin`).send({ isAdmin: false }).expect(400);
    await as(boss.token).patch(`/admin/users/${otherBoss.userId}/admin`).send({ isAdmin: false }).expect(403);
    await as(boss.token).patch(`/admin/users/${user.userId}/admin`).send({ isAdmin: "yes" }).expect(400);

    // A suspended account has to be reinstated first.
    await as(boss.token).patch(`/admin/users/${user.userId}/suspend`).expect(200);
    await as(boss.token).patch(`/admin/users/${user.userId}/admin`).send({ isAdmin: true }).expect(400);
  });

  it("lists who is an admin or the super admin", async () => {
    const boss = await register("boss@test.com", "super");
    await register("admin@test.com", "admin");
    const res = await as(boss.token).get("/admin/users").expect(200);
    const byEmail = Object.fromEntries(res.body.items.map((u: { email: string }) => [u.email, u]));
    expect(byEmail["boss@test.com"]).toMatchObject({ isAdmin: true, isSuperAdmin: true, idCheckStatus: "none" });
    expect(byEmail["admin@test.com"]).toMatchObject({ isAdmin: true, isSuperAdmin: false });
  });
});
