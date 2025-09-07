-- Create all new columns if they don't exist yet
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "legalName"      text,
  ADD COLUMN IF NOT EXISTS "entityType"     text,
  ADD COLUMN IF NOT EXISTS "serviceArea"    text[] DEFAULT '{}'::text[] NOT NULL,
  ADD COLUMN IF NOT EXISTS "foundedYear"    integer,
  ADD COLUMN IF NOT EXISTS "teamSize"       integer,
  ADD COLUMN IF NOT EXISTS "languages"      text[] DEFAULT '{}'::text[] NOT NULL,
  ADD COLUMN IF NOT EXISTS "pricingModel"   text,
  ADD COLUMN IF NOT EXISTS "hours"          text,
  ADD COLUMN IF NOT EXISTS "certifications" text,
  ADD COLUMN IF NOT EXISTS "press"          jsonb,
  ADD COLUMN IF NOT EXISTS "logoUrl"        text,
  ADD COLUMN IF NOT EXISTS "imageUrls"      text[] DEFAULT '{}'::text[] NOT NULL,
  ADD COLUMN IF NOT EXISTS "handles"        jsonb;

-- Your original schema had "links" as JSON NOT NULL.
-- Make it nullable to match the new API and schema.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Profile' AND column_name = 'links'
  ) THEN
    ALTER TABLE "Profile" ALTER COLUMN "links" DROP NOT NULL;
  END IF;
END $$;

-- Backfill NULLs on arrays just in case (safe even if none exist)
UPDATE "Profile" SET "serviceArea" = '{}' WHERE "serviceArea" IS NULL;
UPDATE "Profile" SET "languages"   = '{}' WHERE "languages"   IS NULL;
UPDATE "Profile" SET "imageUrls"   = '{}' WHERE "imageUrls"   IS NULL;

-- Ensure array defaults are set going forward (idempotent)
ALTER TABLE "Profile"
  ALTER COLUMN "serviceArea" SET DEFAULT '{}',
  ALTER COLUMN "languages"   SET DEFAULT '{}',
  ALTER COLUMN "imageUrls"   SET DEFAULT '{}';
