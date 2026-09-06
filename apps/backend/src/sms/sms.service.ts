import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Thin wrapper around Africa's Talking's SMS API (https://developers.africastalking.com/docs/sms/sending).
 * Their v1 messaging endpoint has been stable for years, but hasn't been verified against a
 * live account in this codebase — check the current docs once real credentials are in hand,
 * the same way the (now-removed) Smile ID integration needed correcting after its first pass.
 * Falls back to logging the code when unconfigured, so the OTP flow stays fully testable
 * without a real SMS account.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string | undefined {
    return this.config.get<string>("AFRICAS_TALKING_API_KEY");
  }

  private get username(): string | undefined {
    return this.config.get<string>("AFRICAS_TALKING_USERNAME");
  }

  private get baseUrl(): string {
    const isProduction = this.username !== "sandbox";
    return isProduction ? "https://api.africastalking.com/version1/messaging" : "https://api.sandbox.africastalking.com/version1/messaging";
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    const message = `${code} is your Errandspot verification code. It expires in 10 minutes.`;

    if (!this.apiKey || !this.username) {
      this.logger.warn(`SMS not configured — OTP for ${phone} is ${code} (logged instead of sent)`);
      return;
    }

    const body = new URLSearchParams({ username: this.username, to: phone, message });
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        apiKey: this.apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });
    if (!response.ok) {
      throw new Error(`SMS send failed with status ${response.status}`);
    }
  }
}
