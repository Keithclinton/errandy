import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma, TokenTransactionType, TokenPurchaseStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MpesaService } from "../payments/mpesa.service";
import { InsufficientTokensException } from "./exceptions/insufficient-tokens.exception";
import { TOKEN_PACKS, TokenPack } from "./token-packs";
import { InitiatePurchaseDto } from "./dto/initiate-purchase.dto";
import { normalizeKenyanPhone } from "../common/phone";
import { EVENTS, TokensPurchasedEvent } from "../common/events/domain-events";

const SIGNUP_BONUS_TOKENS = 2;

interface LedgerParams {
  userId: string;
  amount: number;
  type: TokenTransactionType;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

@Injectable()
export class TokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mpesaService: MpesaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Atomic conditional decrement — never goes negative, no read-then-write race. */
  async debit(tx: Prisma.TransactionClient, { userId, amount, type, relatedEntityType, relatedEntityId }: LedgerParams): Promise<{ balanceAfter: number }> {
    const result = await tx.user.updateMany({
      where: { id: userId, tokenBalance: { gte: amount } },
      data: { tokenBalance: { decrement: amount } },
    });
    if (result.count === 0) {
      throw new InsufficientTokensException("Not enough tokens");
    }
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { tokenBalance: true } });
    await tx.tokenTransaction.create({
      data: { userId, type, amount: -amount, balanceAfter: user.tokenBalance, relatedEntityType, relatedEntityId },
    });
    return { balanceAfter: user.tokenBalance };
  }

  async credit(tx: Prisma.TransactionClient, { userId, amount, type, relatedEntityType, relatedEntityId }: LedgerParams): Promise<{ balanceAfter: number }> {
    const user = await tx.user.update({
      where: { id: userId },
      data: { tokenBalance: { increment: amount } },
      select: { tokenBalance: true },
    });
    await tx.tokenTransaction.create({
      data: { userId, type, amount, balanceAfter: user.tokenBalance, relatedEntityType, relatedEntityId },
    });
    return { balanceAfter: user.tokenBalance };
  }

  /** No-ops silently if already granted — makes the signup bonus non-repeatable even on re-verification. */
  async grantSignupBonusIfEligible(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    const result = await tx.user.updateMany({
      where: { id: userId, hasReceivedSignupTokens: false },
      data: { tokenBalance: { increment: SIGNUP_BONUS_TOKENS }, hasReceivedSignupTokens: true },
    });
    if (result.count === 0) return;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { tokenBalance: true } });
    await tx.tokenTransaction.create({
      data: {
        userId,
        type: TokenTransactionType.signup_grant,
        amount: SIGNUP_BONUS_TOKENS,
        balanceAfter: user.tokenBalance,
        relatedEntityType: "user",
        relatedEntityId: userId,
      },
    });
  }

  async getBalance(userId: string): Promise<number> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { tokenBalance: true } });
    return user.tokenBalance;
  }

  async listTransactions(userId: string, page = 1, limit = 20) {
    const [items, total] = await Promise.all([
      this.prisma.tokenTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tokenTransaction.count({ where: { userId } }),
    ]);
    return { items, total, page, limit };
  }

  listPacks(): TokenPack[] {
    return TOKEN_PACKS;
  }

  async initiatePurchase(userId: string, dto: InitiatePurchaseDto) {
    const pack = TOKEN_PACKS.find((p) => p.id === dto.packId);
    if (!pack) throw new BadRequestException("Unknown token pack");
    const phone = normalizeKenyanPhone(dto.phone);

    const purchase = await this.prisma.tokenPurchase.create({
      data: { userId, tokens: pack.tokens, amountKes: pack.amountKes, phone, status: TokenPurchaseStatus.pending },
    });

    const stk = await this.mpesaService.initiateStkPush({
      phone,
      amountKes: pack.amountKes,
      accountReference: purchase.id,
      transactionDesc: `Errandspot ${pack.tokens} token(s)`,
    });

    await this.prisma.tokenPurchase.update({
      where: { id: purchase.id },
      data: { checkoutRequestId: stk.checkoutRequestId, merchantRequestId: stk.merchantRequestId, simulated: stk.simulated },
    });

    if (!stk.simulated) {
      return { purchaseId: purchase.id, status: TokenPurchaseStatus.pending };
    }

    const { balanceAfter } = await this.prisma.$transaction(async (tx) => {
      const credited = await this.credit(tx, {
        userId,
        amount: pack.tokens,
        type: TokenTransactionType.purchase,
        relatedEntityType: "token_purchase",
        relatedEntityId: purchase.id,
      });
      await tx.tokenPurchase.update({
        where: { id: purchase.id },
        data: { status: TokenPurchaseStatus.completed, completedAt: new Date() },
      });
      return credited;
    });
    await this.events.emitAsync(EVENTS.TOKENS_PURCHASED, {
      userId,
      tokens: pack.tokens,
      amountKes: pack.amountKes.toString(),
      purchaseId: purchase.id,
      balanceAfter,
    } satisfies TokensPurchasedEvent);

    return { purchaseId: purchase.id, status: TokenPurchaseStatus.completed, balance: balanceAfter };
  }

  async getPurchase(userId: string, purchaseId: string) {
    const purchase = await this.prisma.tokenPurchase.findUnique({ where: { id: purchaseId } });
    if (!purchase || purchase.userId !== userId) throw new NotFoundException("Purchase not found");
    return purchase;
  }

  /**
   * Sketched for the real Daraja callback to call once STK Push is actually wired up.
   * Never invoked today since initiateStkPush only ever returns simulated results.
   */
  async completePurchaseFromCallback(
    checkoutRequestId: string,
    resultCode: number,
    resultDesc: string,
    mpesaReceiptNumber?: string,
  ): Promise<void> {
    const purchase = await this.prisma.tokenPurchase.findUnique({ where: { checkoutRequestId } });
    if (!purchase || purchase.status !== TokenPurchaseStatus.pending) return;

    if (resultCode === 0) {
      const { balanceAfter } = await this.prisma.$transaction(async (tx) => {
        const credited = await this.credit(tx, {
          userId: purchase.userId,
          amount: purchase.tokens,
          type: TokenTransactionType.purchase,
          relatedEntityType: "token_purchase",
          relatedEntityId: purchase.id,
        });
        await tx.tokenPurchase.update({
          where: { id: purchase.id },
          data: { status: TokenPurchaseStatus.completed, completedAt: new Date(), resultCode, resultDesc, mpesaReceiptNumber },
        });
        return credited;
      });
      await this.events.emitAsync(EVENTS.TOKENS_PURCHASED, {
        userId: purchase.userId,
        tokens: purchase.tokens,
        amountKes: purchase.amountKes.toString(),
        purchaseId: purchase.id,
        balanceAfter,
      } satisfies TokensPurchasedEvent);
    } else {
      await this.prisma.tokenPurchase.update({
        where: { id: purchase.id },
        data: { status: TokenPurchaseStatus.failed, resultCode, resultDesc },
      });
    }
  }
}
