CREATE TABLE "WeightRecord" (
  "id" UUID NOT NULL,
  "petId" UUID NOT NULL,
  "date" DATE NOT NULL,
  "kg" DECIMAL(7,3) NOT NULL,
  "notes" VARCHAR(1000) NOT NULL DEFAULT '',
  "version" INTEGER NOT NULL DEFAULT 1,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WeightRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WeightRecord_kg_check" CHECK ("kg" > 0 AND "kg" <= 2000)
);
CREATE INDEX "WeightRecord_petId_date_idx" ON "WeightRecord"("petId", "date");
ALTER TABLE "WeightRecord" ADD CONSTRAINT "WeightRecord_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
