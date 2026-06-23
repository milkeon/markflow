-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_canvases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "canvases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_canvases" ("data", "id", "project_id", "updated_at") SELECT "data", "id", "project_id", "updated_at" FROM "canvases";
DROP TABLE "canvases";
ALTER TABLE "new_canvases" RENAME TO "canvases";
CREATE UNIQUE INDEX "canvases_project_id_key" ON "canvases"("project_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
