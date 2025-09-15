-- Bring the Profile table up to date with schema.prisma

-- Add columns if they don't exist
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "displayName" TEXT,
  ADD COLUMN IF NOT EXISTS "legalName" TEXT,
  ADD COLUMN IF NOT EXISTS "entityType" TEXT,
  ADD COLUMN IF NOT EXISTS "tagline" TEXT,
  ADD COLUMN IF NOT EXISTS "bio" TEXT,
  ADD COLUMN IF NOT EXISTS "website" TEXT,
  ADD COLUMN IF NOT EXISTS "location" TEXT,
  ADD COLUMN IF NOT EXISTS "serviceArea" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "foundedYear" INTEGER,
  ADD COLUMN IF NOT EXISTS "teamSize" INTEGER,
  ADD COLUMN IF NOT EXISTS "languages" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "pricingModel" TEXT,
  ADD COLUMN IF NOT EXISTS "hours" TEXT,
  ADD COLUMN IF NOT EXISTS "certifications" TEXT,
  ADD COLUMN IF NOT EXISTS "press" JSONB,
  ADD COLUMN IF NOT EXISTS "logoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "imageUrls" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "handles" JSONB,
  ADD COLUMN IF NOT EXISTS "links" JSONB,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill slug for any existing rows
UPDATE "Profile"
SET "slug" = COALESCE(
  NULLIF(
    regexp_replace(
      lower(
        COALESCE(
          NULLIF("displayName", ''),
          NULLIF("legalName", ''),
          'user'
        )
      ),
      '[^a-z0-9]+', '-', 'g'
    ),
    ''
  ),
  'user'
)
WHERE "slug" IS NULL OR "slug" = '';

-- Ensure unique slugs by suffixing duplicates
WITH d AS (
  SELECT "slug", array_agg(id ORDER BY id) ids
  FROM "Profile"
  WHERE "slug" IS NOT NULL
  GROUP BY "slug"
  HAVING count(*) > 1
)
UPDATE "Profile" p
SET "slug" = p.slug || '-' || substr(md5(p.id::text),1,4)
FROM d
WHERE p.slug = d.slug AND p.id <> d.ids[1];

-- Make slug not null & enforce uniqueness (Prisma expects this exact index name)
ALTER TABLE "Profile" ALTER COLUMN "slug" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'Profile_slug_key' AND n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX "Profile_slug_key" ON "Profile"("slug");
  END IF;
END $$;

-- Keep updatedAt fresh
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'profile_set_updated_at'
  ) THEN
    CREATE TRIGGER profile_set_updated_at
    BEFORE UPDATE ON "Profile"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Make the verification tables tolerant if they already exist but miss newer columns
ALTER TABLE "DomainClaim"
  ADD COLUMN IF NOT EXISTS "emailIssued" TEXT,
  ADD COLUMN IF NOT EXISTS "emailToken" TEXT,
  ADD COLUMN IF NOT EXISTS "dnsVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMPTZ;

ALTER TABLE "PlatformAccount"
  ADD COLUMN IF NOT EXISTS "handle" TEXT,
  ADD COLUMN IF NOT EXISTS "url" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMPTZ;

ALTER TABLE "BioCode"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMPTZ;
