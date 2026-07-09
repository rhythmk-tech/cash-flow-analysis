-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startingBalance" REAL NOT NULL DEFAULT 0,
    "totalWeeks" INTEGER NOT NULL DEFAULT 12,
    "bearPct" REAL NOT NULL DEFAULT -10,
    "bullPct" REAL NOT NULL DEFAULT 10
);

-- CreateTable
CREATE TABLE "LineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "frequency" TEXT NOT NULL,
    "startWeek" INTEGER NOT NULL,
    "lineLabel" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LineItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Override" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "value" REAL NOT NULL,
    CONSTRAINT "Override_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "LineItem_userId_idx" ON "LineItem"("userId");

-- CreateIndex
CREATE INDEX "Override_userId_idx" ON "Override"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Override_userId_type_label_week_key" ON "Override"("userId", "type", "label", "week");
