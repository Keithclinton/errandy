import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { KycStatus } from "@prisma/client";

export interface AuthUser {
  id: string;
  email: string;
  isAdmin: boolean;
  kycStatus: KycStatus;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
