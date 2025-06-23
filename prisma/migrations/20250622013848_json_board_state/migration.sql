/*
  Warnings:

  - You are about to alter the column `boardState` on the `Game` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "whitePlayerId" TEXT NOT NULL,
    "blackPlayerId" TEXT NOT NULL,
    "boardState" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "winner" TEXT,
    CONSTRAINT "Game_whitePlayerId_fkey" FOREIGN KEY ("whitePlayerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Game_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Game" ("blackPlayerId", "boardState", "createdAt", "id", "status", "updatedAt", "whitePlayerId", "winner") SELECT "blackPlayerId", "boardState", "createdAt", "id", "status", "updatedAt", "whitePlayerId", "winner" FROM "Game";
DROP TABLE "Game";
ALTER TABLE "new_Game" RENAME TO "Game";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
