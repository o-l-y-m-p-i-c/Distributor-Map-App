-- Keep the legacy single-value contact columns so a backend version deployed
-- before the contact-array migration continues to work. The array columns are
-- the source of truth going forward.
ALTER TABLE "Location"
ADD COLUMN "phone" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "website" TEXT;
