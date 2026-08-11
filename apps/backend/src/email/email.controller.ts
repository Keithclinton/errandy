import { Controller, ForbiddenException, Get, Headers } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { Public } from "../common/decorators/public.decorator";
import { EmailService } from "./email.service";

@ApiExcludeController()
@Controller("cron")
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  // GET + "Authorization: Bearer <CRON_SECRET>" matches Vercel Cron's actual invocation
  // convention: it always issues a GET and attaches that header automatically when a
  // CRON_SECRET env var is set on the project.
  @Public()
  @Get("digest")
  async runDigest(@Headers("authorization") authorization: string | undefined) {
    const expected = `Bearer ${this.config.get<string>("CRON_SECRET")}`;
    if (!authorization || authorization !== expected) {
      throw new ForbiddenException();
    }
    return this.emailService.runUnreadMessagesDigest();
  }
}
