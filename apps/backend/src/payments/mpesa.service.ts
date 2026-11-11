import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";

/**
 * - live: Daraja credentials are configured, payments charge for real.
 * - simulated: MPESA_SIMULATE=true and no credentials; every payment succeeds instantly (local dev/tests).
 * - unavailable: neither; purchases are refused rather than handed out for free.
 */
export type MpesaMode = "live" | "simulated" | "unavailable";

export interface StkPushParams {
  /** E.164, as produced by normalizeKenyanPhone (e.g. +254712345678). */
  phone: string;
  amountKes: number;
  accountReference: string;
  transactionDesc: string;
}

export interface StkPushResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  simulated: boolean;
}

/** What Daraja says about an STK push. "pending" also covers "Daraja couldn't tell us right now". */
export type StkOutcome =
  | { state: "pending" }
  | { state: "completed"; resultCode: number; resultDesc: string }
  | { state: "failed"; resultCode: number; resultDesc: string };

/** Daraja didn't start the payment, so no prompt reached the payer's phone. */
export class StkPushFailedError extends Error {}

const BASE_URLS = {
  sandbox: "https://sandbox.safaricom.co.ke",
  production: "https://api.safaricom.co.ke",
} as const;

const REQUIRED_ENV = [
  "MPESA_CONSUMER_KEY",
  "MPESA_CONSUMER_SECRET",
  "MPESA_SHORTCODE",
  "MPESA_PASSKEY",
  "MPESA_CALLBACK_URL",
  "MPESA_CALLBACK_SECRET",
] as const;

// Daraja rejects longer values outright.
const ACCOUNT_REFERENCE_MAX_LENGTH = 12;
const TRANSACTION_DESC_MAX_LENGTH = 13;

const REQUEST_TIMEOUT_MS = 15_000;
// Refresh the OAuth token a minute before Daraja says it expires.
const TOKEN_EXPIRY_MARGIN_MS = 60_000;
// The STK query answers with this ResultCode while the payer still has the prompt open.
const STILL_PROCESSING_RESULT_CODE = 4999;
const INVALID_ACCESS_TOKEN_ERROR_CODE = "404.001.03";

/** Daraja's Timestamp format, YYYYMMDDHHmmss, in Kenyan time (EAT is UTC+3 with no DST). */
export function darajaTimestamp(date: Date): string {
  const eat = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  return eat.toISOString().replace(/[-T:]/g, "").slice(0, 14);
}

/** Daraja wants 2547XXXXXXXX: the E.164 number without its "+". */
export function toMsisdn(e164Phone: string): string {
  return e164Phone.replace(/^\+/, "");
}

/**
 * Safaricom Daraja's M-Pesa Express (STK Push) on a Paybill: OAuth, STK push to start a
 * payment, and the STK query to ask for a payment's result when its callback is late.
 * The callback itself is handled in TokensController, at MPESA_CALLBACK_URL with
 * MPESA_CALLBACK_SECRET appended as the last path segment.
 */
@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {
    const missing = REQUIRED_ENV.filter((key) => !this.config.get<string>(key));
    if (missing.length > 0 && missing.length < REQUIRED_ENV.length) {
      this.logger.warn(`M-Pesa is partly configured; missing ${missing.join(", ")}. Real payments stay off until all are set.`);
    }
  }

  get mode(): MpesaMode {
    if (REQUIRED_ENV.every((key) => !!this.config.get<string>(key))) return "live";
    return this.config.get<string>("MPESA_SIMULATE") === "true" ? "simulated" : "unavailable";
  }

  async initiateStkPush(params: StkPushParams): Promise<StkPushResult> {
    const mode = this.mode;
    if (mode === "simulated") {
      this.logger.warn("MPESA_SIMULATE is on; simulating an instant successful payment");
      const id = `stub-${randomUUID()}`;
      return { checkoutRequestId: id, merchantRequestId: id, simulated: true };
    }
    if (mode === "unavailable") {
      throw new StkPushFailedError("M-Pesa is not configured");
    }

    const msisdn = toMsisdn(params.phone);
    const timestamp = darajaTimestamp(new Date());
    let response: DarajaResponse;
    try {
      response = await this.post("/mpesa/stkpush/v1/processrequest", {
        BusinessShortCode: this.shortcode,
        Password: this.password(timestamp),
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(params.amountKes),
        PartyA: msisdn,
        PartyB: this.shortcode,
        PhoneNumber: msisdn,
        CallBackURL: this.callbackUrl,
        AccountReference: params.accountReference.slice(0, ACCOUNT_REFERENCE_MAX_LENGTH),
        TransactionDesc: params.transactionDesc.slice(0, TRANSACTION_DESC_MAX_LENGTH),
      });
    } catch (err) {
      throw new StkPushFailedError(`Couldn't reach Daraja: ${err instanceof Error ? err.message : String(err)}`);
    }

    const { ok, status, data } = response;
    if (!ok || String(data?.ResponseCode) !== "0" || !data?.CheckoutRequestID) {
      const reason = data?.errorMessage ?? data?.ResponseDescription ?? `HTTP ${status}`;
      throw new StkPushFailedError(`Daraja rejected the STK push: ${reason}`);
    }
    return {
      checkoutRequestId: String(data.CheckoutRequestID),
      merchantRequestId: String(data.MerchantRequestID ?? ""),
      simulated: false,
    };
  }

  /** Never throws: anything short of a definite answer from Daraja comes back as "pending". */
  async queryStkPush(checkoutRequestId: string): Promise<StkOutcome> {
    if (this.mode !== "live") return { state: "pending" };

    const timestamp = darajaTimestamp(new Date());
    let response: DarajaResponse;
    try {
      response = await this.post("/mpesa/stkpushquery/v1/query", {
        BusinessShortCode: this.shortcode,
        Password: this.password(timestamp),
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      });
    } catch (err) {
      this.logger.warn(`STK query for ${checkoutRequestId} failed: ${err instanceof Error ? err.message : String(err)}`);
      return { state: "pending" };
    }

    // While the prompt is still open, Daraja answers with an error body (e.g. 500.001.1001)
    // or ResultCode 4999 rather than a final result.
    const { ok, data } = response;
    if (!ok || String(data?.ResponseCode) !== "0" || data?.ResultCode === undefined) {
      return { state: "pending" };
    }
    const resultCode = Number(data.ResultCode);
    if (Number.isNaN(resultCode) || resultCode === STILL_PROCESSING_RESULT_CODE) {
      return { state: "pending" };
    }
    const resultDesc = String(data.ResultDesc ?? "");
    return resultCode === 0 ? { state: "completed", resultCode, resultDesc } : { state: "failed", resultCode, resultDesc };
  }

  private get baseUrl(): string {
    return this.config.get<string>("MPESA_ENV") === "production" ? BASE_URLS.production : BASE_URLS.sandbox;
  }

  private get shortcode(): string {
    return this.config.get<string>("MPESA_SHORTCODE")!;
  }

  private get callbackUrl(): string {
    const base = this.config.get<string>("MPESA_CALLBACK_URL")!.replace(/\/+$/, "");
    return `${base}/${this.config.get<string>("MPESA_CALLBACK_SECRET")}`;
  }

  private password(timestamp: string): string {
    return Buffer.from(`${this.shortcode}${this.config.get<string>("MPESA_PASSKEY")}${timestamp}`).toString("base64");
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessToken.expiresAt) {
      return this.accessToken.value;
    }
    const credentials = Buffer.from(
      `${this.config.get<string>("MPESA_CONSUMER_KEY")}:${this.config.get<string>("MPESA_CONSUMER_SECRET")}`,
    ).toString("base64");
    const res = await fetch(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${credentials}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.access_token) {
      throw new Error(`Daraja OAuth failed with HTTP ${res.status}`);
    }
    const ttlMs = (Number(data.expires_in) || 3599) * 1000;
    this.accessToken = { value: data.access_token, expiresAt: Date.now() + ttlMs - TOKEN_EXPIRY_MARGIN_MS };
    return this.accessToken.value;
  }

  private async post(path: string, body: Record<string, unknown>): Promise<DarajaResponse> {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = await res.json().catch(() => null);
    if (res.status === 401 || data?.errorCode === INVALID_ACCESS_TOKEN_ERROR_CODE) {
      // Revoked or expired early: fetch a fresh token next time.
      this.accessToken = null;
    }
    return { ok: res.ok, status: res.status, data };
  }
}

interface DarajaResponse {
  ok: boolean;
  status: number;
  // Daraja's JSON shapes vary by endpoint and by success/error.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}
