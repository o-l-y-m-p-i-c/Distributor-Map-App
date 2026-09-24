-- AlterTable
ALTER TABLE "Location"
ADD COLUMN "phones" TEXT[] NOT NULL DEFAULT '{}',
ADD COLUMN "emails" TEXT[] NOT NULL DEFAULT '{}',
ADD COLUMN "websites" TEXT[] NOT NULL DEFAULT '{}';

-- Data migration
UPDATE "Location" SET "phones" = ARRAY["phone"] WHERE "phone" IS NOT NULL;
UPDATE "Location" SET "emails" = ARRAY["email"] WHERE "email" IS NOT NULL;
UPDATE "Location" SET "websites" = ARRAY["website"] WHERE "website" IS NOT NULL;

-- AlterTable
ALTER TABLE "Location" DROP COLUMN "phone", DROP COLUMN "email", DROP COLUMN "website";
