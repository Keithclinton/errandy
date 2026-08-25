import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";

export interface WebTokenResult {
  jobId: string;
  token: string;
  partnerId: string | undefined;
}

/**
 * Thin wrapper around Smile ID's v3 Web SDK token API and webhook signature check.
 * Isolated behind this service so tests can mock it without real Smile ID
 * credentials. The actual ID + selfie capture happens client-side in Smile ID's
 * hosted v12 Web SDK (loaded from cdn.usesmileid.com) using the token this
 * returns; Smile ID posts the result to our webhook once the user completes it.
 */
@Injectable()
export class SmileIdService {
  private readonly logger = new Logger(SmileIdService.name);

  constructor(private readonly config: ConfigService) {}

  private get partnerId(): string | undefined {
    return this.config.get<string>("SMILE_ID_PARTNER_ID");
  }

  private get apiKey(): string | undefined {
    return this.config.get<string>("SMILE_ID_API_KEY");
  }

  /** "1" for production, anything else (including unset) for sandbox. */
  private get baseUrl(): string {
    const isProduction = this.config.get<string>("SMILE_ID_SID_SERVER") === "1";
    return isProduction ? "https://api.smileidentity.com" : "https://testapi.smileidentity.com";
  }

  private signRequest(timestamp: string): string {
    return createHmac("sha256", this.apiKey!)
      .update(timestamp)
      .update(this.partnerId!)
      .update("sid_request")
      .digest("base64");
  }

  async generateWebToken(userId: string): Promise<WebTokenResult> {
    const jobId = `${userId}-${Date.now()}`;
    if (!this.partnerId || !this.apiKey) {
      this.logger.warn("Smile ID credentials not configured — returning a stub token");
      return { jobId, token: `stub-token-${jobId}`, partnerId: this.partnerId };
    }

    const form = new FormData();
    form.append("user_id", userId);
    form.append("product", "biometric_kyc");
    form.append("partner_params", JSON.stringify({ job_id: jobId }));

    const response = await fetch(`${this.baseUrl}/v3/token`, {
      method: "POST",
      headers: {
        "SmileID-API-Key": this.apiKey,
        "SmileID-Partner-ID": this.partnerId,
        Accept: "application/json",
      },
      body: form,
    });
    if (!response.ok) {
      throw new Error(`Smile ID token generation failed with status ${response.status}`);
    }
    const data = (await response.json()) as { token: string };
    return { jobId, token: data.token, partnerId: this.partnerId };
  }

  /**
   * Smile ID signs webhooks with HMAC-SHA256 keyed by the API key, over
   * `Response-Timestamp + partnerId + "sid_request"` (in that order),
   * base64-encoded, compared against the Response-Signature header.
   * See https://docs.usesmileid.com — Verification Webhooks.
   */
  verifyWebhookSignature(timestamp: string | undefined, signature: string | undefined): boolean {
    if (!this.apiKey || !this.partnerId || !timestamp || !signature) return false;
    const expectedBuffer = Buffer.from(this.signRequest(timestamp), "base64");
    const actualBuffer = Buffer.from(signature, "base64");
    if (expectedBuffer.length !== actualBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, actualBuffer);
  }
}
