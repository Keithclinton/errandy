import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as request from "supertest";
import { PrismaClient } from "@prisma/client";
import { MpesaMode, MpesaService, StkOutcome, StkPushParams, StkPushFailedError, darajaTimestamp } from "../src/payments/mpesa.service";
import { createTestApp, cleanDatabase, verifyUserKyc, nextTestPhone } from "./test-utils";

const CALLBACK_SECRET = "test-callback-secret"; // matches .env.test
const CRON_SECRET = "test-cron-secret"; // matches .env.test

/** Stands in for Daraja in live mode: records STK pushes and answers STK queries as told. */
class FakeMpesaService {
  mode: MpesaMode = "live";
  pushes: StkPushParams[] = [];
  queries: string[] = [];
  queryOutcome: StkOutcome = { state: "pending" };
  failNextPush = false;
  private counter = 0;

  async initiateStkPush(params: StkPushParams) {
    if (this.failNextPush) {
      this.failNextPush = false;
      throw new StkPushFailedError("Daraja rejected the STK push: Bad Request - Invalid PhoneNumber");
    }
    this.pushes.push(params);
    this.counter += 1;
    return { checkoutRequestId: `ws_CO_test_${this.counter}`, merchantRequestId: `mr_test_${this.counter}`, simulated: false };
  }

  async queryStkPush(checkoutRequestId: string): Promise<StkOutcome> {
    this.queries.push(checkoutRequestId);
    return this.queryOutcome;
  }

  reset() {
    this.mode = "live";
    this.pushes = [];
    this.queries = [];
    this.queryOutcome = { state: "pending" };
    this.failNextPush = false;
  }
}

function successCallback(checkoutRequestId: string, amount: number, receipt = "TKB1ABC2DE") {
  return {
    Body: {
      stkCallback: {
        MerchantRequestID: "mr_test",
        CheckoutRequestID: checkoutRequestId,
        ResultCode: 0,
        ResultDesc: "The service request is processed successfully.",
        CallbackMetadata: {
          Item: [
            { Name: "Amount", Value: amount },
            { Name: "MpesaReceiptNumber", Value: receipt },
            { Name: "TransactionDate", Value: 20261111120000 },
            { Name: "PhoneNumber", Value: 254712345678 },
          ],
        },
      },
    },
  };
}

function failureCallback(checkoutRequestId: string, resultCode: number, resultDesc: string) {
  return {
    Body: { stkCallback: { MerchantRequestID: "mr_test", CheckoutRequestID: checkoutRequestId, ResultCode: resultCode, ResultDesc: resultDesc } },
  };
}

describe("Payments with live M-Pesa (e2e)", () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const mpesa = new FakeMpesaService();

  beforeAll(async () => {
    app = await createTestApp((builder) => builder.overrideProvider(MpesaService).useValue(mpesa));
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    mpesa.reset();
  });

  /** A verified user, who therefore starts with the 3 signup tokens. */
  async function verifiedUser(email = "payer@test.com") {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password: "password123", name: email, phone: nextTestPhone(), acceptedTerms: true, termsVersion: "v1" })
      .expect(201);
    const accessToken = res.body.accessToken as string;
    await verifyUserKyc(app, accessToken);
    return { accessToken, userId: res.body.user.id as string };
  }

  async function startPurchase(accessToken: string, packId = "pack_5") {
    const res = await request(app.getHttpServer())
      .post("/tokens/purchases/initiate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ packId, phone: "0712345678" })
      .expect(201);
    const purchase = await prisma.tokenPurchase.findUniqueOrThrow({ where: { id: res.body.purchaseId } });
    return { body: res.body, purchase };
  }

  function postCallback(body: object, secret = CALLBACK_SECRET) {
    return request(app.getHttpServer()).post(`/tokens/purchases/payment-callback/${secret}`).send(body);
  }

  async function balanceOf(userId: string) {
    return (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).tokenBalance;
  }

  it("leaves a purchase pending until Daraja calls back, then credits it once even when the callback repeats", async () => {
    const payer = await verifiedUser();
    const { body, purchase } = await startPurchase(payer.accessToken);

    expect(body).toEqual({ purchaseId: purchase.id, status: "pending" });
    expect(await balanceOf(payer.userId)).toBe(3);
    expect(mpesa.pushes).toHaveLength(1);
    expect(mpesa.pushes[0]).toMatchObject({ phone: "+254712345678", amountKes: 200 });
    expect(mpesa.pushes[0].accountReference.length).toBeLessThanOrEqual(12);
    expect(mpesa.pushes[0].transactionDesc.length).toBeLessThanOrEqual(13);

    const callbackRes = await postCallback(successCallback(purchase.checkoutRequestId!, 200)).expect(200);
    expect(callbackRes.body).toEqual({ ResultCode: 0, ResultDesc: "Accepted" });
    await postCallback(successCallback(purchase.checkoutRequestId!, 200)).expect(200);

    expect(await balanceOf(payer.userId)).toBe(8);
    const ledger = await prisma.tokenTransaction.findMany({ where: { userId: payer.userId, type: "purchase" } });
    expect(ledger).toHaveLength(1);

    const statusRes = await request(app.getHttpServer())
      .get(`/tokens/purchases/${purchase.id}`)
      .set("Authorization", `Bearer ${payer.accessToken}`)
      .expect(200);
    expect(statusRes.body).toMatchObject({ status: "completed", resultCode: 0, mpesaReceiptNumber: "TKB1ABC2DE" });
    expect(statusRes.body.checkoutRequestId).toBeUndefined();

    const notifications = await request(app.getHttpServer())
      .get("/notifications")
      .set("Authorization", `Bearer ${payer.accessToken}`)
      .expect(200);
    expect(notifications.body.items.filter((n: any) => n.type === "tokens_purchased")).toHaveLength(1);
  });

  it("credits once when duplicate callbacks arrive at the same time", async () => {
    const payer = await verifiedUser();
    const { purchase } = await startPurchase(payer.accessToken);

    await Promise.all(
      Array.from({ length: 5 }, () => postCallback(successCallback(purchase.checkoutRequestId!, 200)).expect(200)),
    );

    expect(await balanceOf(payer.userId)).toBe(8);
    expect(await prisma.tokenTransaction.count({ where: { userId: payer.userId, type: "purchase" } })).toBe(1);
  });

  it("rejects callbacks that don't carry the callback secret", async () => {
    const payer = await verifiedUser();
    const { purchase } = await startPurchase(payer.accessToken);

    await postCallback(successCallback(purchase.checkoutRequestId!, 200), "wrong-secret").expect(404);

    expect(await balanceOf(payer.userId)).toBe(3);
    const after = await prisma.tokenPurchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(after.status).toBe("pending");
  });

  it("doesn't credit a success callback whose amount doesn't match the purchase", async () => {
    const payer = await verifiedUser();
    const { purchase } = await startPurchase(payer.accessToken);

    await postCallback(successCallback(purchase.checkoutRequestId!, 1)).expect(200);

    expect(await balanceOf(payer.userId)).toBe(3);
    const after = await prisma.tokenPurchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(after.status).toBe("pending");
  });

  it("marks a cancelled payment failed, but still credits it if a success arrives later", async () => {
    const payer = await verifiedUser();
    const { purchase } = await startPurchase(payer.accessToken);

    await postCallback(failureCallback(purchase.checkoutRequestId!, 1032, "Request cancelled by user")).expect(200);
    const failed = await request(app.getHttpServer())
      .get(`/tokens/purchases/${purchase.id}`)
      .set("Authorization", `Bearer ${payer.accessToken}`)
      .expect(200);
    expect(failed.body).toMatchObject({ status: "failed", resultCode: 1032 });
    expect(await balanceOf(payer.userId)).toBe(3);

    // If Daraja ever reports success after a failure, the payer's money has moved: honour it.
    await postCallback(successCallback(purchase.checkoutRequestId!, 200)).expect(200);
    expect(await balanceOf(payer.userId)).toBe(8);
  });

  it("asks Daraja directly once a callback is overdue, at most once per interval", async () => {
    const payer = await verifiedUser();
    const { purchase } = await startPurchase(payer.accessToken);
    const getStatus = () =>
      request(app.getHttpServer())
        .get(`/tokens/purchases/${purchase.id}`)
        .set("Authorization", `Bearer ${payer.accessToken}`)
        .expect(200);

    // Too early to ask: the callback normally arrives within seconds.
    await getStatus();
    expect(mpesa.queries).toHaveLength(0);

    await prisma.tokenPurchase.update({ where: { id: purchase.id }, data: { createdAt: new Date(Date.now() - 60_000) } });
    await getStatus();
    await getStatus();
    expect(mpesa.queries).toEqual([purchase.checkoutRequestId]);

    await prisma.tokenPurchase.update({ where: { id: purchase.id }, data: { lastCheckedAt: new Date(Date.now() - 20_000) } });
    mpesa.queryOutcome = { state: "completed", resultCode: 0, resultDesc: "The service request is processed successfully." };
    const res = await getStatus();
    expect(res.body.status).toBe("completed");
    expect(mpesa.queries).toHaveLength(2);
    expect(await balanceOf(payer.userId)).toBe(8);

    // A callback arriving afterwards adds the receipt number without crediting again.
    await postCallback(successCallback(purchase.checkoutRequestId!, 200, "TKB9LATE00")).expect(200);
    expect(await balanceOf(payer.userId)).toBe(8);
    const after = await prisma.tokenPurchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(after.mpesaReceiptNumber).toBe("TKB9LATE00");
  });

  it("settles overdue purchases from the cron, which requires the cron secret", async () => {
    const payer = await verifiedUser();
    const { purchase } = await startPurchase(payer.accessToken);
    await prisma.tokenPurchase.update({ where: { id: purchase.id }, data: { createdAt: new Date(Date.now() - 10 * 60_000) } });
    mpesa.queryOutcome = { state: "failed", resultCode: 1037, resultDesc: "DS timeout user cannot be reached" };

    await request(app.getHttpServer()).get("/cron/reconcile-payments").expect(403);
    await request(app.getHttpServer()).get("/cron/reconcile-payments").set("Authorization", "Bearer undefined").expect(403);

    const res = await request(app.getHttpServer())
      .get("/cron/reconcile-payments")
      .set("Authorization", `Bearer ${CRON_SECRET}`)
      .expect(200);
    expect(res.body).toEqual({ checked: 1, settled: 1 });
    const after = await prisma.tokenPurchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(after).toMatchObject({ status: "failed", resultCode: 1037 });
  });

  it("marks the purchase failed and returns 502 when Daraja won't start the payment", async () => {
    const payer = await verifiedUser();
    mpesa.failNextPush = true;

    const res = await request(app.getHttpServer())
      .post("/tokens/purchases/initiate")
      .set("Authorization", `Bearer ${payer.accessToken}`)
      .send({ packId: "pack_1", phone: "0712345678" })
      .expect(502);
    expect(res.body.message).toMatch(/M-Pesa prompt/);

    const purchases = await prisma.tokenPurchase.findMany({ where: { userId: payer.userId } });
    expect(purchases).toHaveLength(1);
    expect(purchases[0].status).toBe("failed");
  });

  it("limits how many M-Pesa prompts one account can start per minute, without affecting others", async () => {
    const payer = await verifiedUser();
    for (let i = 0; i < 5; i += 1) {
      await startPurchase(payer.accessToken, "pack_1");
    }
    await request(app.getHttpServer())
      .post("/tokens/purchases/initiate")
      .set("Authorization", `Bearer ${payer.accessToken}`)
      .send({ packId: "pack_1", phone: "0712345678" })
      .expect(429);

    const other = await verifiedUser("other@test.com");
    await startPurchase(other.accessToken, "pack_1");
  });

  it("refuses purchases outright when M-Pesa isn't configured and simulation is off", async () => {
    const payer = await verifiedUser();
    mpesa.mode = "unavailable";

    await request(app.getHttpServer())
      .post("/tokens/purchases/initiate")
      .set("Authorization", `Bearer ${payer.accessToken}`)
      .send({ packId: "pack_1", phone: "0712345678" })
      .expect(503);

    expect(await prisma.tokenPurchase.count({ where: { userId: payer.userId } })).toBe(0);
    expect(await balanceOf(payer.userId)).toBe(3);
  });
});

describe("MpesaService's Daraja requests", () => {
  const LIVE_CONFIG: Record<string, string> = {
    MPESA_ENV: "sandbox",
    MPESA_CONSUMER_KEY: "key",
    MPESA_CONSUMER_SECRET: "secret",
    MPESA_SHORTCODE: "174379",
    MPESA_PASSKEY: "passkey",
    MPESA_CALLBACK_URL: "https://example.test/api/tokens/purchases/payment-callback/",
    MPESA_CALLBACK_SECRET: "s3cret",
  };
  const configWith = (values: Record<string, string>) => ({ get: (key: string) => values[key] }) as unknown as ConfigService;
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it("picks its mode from the configuration, with credentials winning over MPESA_SIMULATE", () => {
    expect(new MpesaService(configWith(LIVE_CONFIG)).mode).toBe("live");
    expect(new MpesaService(configWith({ ...LIVE_CONFIG, MPESA_SIMULATE: "true" })).mode).toBe("live");
    expect(new MpesaService(configWith({ MPESA_SIMULATE: "true" })).mode).toBe("simulated");
    expect(new MpesaService(configWith({})).mode).toBe("unavailable");
    const { MPESA_CALLBACK_SECRET: _omitted, ...withoutSecret } = LIVE_CONFIG;
    expect(new MpesaService(configWith(withoutSecret)).mode).toBe("unavailable");
  });

  it("formats Daraja's timestamp in Kenyan time", () => {
    expect(darajaTimestamp(new Date("2026-11-11T21:05:09.123Z"))).toBe("20261112000509");
  });

  it("sends a well-formed Paybill STK push and reuses the OAuth token", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/oauth/")) return json(200, { access_token: "tok", expires_in: "3599" });
      return json(200, { MerchantRequestID: "mr-1", CheckoutRequestID: "ws_CO_1", ResponseCode: "0" });
    });
    const service = new MpesaService(configWith(LIVE_CONFIG));

    const result = await service.initiateStkPush({
      phone: "+254712345678",
      amountKes: 200,
      accountReference: "Errandspot-way-too-long",
      transactionDesc: "a description that is too long",
    });
    await service.initiateStkPush({ phone: "+254712345678", amountKes: 50, accountReference: "Errandspot", transactionDesc: "1 token" });

    expect(result).toEqual({ checkoutRequestId: "ws_CO_1", merchantRequestId: "mr-1", simulated: false });
    const urls = fetchMock.mock.calls.map(([url]) => url as string);
    expect(urls.filter((u) => u.includes("/oauth/"))).toHaveLength(1);
    expect(urls[0]).toBe("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Basic ${Buffer.from("key:secret").toString("base64")}`);

    const [pushUrl, pushInit] = fetchMock.mock.calls[1];
    expect(pushUrl).toBe("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest");
    expect(pushInit.headers.Authorization).toBe("Bearer tok");
    const body = JSON.parse(pushInit.body);
    expect(body).toMatchObject({
      BusinessShortCode: "174379",
      TransactionType: "CustomerPayBillOnline",
      Amount: 200,
      PartyA: "254712345678",
      PartyB: "174379",
      PhoneNumber: "254712345678",
      CallBackURL: "https://example.test/api/tokens/purchases/payment-callback/s3cret",
      AccountReference: "Errandspot-w",
      TransactionDesc: "a description",
    });
    expect(body.Timestamp).toMatch(/^\d{14}$/);
    expect(Buffer.from(body.Password, "base64").toString()).toBe(`174379passkey${body.Timestamp}`);
  });

  it("throws StkPushFailedError when Daraja rejects the push", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/oauth/")) return json(200, { access_token: "tok", expires_in: "3599" });
      return json(400, { requestId: "r", errorCode: "400.002.02", errorMessage: "Bad Request - Invalid PhoneNumber" });
    });
    const service = new MpesaService(configWith(LIVE_CONFIG));
    await expect(
      service.initiateStkPush({ phone: "+254712345678", amountKes: 50, accountReference: "Errandspot", transactionDesc: "1 token" }),
    ).rejects.toThrow(/Invalid PhoneNumber/);
  });

  it("reads STK query answers, treating anything short of a final result as pending", async () => {
    const answers = [
      json(500, { requestId: "r", errorCode: "500.001.1001", errorMessage: "The transaction is being processed" }),
      json(200, { ResponseCode: "0", ResultCode: "4999", ResultDesc: "The transaction is still under processing" }),
      json(200, { ResponseCode: "0", ResultCode: "1032", ResultDesc: "Request cancelled by user" }),
      json(200, { ResponseCode: "0", ResultCode: "0", ResultDesc: "The service request is processed successfully." }),
    ];
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/oauth/")) return json(200, { access_token: "tok", expires_in: "3599" });
      return answers.shift()!;
    });
    const service = new MpesaService(configWith({ ...LIVE_CONFIG, MPESA_ENV: "production" }));

    expect(await service.queryStkPush("ws_CO_1")).toEqual({ state: "pending" });
    expect(await service.queryStkPush("ws_CO_1")).toEqual({ state: "pending" });
    expect(await service.queryStkPush("ws_CO_1")).toEqual({ state: "failed", resultCode: 1032, resultDesc: "Request cancelled by user" });
    expect(await service.queryStkPush("ws_CO_1")).toMatchObject({ state: "completed", resultCode: 0 });
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query");
  });
});
