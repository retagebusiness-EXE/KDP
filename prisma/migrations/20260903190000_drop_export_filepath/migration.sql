-- Exported files are no longer persisted anywhere (rendered PDFs stream
-- straight to the requesting HTTP response). The Export table now only
-- tracks usage metadata for plan quotas and admin stats.
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Export" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL DEFAULT 0,
    "validationReport" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Export_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Export" ("id", "projectId", "type", "fileSizeBytes", "validationReport", "createdAt")
SELECT "id", "projectId", "type", "fileSizeBytes", "validationReport", "createdAt" FROM "Export";
DROP TABLE "Export";
ALTER TABLE "new_Export" RENAME TO "Export";
CREATE INDEX "Export_projectId_idx" ON "Export"("projectId");

PRAGMA foreign_keys=ON;
