-- AlterTable
ALTER TABLE "LineItem" ADD COLUMN     "quickBooksTxnId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LineItem_userId_quickBooksTxnId_key" ON "LineItem"("userId", "quickBooksTxnId");
