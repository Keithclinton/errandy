import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";

export interface StartJobResult {
  jobId: string;
}

/**
 * Thin wrapper around Smile ID's job-start API and webhook signature check.
 * Isolated behind this service so tests can mock it without real Smile ID credentials.
 * Field names/webhook shape are Smile ID's documented v2 REST contract — verify against
 * the live sandbox once real partner credentials are issued.
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

  private get sidServer(): string {
    return this.config.get<string>("SMILE_ID_SID_SERVER") ?? "0";
  }

  async startVerificationJob(userId: string): Promise<StartJobResult> {
    if (!this.partnerId || !this.apiKey) {
      this.logger.warn("Smile ID credentials not configured — returning a stub job id");
      return { jobId: `stub-${userId}-${Date.now()}` };
    }

    const response = await fetch(`https://${this.sidServer}.smileidentity.com/v1/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partner_id: this.partnerId,
        api_key: this.apiKey,
        partner_params: { user_id: userId, job_id: `${userId}-${Date.now()}`, job_type: 1 },
      }),
    });
    if (!response.ok) {
      throw new Error(`Smile ID job start failed with status ${response.status}`);
    }
    const data = (await response.json()) as { job_id: string };
    return { jobId: data.job_id };
  }

  /**
   * Smile ID signs webhooks with HMAC-SHA256 keyed by the API key, over
   * `timestamp + partnerId + "sid_request"` (in that order), base64-encoded.
   * This mirrors their official SDKs' confirm_signature — see
   * https://docs.usesmileid.com/integration-options/rest-api/signing-your-api-request/generate-signature
   */
  verifyWebhookSignature(timestamp: string | undefined, signature: string | undefined): boolean {
    if (!this.apiKey || !this.partnerId || !timestamp || !signature) return false;
    const expected = createHmac("sha256", this.apiKey)
      .update(timestamp)
      .update(this.partnerId)
      .update("sid_request")
      .digest("base64");
    const expectedBuffer = Buffer.from(expected, "base64");
    const actualBuffer = Buffer.from(signature, "base64");
    if (expectedBuffer.length !== actualBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, actualBuffer);
  }
}
