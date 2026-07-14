-- Replace LineItem.startWeek (an int relative to the account's forecastStart at read time,
-- which silently reinterpreted every item's calendar date whenever forecastStart changed)
-- with an absolute startDate. Existing rows are backfilled using each owning account's
-- CURRENT forecastStart, since no historical forecastStart values are recoverable — this is
-- exact for anyone who hasn't moved their forecast's start date yet, and stops the drift
-- going forward for everyone.

-- AlterTable: add startDate as nullable first so existing rows don't error out
ALTER TABLE "LineItem" ADD COLUMN "startDate" TIMESTAMP(3);

-- Backfill: startDate = owning account's forecastStart + (startWeek - 1) weeks
UPDATE "LineItem" li
SET "startDate" = u."forecastStart" + ((li."startWeek" - 1) * 7) * INTERVAL '1 day'
FROM "User" u
WHERE li."userId" = u."id";

-- Make required now that every row has a value
ALTER TABLE "LineItem" ALTER COLUMN "startDate" SET NOT NULL;

-- Drop the old relative-week column
ALTER TABLE "LineItem" DROP COLUMN "startWeek";
