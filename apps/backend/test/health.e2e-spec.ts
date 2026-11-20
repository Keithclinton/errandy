import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { createTestApp } from "./test-utils";

describe("Health check (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("answers without signing in and doesn't touch the database by default", async () => {
    const res = await request(app.getHttpServer()).get("/health").expect(200);
    expect(res.body).toEqual({ status: "ok", release: expect.any(String) });
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("checks the database with ?db=1", async () => {
    const res = await request(app.getHttpServer()).get("/health?db=1").expect(200);
    expect(res.body).toMatchObject({ status: "ok", database: "ok" });
  });
});
