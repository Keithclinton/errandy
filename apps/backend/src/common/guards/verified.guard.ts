import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { KycStatus } from "@prisma/client";

@Injectable()
export class VerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (user?.kycStatus !== KycStatus.verified) {
      throw new ForbiddenException("Identity verification is required before posting or bidding");
    }
    return true;
  }
}
