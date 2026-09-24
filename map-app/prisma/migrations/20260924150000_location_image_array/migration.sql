-- AlterTable
ALTER TABLE "Location" ADD COLUMN "imageUrls" TEXT[] NOT NULL DEFAULT '{}';

-- Data migration
UPDATE "Location" SET "imageUrls" = ARRAY["imageUrl"] WHERE "imageUrl" IS NOT NULL;

-- AlterTable
ALTER TABLE "Location" DROP COLUMN "imageUrl";
