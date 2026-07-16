-- Purely additive: one new column, defaulted to false, so no existing account gains
-- platform-admin access and no existing data is touched.
ALTER TABLE "User" ADD COLUMN "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;
