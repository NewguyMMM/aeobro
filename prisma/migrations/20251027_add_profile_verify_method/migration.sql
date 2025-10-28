-- Create missing column expected by Prisma Client
-- Safe default so existing rows are valid
ALTER TABLE "Profile"
ADD COLUMN IF NOT EXISTS "verifyMethod" TEXT NOT NULL DEFAULT 'NONE';
