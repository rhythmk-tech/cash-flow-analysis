-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'editor';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'editor';
