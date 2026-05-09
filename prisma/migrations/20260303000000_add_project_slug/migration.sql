-- Step 1: Add nullable slug column
ALTER TABLE "projects" ADD COLUMN "slug" TEXT;

-- Step 2: Backfill existing projects with slug derived from name
-- Converts to lowercase, replaces non-alphanumeric with hyphens, trims
UPDATE "projects"
SET "slug" = LOWER(
  TRIM(BOTH '-' FROM
    REGEXP_REPLACE(
      REGEXP_REPLACE(LOWER("name"), '[^a-z0-9]+', '-', 'g'),
      '-+', '-', 'g'
    )
  )
);

-- Handle empty slugs (projects with names that are all special chars)
UPDATE "projects" SET "slug" = 'project' WHERE "slug" = '' OR "slug" IS NULL;

-- Step 3: Deduplicate slugs by appending row number for collisions
WITH duplicates AS (
  SELECT id, "slug",
    ROW_NUMBER() OVER (PARTITION BY "slug" ORDER BY "created_at") AS rn
  FROM "projects"
)
UPDATE "projects" p
SET "slug" = d."slug" || '-' || d.rn
FROM duplicates d
WHERE p.id = d.id AND d.rn > 1;

-- Step 4: Make non-null and add unique index
ALTER TABLE "projects" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");
