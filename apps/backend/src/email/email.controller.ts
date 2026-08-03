import { Controller, ForbiddenException, Headers, Post } from "@nestjs/common";
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

  @Public()
  @Post("digest")
  async runDigest(@Headers("x-cron-secret") cronSecret: string) {
    if (!cronSecret || cronSecret !== this.config.get<string>("CRON_SECRET")) {
      throw new ForbiddenException();
    }
    return this.emailService.runUnreadMessagesDigest();
  }
}
