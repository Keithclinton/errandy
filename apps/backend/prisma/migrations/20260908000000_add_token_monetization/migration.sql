-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'bidder_token_required';
ALTER TYPE "NotificationType" ADD VALUE 'tokens_purchased';

-- CreateEnum
CREATE TYPE "TokenTransactionType" AS ENUM ('signup_grant', 'listing_post', 'bid_accept_deduction', 'purchase');

-- CreateEnum
CREATE TYPE "TokenPurchaseStatus" AS ENUM ('pending', 'completed', 'failed');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "tokenBalance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hasReceivedSignupTokens" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "token_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TokenTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "amountKes" DECIMAL(10,2) NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "TokenPurchaseStatus" NOT NULL DEFAULT 'pending',
    "checkoutRequestId" TEXT,
    "merchantRequestId" TEXT,
    "mpesaReceiptNumber" TEXT,
    "resultCode" INTEGER,
    "resultDesc" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "token_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "token_transactions_userId_createdAt_idx" ON "token_transactions"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "token_purchases_checkoutRequestId_key" ON "token_purchases"("checkoutRequestId");

-- CreateIndex
CREATE INDEX "token_purchases_userId_idx" ON "token_purchases"("userId");

-- AddForeignKey
ALTER TABLE "token_transactions" ADD CONSTRAINT "token_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_purchases" ADD CONSTRAINT "token_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
