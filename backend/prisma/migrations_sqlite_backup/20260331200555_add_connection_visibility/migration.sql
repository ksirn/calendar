-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Connection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "visibilityForA" TEXT NOT NULL DEFAULT 'full',
    "visibilityForB" TEXT NOT NULL DEFAULT 'full',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME
);
INSERT INTO "new_Connection" ("createdAt", "id", "requestedByUserId", "respondedAt", "status", "userAId", "userBId") SELECT "createdAt", "id", "requestedByUserId", "respondedAt", "status", "userAId", "userBId" FROM "Connection";
DROP TABLE "Connection";
ALTER TABLE "new_Connection" RENAME TO "Connection";
CREATE UNIQUE INDEX "Connection_userAId_userBId_key" ON "Connection"("userAId", "userBId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
