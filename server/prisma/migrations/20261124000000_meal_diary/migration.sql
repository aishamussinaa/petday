CREATE TABLE "Meal" (
    "id" UUID NOT NULL,
    "petId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "time" VARCHAR(5) NOT NULL DEFAULT '',
    "title" VARCHAR(120) NOT NULL,
    "kind" VARCHAR(12) NOT NULL,
    "amount" DECIMAL(8,2),
    "unit" VARCHAR(4) NOT NULL,
    "notes" VARCHAR(2000) NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Meal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Meal_kind_check" CHECK ("kind" IN ('dry', 'wet', 'home', 'treat', 'other')),
    CONSTRAINT "Meal_unit_check" CHECK ("unit" IN ('g', 'ml', 'pcs')),
    CONSTRAINT "Meal_amount_check" CHECK ("amount" IS NULL OR ("amount" > 0 AND "amount" <= 100000))
);
CREATE INDEX "Meal_petId_day_idx" ON "Meal"("petId", "day");
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
