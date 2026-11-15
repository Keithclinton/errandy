import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiExcludeController, ApiExcludeEndpoint, ApiTags } from "@nestjs/swagger";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { CronGuard } from "../common/guards/cron.guard";
import { trackByAccount } from "../common/track-by-account";
import { TokensService } from "./tokens.service";
import { InitiatePurchaseDto } from "./dto/initiate-purchase.dto";

@ApiTags("tokens")
@ApiBearerAuth()
@Controller("tokens")
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Get("balance")
  async getBalance(@CurrentUser() user: AuthUser) {
    return { balance: await this.tokensService.getBalance(user.id) };
  }

  @Get("packs")
  getPacks() {
    return this.tokensService.listPacks();
  }

  @Get("transactions")
  listTransactions(@CurrentUser() user: AuthUser, @Query("page") page?: string) {
    return this.tokensService.listTransactions(user.id, page ? Number(page) : 1);
  }

  // Each call pops an M-Pesa prompt on someone's phone, so keep it well short of spammable.
  @Throttle({ default: { limit: 5, ttl: 60_000, getTracker: trackByAccount } })
  @Post("purchases/initiate")
  initiatePurchase(@CurrentUser() user: AuthUser, @Body() dto: InitiatePurchaseDto) {
    return this.tokensService.initiatePurchase(user.id, dto);
  }

  @Get("purchases/:id")
  getPurchase(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.tokensService.getPurchase(user.id, id);
  }

  // Daraja posts STK results here; the last path segment is MPESA_CALLBACK_SECRET. The path
  // avoids the word "mpesa", which Daraja is reported to reject in callback URLs.
  @Public()
  @SkipThrottle()
  @ApiExcludeEndpoint()
  @HttpCode(200)
  @Post("purchases/payment-callback/:secret")
  async paymentCallback(@Param("secret") secret: string, @Body() body: unknown) {
    await this.tokensService.handlePaymentCallback(secret, body);
    return { ResultCode: 0, ResultDesc: "Accepted" };
  }
}

@ApiExcludeController()
@Controller("cron")
export class PaymentsCronController {
  constructor(private readonly tokensService: TokensService) {}

  /** Backstop for purchases whose callback never arrived after the payer left the page. */
  @Public()
  @UseGuards(CronGuard)
  @Get("reconcile-payments")
  reconcilePayments() {
    return this.tokensService.reconcileOverduePurchases();
  }
}
