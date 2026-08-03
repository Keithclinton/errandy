import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createTestApp, cleanDatabase } from "./test-utils";

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
});
