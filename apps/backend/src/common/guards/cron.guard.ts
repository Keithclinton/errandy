import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * For routes Vercel Cron calls: it always sends "Authorization: Bearer <CRON_SECRET>" when
 * CRON_SECRET is set on the project. Fails closed when CRON_SECRET isn't set, so an unset
 * secret can't be matched by sending "Bearer undefined". Pair with @Public().
 */
@Injectable()
export class CronGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>("CRON_SECRET");
    const authorization = context.switchToHttp().getRequest().headers?.authorization;
    if (!secret || authorization !== `Bearer ${secret}`) {
      throw new ForbiddenException();
    }
    return true;
  }
}
