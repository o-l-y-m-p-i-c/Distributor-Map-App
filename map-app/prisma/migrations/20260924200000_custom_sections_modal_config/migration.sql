-- AlterTable
ALTER TABLE "Location" ADD COLUMN "customValues" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Settings"
ADD COLUMN "customSections" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "modalConfig" JSONB NOT NULL DEFAULT '{}';
