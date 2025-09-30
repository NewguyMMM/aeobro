-- Create enums for change history
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChangeEntity') THEN
    CREATE TYPE "ChangeEntity" AS ENUM ('PROFILE', 'FAQ', 'SERVICE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChangeAction') THEN
    CREATE TYPE "ChangeAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');
  END IF;
END$$;

-- FAQItem table
CREATE TABLE IF NOT EXISTS "FAQItem" (
  "id" TEXT PRIMARY KEY,
  "profileId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "isPublic" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- ServiceItem table
CREATE TABLE IF NOT EXISTS "ServiceItem" (
  "id" TEXT PRIMARY KEY,
  "profileId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "url" TEXT,
  "priceMin" NUMERIC(12,2),
  "priceMax" NUMERIC(12,2),
  "priceUnit" TEXT,
  "currency" TEXT,
  "isPublic" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- ChangeLog table
CREATE TABLE IF NOT EXISTS "ChangeLog" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "entity" "ChangeEntity" NOT NULL,
  "entityId" TEXT,
  "action" "ChangeAction" NOT NULL,
  "field" TEXT,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Foreign keys with cascading behavior
ALTER TABLE "FAQItem"
  ADD CONSTRAINT "FAQItem_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceItem"
  ADD CONSTRAINT "ServiceItem_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChangeLog"
  ADD CONSTRAINT "ChangeLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChangeLog"
  ADD CONSTRAINT "ChangeLog_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS "FAQItem_profileId_position_idx"
  ON "FAQItem" ("profileId", "position");

CREATE INDEX IF NOT EXISTS "ServiceItem_profileId_position_idx"
  ON "ServiceItem" ("profileId", "position");

CREATE INDEX IF NOT EXISTS "ChangeLog_profileId_createdAt_idx"
  ON "ChangeLog" ("profileId", "createdAt");

CREATE INDEX IF NOT EXISTS "ChangeLog_userId_createdAt_idx"
  ON "ChangeLog" ("userId", "createdAt");
