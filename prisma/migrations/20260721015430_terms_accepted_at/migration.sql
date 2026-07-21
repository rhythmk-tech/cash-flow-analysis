-- Purely additive: one new nullable column, no existing data touched.
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
