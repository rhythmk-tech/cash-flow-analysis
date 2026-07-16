-- Relaxing NOT NULL preserves every existing row's balance value exactly as-is; it only
-- permits future rows to omit it. The two new columns default to NULL for all existing rows.
ALTER TABLE "Actual" ALTER COLUMN "balance" DROP NOT NULL;
ALTER TABLE "Actual" ADD COLUMN "income" DOUBLE PRECISION;
ALTER TABLE "Actual" ADD COLUMN "expense" DOUBLE PRECISION;
