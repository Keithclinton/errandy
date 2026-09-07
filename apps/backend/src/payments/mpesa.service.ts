import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";

export interface StkPushResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  simulated: boolean;
}

/**
 * Thin wrapper around Safaricom Daraja's STK Push API. There are no Daraja
 * credentials available yet, so this simulates an instant successful payment
 * when unconfigured — same pattern already used for Smile ID and Africa's
 * Talking in this codebase. The real integration (sketched, not built) will
 * need: OAuth via GET {baseUrl}/oauth/v1/generate?grant_type=client_credentials
 * (Basic auth consumerKey:consumerSecret), then POST
 * {baseUrl}/mpesa/stkpush/v1/processrequest with Timestamp, a Password of
 * base64(shortcode+passkey+timestamp), BusinessShortCode, TransactionType
 * "CustomerPayBillOnline", Amount, PartyA/PhoneNumber, PartyB (shortcode),
 * CallBackURL, AccountReference, TransactionDesc — returning
 * CheckoutRequestID/MerchantRequestID. Unlike Smile ID's webhook, Daraja's
 * callback has no signature scheme; the safeguard is matching the callback's
 * CheckoutRequestID against a known pending TokenPurchase row.
 */
@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);

  constructor(private readonly config: ConfigService) {}

  private get isConfigured(): boolean {
    return !!(
      this.config.get<string>("MPESA_CONSUMER_KEY") &&
      this.config.get<string>("MPESA_CONSUMER_SECRET") &&
      this.config.get<string>("MPESA_SHORTCODE") &&
      this.config.get<string>("MPESA_PASSKEY")
    );
  }

  async initiateStkPush(_params: {
    phone: string;
    amountKes: number;
    accountReference: string;
    transactionDesc: string;
  }): Promise<StkPushResult> {
    if (!this.isConfigured) {
      this.logger.warn("M-Pesa not configured — simulating an instant successful payment");
      const id = `stub-${randomUUID()}`;
      return { checkoutRequestId: id, merchantRequestId: id, simulated: true };
    }
    throw new Error("Real Daraja STK Push is not implemented yet — configure MPESA_* env vars only once this is built.");
  }
}
