import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { createTestApp, cleanDatabase, verifyUserKyc, nextTestPhone } from "./test-utils";
import { DAILY_PHOTO_LIMIT } from "../src/photos/photos.service";

// The service only checks a JPEG's first bytes; the rest can be anything.
const JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("a photo")]);
const asDataUrl = (bytes: Buffer, type = "image/jpeg") => `data:${type};base64,${bytes.toString("base64")}`;
const PHOTO = asDataUrl(JPEG_BYTES);
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const TWO_DAYS_AGO = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

describe("Photos (e2e)", () => {
  let app: INestApplication;
  let uploadsDir: string;
  const previousUploadsDir = process.env.UPLOADS_DIR;
  const prisma = new PrismaClient();

  beforeAll(async () => {
    uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "errandspot-photos-"));
    process.env.UPLOADS_DIR = uploadsDir;
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    fs.rmSync(uploadsDir, { recursive: true, force: true });
    if (previousUploadsDir === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = previousUploadsDir;
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    for (const entry of fs.readdirSync(uploadsDir)) fs.rmSync(path.join(uploadsDir, entry), { recursive: true, force: true });
  });

  async function register(email: string) {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password: "password123", name: email, phone: nextTestPhone(), acceptedTerms: true, termsVersion: "v1" })
      .expect(201);
    const token = res.body.accessToken as string;
    await verifyUserKyc(app, token);
    return { token, userId: res.body.user.id as string };
  }

  const upload = (token: string, photo: string) =>
    request(app.getHttpServer()).post("/photos").set("Authorization", `Bearer ${token}`).send({ photo });
  const uploaded = async (token: string) => (await upload(token, PHOTO).expect(201)).body.url as string;
  const fileOf = (url: string) => path.join(uploadsDir, ...url.replace(/^\/uploads\//, "").split("/"));
  const postListing = (token: string, imageUrls: string[]) =>
    request(app.getHttpServer())
      .post("/listings")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Buy groceries", description: "Pick up groceries today", category: "Errands", location: "Nairobi", imageUrls });
  const patchProfile = (token: string, body: object) =>
    request(app.getHttpServer()).patch("/users/me").set("Authorization", `Bearer ${token}`).send(body);
  const cleanup = () =>
    request(app.getHttpServer()).get("/cron/cleanup-photos").set("Authorization", `Bearer ${process.env.CRON_SECRET}`);

  it("stores a photo in the account's folder and returns its address", async () => {
    const user = await register("user@test.com");

    const url = await uploaded(user.token);

    expect(url).toMatch(new RegExp(`^/uploads/${user.userId}/[A-Za-z0-9_-]{16}\\.jpg$`));
    expect(fs.readFileSync(fileOf(url))).toEqual(JPEG_BYTES);
    expect(await uploaded(user.token)).not.toBe(url); // every photo gets a new name
  });

  it("only takes JPEGs of up to 1 MB, from signed-in people", async () => {
    const user = await register("user@test.com");

    await request(app.getHttpServer()).post("/photos").send({ photo: PHOTO }).expect(401);
    expect((await upload(user.token, PNG).expect(400)).body.message).toMatch(/JPG/);
    expect((await upload(user.token, asDataUrl(Buffer.from("<html>not a photo</html>"))).expect(400)).body.message).toMatch(
      /isn't a valid image/,
    );
    const tooBig = Buffer.concat([JPEG_BYTES, Buffer.alloc(1_000_000)]);
    expect((await upload(user.token, asDataUrl(tooBig)).expect(400)).body.message).toMatch(/under 1 MB/);
    expect(fs.existsSync(path.join(uploadsDir, user.userId))).toBe(false); // nothing stored
  });

  it(`takes up to ${DAILY_PHOTO_LIMIT} new photos per account a day`, async () => {
    const user = await register("user@test.com");
    const other = await register("other@test.com");
    const folder = path.join(uploadsDir, user.userId);
    fs.mkdirSync(folder, { recursive: true });
    for (let i = 0; i < DAILY_PHOTO_LIMIT; i++) fs.writeFileSync(path.join(folder, `${String(i).padStart(16, "x")}.jpg`), JPEG_BYTES);

    expect((await upload(user.token, PHOTO).expect(429)).body.message).toMatch(/tomorrow/);
    await uploaded(other.token);

    // Photos from more than a day ago don't count.
    for (const name of fs.readdirSync(folder)) fs.utimesSync(path.join(folder, name), TWO_DAYS_AGO, TWO_DAYS_AGO);
    await uploaded(user.token);
  });

  it("lets listings use only photos their owner uploaded", async () => {
    const owner = await register("owner@test.com");
    const other = await register("other@test.com");
    const mine = await uploaded(owner.token);
    const theirs = await uploaded(other.token);

    for (const url of ["https://example.com/photo.jpg", theirs, `/uploads/${owner.userId}/../${other.userId}/x.jpg`]) {
      expect((await postListing(owner.token, [url]).expect(400)).body.message).toBe("Add photos with the Add photo button.");
    }
    const gone = await uploaded(owner.token);
    fs.rmSync(fileOf(gone));
    expect((await postListing(owner.token, [gone]).expect(400)).body.message).toMatch(/no longer available/);

    const listing = (await postListing(owner.token, [mine]).expect(201)).body;
    expect(listing.imageUrls).toEqual([mine]);

    // Editing keeps the photos already on it, even ones since removed, and adds new uploads.
    fs.rmSync(fileOf(mine));
    const another = await uploaded(owner.token);
    await request(app.getHttpServer())
      .patch(`/listings/${listing.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ imageUrls: [mine, another] })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/listings/${listing.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ imageUrls: [another, theirs] })
      .expect(400);
  });

  it("lets profiles use only the account's own photos, keeping the one Google gave it", async () => {
    const user = await register("user@test.com");
    const other = await register("other@test.com");
    const google = "https://lh3.googleusercontent.com/a/photo";
    await prisma.user.update({ where: { id: user.userId }, data: { avatarUrl: google } });

    await patchProfile(user.token, { name: "New name", avatarUrl: google }).expect(200);
    await patchProfile(user.token, { avatarUrl: "https://lh3.googleusercontent.com/a/someone-else" }).expect(400);
    await patchProfile(user.token, { portfolioUrls: [await uploaded(other.token)] }).expect(400);

    const avatar = await uploaded(user.token);
    const portfolio = [await uploaded(user.token), await uploaded(user.token)];
    await patchProfile(user.token, { avatarUrl: avatar, portfolioUrls: portfolio }).expect(200);
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.userId } });
    expect(saved.avatarUrl).toBe(avatar);
    expect(saved.portfolioUrls).toEqual(portfolio);
  });

  it("deletes an account's photos with the account", async () => {
    const user = await register("user@test.com");
    const other = await register("other@test.com");
    const theirs = await uploaded(other.token);
    await postListing(user.token, [await uploaded(user.token)]).expect(201);

    await request(app.getHttpServer()).delete("/users/me").set("Authorization", `Bearer ${user.token}`).expect(200);

    expect(fs.existsSync(path.join(uploadsDir, user.userId))).toBe(false);
    expect(fs.existsSync(fileOf(theirs))).toBe(true);
  });

  it("removes photos nothing uses once they're a day old", async () => {
    const user = await register("user@test.com");
    const used = await uploaded(user.token);
    const unusedOld = await uploaded(user.token);
    const unusedNew = await uploaded(user.token);
    const avatar = await uploaded(user.token);
    await postListing(user.token, [used]).expect(201);
    await patchProfile(user.token, { avatarUrl: avatar }).expect(200);
    const halfWritten = path.join(uploadsDir, user.userId, ".abc.jpg.part");
    fs.writeFileSync(halfWritten, "half");
    for (const file of [fileOf(used), fileOf(unusedOld), fileOf(avatar), halfWritten]) fs.utimesSync(file, TWO_DAYS_AGO, TWO_DAYS_AGO);
    // A folder left behind by an account that no longer exists.
    const stray = path.join(uploadsDir, "gone-account");
    fs.mkdirSync(stray);

    await request(app.getHttpServer()).get("/cron/cleanup-photos").expect(403);
    expect((await cleanup().expect(200)).body).toEqual({ removed: 1, kept: 3 });

    expect(fs.existsSync(fileOf(unusedOld))).toBe(false);
    expect(fs.existsSync(halfWritten)).toBe(false);
    expect(fs.existsSync(stray)).toBe(false);
    for (const url of [used, unusedNew, avatar]) expect(fs.existsSync(fileOf(url))).toBe(true);
  });

  it("deletes nothing if it would remove most photos at once", async () => {
    const user = await register("user@test.com");
    const folder = path.join(uploadsDir, user.userId);
    fs.mkdirSync(folder, { recursive: true });
    for (let i = 0; i < 25; i++) {
      const file = path.join(folder, `${String(i).padStart(16, "y")}.jpg`);
      fs.writeFileSync(file, JPEG_BYTES);
      fs.utimesSync(file, TWO_DAYS_AGO, TWO_DAYS_AGO);
    }

    expect((await cleanup().expect(500)).body.message).toMatch(/would delete 25 of 25/);
    expect(fs.readdirSync(folder)).toHaveLength(25);
  });
});
