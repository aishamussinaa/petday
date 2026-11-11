CREATE TABLE "HealthRecord" (
    "id" UUID NOT NULL,
    "petId" UUID NOT NULL,
    "kind" VARCHAR(12) NOT NULL,
    "status" VARCHAR(12) NOT NULL DEFAULT 'planned',
    "title" VARCHAR(120) NOT NULL,
    "date" DATE NOT NULL,
    "nextDate" DATE,
    "clinic" VARCHAR(160) NOT NULL DEFAULT '',
    "vet" VARCHAR(120) NOT NULL DEFAULT '',
    "notes" VARCHAR(4000) NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HealthRecord_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HealthRecord_kind_check" CHECK ("kind" IN ('vaccine', 'visit')),
    CONSTRAINT "HealthRecord_status_check" CHECK ("status" IN ('planned', 'completed')),
    CONSTRAINT "HealthRecord_nextDate_check" CHECK ("nextDate" IS NULL OR "nextDate" > "date")
);
CREATE INDEX "HealthRecord_petId_date_idx" ON "HealthRecord"("petId", "date");
ALTER TABLE "HealthRecord" ADD CONSTRAINT "HealthRecord_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
