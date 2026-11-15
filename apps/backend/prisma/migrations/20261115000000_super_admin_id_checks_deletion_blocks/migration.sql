-- CreateEnum
CREATE TYPE "IdDocumentType" AS ENUM ('national_id', 'passport', 'alien_id');

-- CreateEnum
CREATE TYPE "IdImageKind" AS ENUM ('front', 'back', 'selfie');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'id_verification_submitted';
ALTER TYPE "NotificationType" ADD VALUE 'id_verification_reviewed';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "idVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "id_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentType" "IdDocumentType" NOT NULL,
    "fullName" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "id_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "id_verification_images" (
    "id" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "kind" "IdImageKind" NOT NULL,
    "contentType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "id_verification_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_deletion_blocks" (
    "identifierHash" TEXT NOT NULL,
    "blockedUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_deletion_blocks_pkey" PRIMARY KEY ("identifierHash")
);

-- CreateIndex
CREATE INDEX "id_verifications_userId_idx" ON "id_verifications"("userId");

-- CreateIndex
CREATE INDEX "id_verifications_status_createdAt_idx" ON "id_verifications"("status", "createdAt");

-- CreateIndex
CREATE INDEX "id_verifications_idNumber_idx" ON "id_verifications"("idNumber");

-- CreateIndex
CREATE UNIQUE INDEX "id_verification_images_verificationId_kind_key" ON "id_verification_images"("verificationId", "kind");

-- CreateIndex
CREATE INDEX "account_deletion_blocks_blockedUntil_idx" ON "account_deletion_blocks"("blockedUntil");

-- AddForeignKey
ALTER TABLE "id_verifications" ADD CONSTRAINT "id_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "id_verifications" ADD CONSTRAINT "id_verifications_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "id_verification_images" ADD CONSTRAINT "id_verification_images_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "id_verifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

