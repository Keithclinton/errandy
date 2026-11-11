import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Public } from "../common/decorators/public.decorator";
import { CronGuard } from "../common/guards/cron.guard";
import { EmailService } from "./email.service";

@ApiExcludeController()
@Controller("cron")
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Public()
  @UseGuards(CronGuard)
  @Get("digest")
  async runDigest() {
    return this.emailService.runUnreadMessagesDigest();
  }
}
