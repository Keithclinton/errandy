-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "portfolioUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
