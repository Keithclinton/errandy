import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
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

  @Post("purchases/initiate")
  initiatePurchase(@CurrentUser() user: AuthUser, @Body() dto: InitiatePurchaseDto) {
    return this.tokensService.initiatePurchase(user.id, dto);
  }

  @Get("purchases/:id")
  getPurchase(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.tokensService.getPurchase(user.id, id);
  }

  @Public()
  @Post("purchases/mpesa-callback")
  async mpesaCallback(@Body() body: any) {
    // Real Daraja shape: body.Body.stkCallback.{CheckoutRequestID, MerchantRequestID,
    // ResultCode, ResultDesc, CallbackMetadata.Item[] (contains MpesaReceiptNumber/Amount/PhoneNumber)}.
    // Scaffolding only — never invoked until a real STK push exists.
    const callback = body?.Body?.stkCallback;
    if (!callback?.CheckoutRequestID) return { ok: true };
    const receipt = callback.CallbackMetadata?.Item?.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value;
    await this.tokensService.completePurchaseFromCallback(
      callback.CheckoutRequestID,
      callback.ResultCode,
      callback.ResultDesc,
      receipt,
    );
    return { ok: true };
  }
}
