-- Bring "Profile" up to date with prisma/schema.prisma
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "slug"           TEXT,
  ADD COLUMN IF NOT EXISTS "displayName"    TEXT,
  ADD COLUMN IF NOT EXISTS "legalName"      TEXT,
  ADD COLUMN IF NOT EXISTS "entityType"     TEXT,
  ADD COLUMN IF NOT EXISTS "tagline"        TEXT,
  ADD COLUMN IF NOT EXISTS "bio"            TEXT,
  ADD COLUMN IF NOT EXISTS "website"        TEXT,
  ADD COLUMN IF NOT EXISTS "location"       TEXT,
  ADD COLUMN IF NOT EXISTS "serviceArea"    TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "foundedYear"    INTEGER,
  ADD COLUMN IF NOT EXISTS "teamSize"       INTEGER,
  ADD COLUMN IF NOT EXISTS "languages"      TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "pricingModel"   TEXT,
  ADD COLUMN IF NOT EXISTS "hours"          TEXT,
  ADD COLUMN IF NOT EXISTS "certifications" TEXT,
  ADD COLUMN IF NOT EXISTS "press"          JSONB,
  ADD COLUMN IF NOT EXISTS "logoUrl"        TEXT,
  ADD COLUMN IF NOT EXISTS "imageUrls"      TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "handles"        JSONB,
  ADD COLUMN IF NOT EXISTS "links"          JSONB,
  ADD COLUMN IF NOT EXISTS "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Unique index for the public URL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='Profile_slug_key'
  ) THEN
    CREATE UNIQUE INDEX "Profile_slug_key" ON "Profile" ("slug");
  END IF;
END $$;
