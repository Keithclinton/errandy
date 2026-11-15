import { INestApplication } from "@nestjs/common";
import { json, urlencoded } from "express";

/** ID check photos are sent inline as base64, so this one route takes a bigger body. */
export const ID_VERIFICATION_PATH = "/kyc/id-verification";
const ID_VERIFICATION_BODY_LIMIT = "5mb";

/**
 * Shared by the real app and the e2e tests. Nest's own body parser is disabled so the JSON
 * parser can keep the raw bytes on req.rawBody for any webhook that signs its payload.
 */
export function applyBodyParsers(app: INestApplication): void {
  // Must come first: once a parser has read the body, the general one below skips it.
  app.use(ID_VERIFICATION_PATH, json({ limit: ID_VERIFICATION_BODY_LIMIT }));
  app.use(
    json({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(urlencoded({ extended: true }));
}
