import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac } from "crypto";

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

  verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined): boolean {
    const secret = this.config.get<string>("SMILE_ID_WEBHOOK_SECRET");
    if (!secret || !signature) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    return expected === signature;
  }
}
