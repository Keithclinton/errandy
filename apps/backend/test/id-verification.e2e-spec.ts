import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createTestApp, cleanDatabase, verifyUserKyc, nextTestPhone } from "./test-utils";

// A real 1x1 PNG.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("ID checks reviewed by an admin (e2e)", () => {
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

  async function register(email: string, { admin = false, phoneVerified = true } = {}) {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password: "password123", name: `Name ${email}`, phone: nextTestPhone(), acceptedTerms: true, termsVersion: "v1" })
      .expect(201);
    const token = res.body.accessToken as string;
    if (phoneVerified) await verifyUserKyc(app, token);
    if (admin) await prisma.user.update({ where: { id: res.body.user.id }, data: { isAdmin: true } });
    return { token, userId: res.body.user.id as string };
  }

  const submission = (overrides: Record<string, unknown> = {}) => ({
    documentType: "national_id",
    fullName: "Jane Wanjiru Doe",
    idNumber: "12 345 678",
    consent: true,
    images: { front: PNG, back: PNG, selfie: PNG },
    ...overrides,
  });

  const submit = (token: string, body: object) =>
    request(app.getHttpServer()).post("/kyc/id-verification").set("Authorization", `Bearer ${token}`).send(body);
  const as = (token: string) => ({
    get: (url: string) => request(app.getHttpServer()).get(url).set("Authorization", `Bearer ${token}`),
    patch: (url: string) => request(app.getHttpServer()).patch(url).set("Authorization", `Bearer ${token}`),
  });

  it("takes an ID check, lets an admin reject then approve it, and deletes the photos after each review", async () => {
    const admin = await register("admin@test.com", { admin: true });
    const user = await register("user@test.com");

    // Bad submissions are refused before anything is stored.
    await submit(user.token, submission({ consent: false })).expect(400);
    const noBack = await submit(user.token, submission({ images: { front: PNG, selfie: PNG } })).expect(400);
    expect(noBack.body.message).toMatch(/back of your ID/);
    const notImage = await submit(user.token, submission({ images: { front: "data:image/png;base64,AAAA", back: PNG, selfie: PNG } })).expect(400);
    expect(notImage.body.message).toMatch(/isn't a valid image/);
    expect(await prisma.idVerification.count()).toBe(0);

    const submitted = await submit(user.token, submission()).expect(201);
    expect(submitted.body.status).toBe("pending");
    await submit(user.token, submission()).expect(409);

    const status = await as(user.token).get("/kyc/status").expect(200);
    expect(status.body.kycStatus).toBe("verified");
    expect(status.body.idVerification).toMatchObject({ status: "pending", documentType: "national_id" });

    // Admins hear about it; regular users can't see the queue.
    const adminNotifications = await as(admin.token).get("/notifications").expect(200);
    const notice = adminNotifications.body.items.find((n: { type: string }) => n.type === "id_verification_submitted");
    expect(notice).toBeDefined();
    await as(user.token).get("/admin/id-verifications").expect(403);

    const queue = await as(admin.token).get("/admin/id-verifications").expect(200);
    expect(queue.body).toHaveLength(1);
    expect(queue.body[0]).toMatchObject({ idNumber: "12345678", fullName: "Jane Wanjiru Doe", user: { email: "user@test.com" } });
    expect(queue.body[0].images).toBeUndefined();
    const checkId = queue.body[0].id;
    expect(notice.entityId).toBe(checkId);

    const detail = await as(admin.token).get(`/admin/id-verifications/${checkId}`).expect(200);
    expect(detail.headers["cache-control"]).toBe("no-store");
    expect(detail.body.images.map((i: { kind: string }) => i.kind)).toEqual(["front", "back", "selfie"]);
    expect(detail.body.images[0].dataUrl).toBe(PNG);

    // Rejecting needs a reason the user can act on.
    await as(admin.token).patch(`/admin/id-verifications/${checkId}`).send({ decision: "reject" }).expect(400);
    await as(admin.token)
      .patch(`/admin/id-verifications/${checkId}`)
      .send({ decision: "reject", reason: "The photo of the front is blurry" })
      .expect(200);
    await as(admin.token).patch(`/admin/id-verifications/${checkId}`).send({ decision: "approve" }).expect(409);
    expect(await prisma.idVerificationImage.count()).toBe(0);

    const rejected = await as(user.token).get("/kyc/status").expect(200);
    expect(rejected.body.idVerification).toMatchObject({ status: "rejected", rejectionReason: "The photo of the front is blurry" });
    const userNotifications = await as(user.token).get("/notifications").expect(200);
    expect(userNotifications.body.items[0]).toMatchObject({
      type: "id_verification_reviewed",
      title: "Your ID check wasn't approved",
      body: "Reason: The photo of the front is blurry. You can send it again from the Verification page.",
    });

    // They can try again, and a passport needs no back photo.
    await submit(user.token, submission({ documentType: "passport", idNumber: "AK0123456", images: { front: PNG, selfie: PNG } })).expect(201);
    const second = (await as(admin.token).get("/admin/id-verifications").expect(200)).body[0];
    const approved = await as(admin.token).patch(`/admin/id-verifications/${second.id}`).send({ decision: "approve" }).expect(200);
    expect(approved.body).toMatchObject({ status: "verified", reviewedBy: { id: admin.userId }, images: [] });
    expect(await prisma.idVerificationImage.count()).toBe(0);

    const verified = await as(user.token).get("/kyc/status").expect(200);
    expect(verified.body.idVerification.status).toBe("verified");
    expect(verified.body.idVerification.verifiedAt).toBeTruthy();
    await submit(user.token, submission()).expect(409);

    // Everyone can see the badge; nobody sees pending or rejected checks.
    const profile = await request(app.getHttpServer()).get(`/users/${user.userId}`).expect(200);
    expect(profile.body.idVerifiedAt).toBeTruthy();

    const users = await as(admin.token).get("/admin/users").expect(200);
    expect(users.body.items.find((u: { email: string }) => u.email === "user@test.com").idCheckStatus).toBe("verified");
    const userDetail = await as(admin.token).get(`/admin/users/${user.userId}`).expect(200);
    expect(userDetail.body.idVerifications.map((v: { status: string }) => v.status)).toEqual(["verified", "rejected"]);
  });

  it("requires a verified phone first, won't let an admin review their own check, and flags a reused ID number", async () => {
    const admin = await register("admin@test.com", { admin: true });
    const unverified = await register("unverified@test.com", { phoneVerified: false });
    const first = await register("first@test.com");
    const second = await register("second@test.com");

    const needsPhone = await submit(unverified.token, submission()).expect(403);
    expect(needsPhone.body.message).toMatch(/phone number/);

    await submit(admin.token, submission({ idNumber: "99999999" })).expect(201);
    const own = (await as(admin.token).get("/admin/id-verifications").expect(200)).body[0];
    await as(admin.token).patch(`/admin/id-verifications/${own.id}`).send({ decision: "approve" }).expect(403);

    await submit(first.token, submission({ idNumber: "11112222" })).expect(201);
    await submit(second.token, submission({ idNumber: "1111-2222" })).expect(201);
    const queue = (await as(admin.token).get("/admin/id-verifications").expect(200)).body;
    const secondCheck = queue.find((v: { user: { email: string } }) => v.user.email === "second@test.com");
    const detail = await as(admin.token).get(`/admin/id-verifications/${secondCheck.id}`).expect(200);
    expect(detail.body.sameIdNumber).toHaveLength(1);
    expect(detail.body.sameIdNumber[0].user.email).toBe("first@test.com");
  });

  it("refuses photos over 1 MB, and deletes a user's checks with their account", async () => {
    const user = await register("user@test.com");

    const huge = Buffer.alloc(1_000_001);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(huge);
    const tooBig = await submit(user.token, submission({ images: { front: `data:image/png;base64,${huge.toString("base64")}`, back: PNG, selfie: PNG } })).expect(400);
    expect(tooBig.body.message).toMatch(/too large/);

    await submit(user.token, submission()).expect(201);
    expect(await prisma.idVerificationImage.count()).toBe(3);
    await request(app.getHttpServer()).delete("/users/me").set("Authorization", `Bearer ${user.token}`).expect(200);
    expect(await prisma.idVerification.count()).toBe(0);
    expect(await prisma.idVerificationImage.count()).toBe(0);
  });
});
