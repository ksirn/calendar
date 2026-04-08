-- CreateTable
CREATE TABLE "Todo" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "deadline" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'inbox',
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Todo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Todo_ownerUserId_idx" ON "Todo"("ownerUserId");
CREATE INDEX "Todo_creatorId_idx" ON "Todo"("creatorId");
