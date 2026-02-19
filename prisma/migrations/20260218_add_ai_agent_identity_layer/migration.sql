-- DropForeignKey
ALTER TABLE "public"."SupportTicket" DROP CONSTRAINT "SupportTicket_userId_fkey";

-- DropIndex
DROP INDEX "public"."Profile_deletedAt_idx";

-- DropIndex
DROP INDEX "public"."Profile_retentionUntil_idx";

-- DropIndex
DROP INDEX "public"."Profile_visibility_idx";

-- AlterTable
ALTER TABLE "public"."Profile" DROP COLUMN "deletedAt",
DROP COLUMN "deletionJobLockedAt",
DROP COLUMN "faqJson",
DROP COLUMN "productsJson",
DROP COLUMN "retentionUntil",
DROP COLUMN "servicesJson",
DROP COLUMN "unpublishReason",
DROP COLUMN "unpublishedAt",
DROP COLUMN "visibility";

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "subscriptionLapsedAt",
DROP COLUMN "subscriptionReactivatedAt",
ALTER COLUMN "plan" SET DEFAULT 'FREE';

-- DropTable
DROP TABLE "public"."SupportTicket";

-- DropEnum
DROP TYPE "public"."ProfileVisibility";

-- DropEnum
DROP TYPE "public"."SupportCategory";

-- DropEnum
DROP TYPE "public"."SupportStatus";

-- DropEnum
DROP TYPE "public"."UnpublishReason";

