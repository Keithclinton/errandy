/**
 * Smile ID's v3 webhook body. Deliberately a plain interface (not a class-validator
 * DTO): the real payload carries many fields we don't use (image_links, id_fields,
 * antifraud, device_signals, consent, ...), and our global ValidationPipe's
 * forbidNonWhitelisted would reject anything not explicitly declared. Authenticity
 * is enforced by the HMAC signature check in SmileIdService, not by field whitelisting.
 * See https://docs.usesmileid.com — Verification Webhooks.
 */
export interface KycWebhookDto {
  status: "clear" | "attention" | "block" | "error" | string;
  message?: string;
  reason?: string | null;
  product?: string;
  partner_params?: Record<string, string>;
}
