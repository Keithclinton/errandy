import { User } from "@prisma/client";

type SecretField = "passwordHash" | "refreshTokenHash" | "passwordResetTokenHash";

/** A user row minus the password and token hashes, so it's safe to return from the API. */
export function withoutSecrets<T extends Pick<User, SecretField>>(user: T): Omit<T, SecretField> {
  const safe: Partial<T> = { ...user };
  delete safe.passwordHash;
  delete safe.refreshTokenHash;
  delete safe.passwordResetTokenHash;
  return safe as Omit<T, SecretField>;
}
