-- Purely additive: two new columns, both defaulted to an empty array, so every
-- existing row gets a valid value automatically and no existing data is touched.
ALTER TABLE "User" ADD COLUMN "incomeRowOrder" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "User" ADD COLUMN "expenseRowOrder" TEXT[] NOT NULL DEFAULT '{}';
