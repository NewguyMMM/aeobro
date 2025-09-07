-- Set default empty arrays on new columns
ALTER TABLE "Profile"
  ALTER COLUMN "serviceArea" SET DEFAULT '{}',
  ALTER COLUMN "languages"  SET DEFAULT '{}',
  ALTER COLUMN "imageUrls"  SET DEFAULT '{}';

-- Backfill existing NULLs to empty arrays
UPDATE "Profile" SET "serviceArea" = '{}' WHERE "serviceArea" IS NULL;
UPDATE "Profile" SET "languages"  = '{}' WHERE "languages"  IS NULL;
UPDATE "Profile" SET "imageUrls"  = '{}' WHERE "imageUrls"  IS NULL;

-- Ensure arrays are NOT NULL going forward (optional but recommended)
ALTER TABLE "Profile"
  ALTER COLUMN "serviceArea" SET NOT NULL,
  ALTER COLUMN "languages"  SET NOT NULL,
  ALTER COLUMN "imageUrls"  SET NOT NULL;
