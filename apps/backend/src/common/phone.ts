import { BadRequestException } from "@nestjs/common";

/**
 * Normalizes a Kenyan phone number to E.164 (+2547XXXXXXXX / +2541XXXXXXXX), accepting the
 * common input shapes: 07XXXXXXXX, 7XXXXXXXX, 2547XXXXXXXX, +2547XXXXXXXX (and the 01X mobile
 * range the same way).
 */
export function normalizeKenyanPhone(input: string): string {
  const digits = input.replace(/[^\d]/g, "");
  let local: string | null = null;
  if (/^0[71]\d{8}$/.test(digits)) {
    local = digits.slice(1);
  } else if (/^254[71]\d{8}$/.test(digits)) {
    local = digits.slice(3);
  } else if (/^[71]\d{8}$/.test(digits)) {
    local = digits;
  }
  if (!local) {
    throw new BadRequestException("Enter a valid Kenyan phone number, e.g. 0712345678");
  }
  return `+254${local}`;
}
