-- Bring the Profile table up to date with schema.prisma
-- Only touch "Profile" here. No references to DomainClaim/PlatformAccount/BioCode.

-- 1) Add columns if they don't exist
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "slug"          TEXT,
  ADD COLUMN IF NOT EXISTS "displayName"   TEXT,
  ADD COLUMN IF NOT EXISTS "legalName"     TEXT,
  ADD COLUMN IF NOT EXISTS "entityType"    TEXT,
  ADD COLUMN IF NOT EXISTS "tagline"       TEXT,
  ADD COLUMN IF NOT EXISTS "bio"           TEXT,
  ADD COLUMN IF NOT EXISTS "website"       TEXT,
  ADD COLUMN IF NOT EXISTS "location"      TEXT,
  ADD COLUMN IF NOT EXISTS "serviceArea"   TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "foundedYear"   INTEGER,
  ADD COLUMN IF NOT EXISTS "teamSize"      INTEGER,
  ADD COLUMN IF NOT EXISTS "languages"     TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "pricingModel"  TEXT,
  ADD COLUMN IF NOT EXISTS "hours"         TEXT,
  ADD COLUMN IF NOT EXISTS "certifications" TEXT,
  ADD COLUMN IF NOT EXISTS "press"         JSONB,
  ADD COLUMN IF NOT EXISTS "logoUrl"       TEXT,
  ADD COLUMN IF NOT EXISTS "imageUrls"     TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "handles"       JSONB,
  ADD COLUMN IF NOT EXISTS "links"         JSONB,
  ADD COLUMN IF NOT EXISTS "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2) Backfill slug for existing rows if null/empty
UPDATE "Profile"
SET "slug" = CASE
  WHEN COALESCE(NULLIF("slug", ''), '') <> '' THEN "slug"
  WHEN COALESCE(NULLIF("displayName", ''), '') <> '' THEN
    LOWER(REGEXP_REPLACE("displayName", '[^a-zA-Z0-9]+','-','g'))
  WHEN COALESCE(NULLIF("legalName", ''), '') <> '' THEN
    LOWER(REGEXP_REPLACE("legalName", '[^a-zA-Z0-9]+','-','g'))
  ELSE 'user-' || SUBSTR("id", 1, 8)
END
WHERE COALESCE(NULLIF("slug", ''), '') = '';

-- 3) Ensure slug uniqueness by appending -1, -2, ... if needed
DO $$
DECLARE
  r RECORD;
  base TEXT;
  candidate TEXT;
  i INT;
BEGIN
  FOR r IN SELECT "id", "slug" FROM "Profile" WHERE "slug" IS NOT NULL LOOP
    base := r."slug";
    candidate := base;
    i := 1;
    WHILE EXISTS (SELECT 1 FROM "Profile" p WHERE p."slug" = candidate AND p."id" <> r."id") LOOP
      candidate := base || '-' || i::TEXT;
      i := i + 1;
    END LOOP;
    IF candidate <> r."slug" THEN
      UPDATE "Profile" SET "slug" = candidate WHERE "id" = r."id";
    END IF;
  END LOOP;
END $$;

-- 4) Unique constraint for slug
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Profile_slug_key'
  ) THEN
    CREATE UNIQUE INDEX "Profile_slug_key" ON "Profile"("slug");
  END IF;
END $$;

-- 5) Make slug NOT NULL (safe now that it's backfilled & unique)
ALTER TABLE "Profile"
  ALTER COLUMN "slug" SET NOT NULL;

-- 6) updatedAt trigger (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'profile_set_updated_at'
  ) THEN
    CREATE FUNCTION public.profile_set_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      NEW."updatedAt" = NOW();
      RETURN NEW;
    END
    $fn$;
  END IF;
END $$;

DROP TRIGGER IF EXISTS profile_set_updated_at ON "Profile";
CREATE TRIGGER profile_set_updated_at
BEFORE UPDATE ON "Profile"
FOR EACH ROW EXECUTE FUNCTION public.profile_set_updated_at();
