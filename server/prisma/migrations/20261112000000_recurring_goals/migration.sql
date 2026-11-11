-- AlterTable
ALTER TABLE "CareTask" ADD COLUMN     "completedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "routineId" UUID,
ADD COLUMN     "targetCount" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "CareEvent" ADD COLUMN     "completedCount" INTEGER,
ADD COLUMN     "targetCount" INTEGER;

-- CreateTable
CREATE TABLE "CareRoutine" (
    "id" UUID NOT NULL,
    "petId" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "category" VARCHAR(12) NOT NULL,
    "time" VARCHAR(5) NOT NULL DEFAULT '',
    "notes" VARCHAR(1000) NOT NULL DEFAULT '',
    "targetCount" INTEGER NOT NULL DEFAULT 1,
    "weekdays" INTEGER[],
    "startDay" DATE NOT NULL,
    "stopDay" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareRoutine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CareRoutine_petId_startDay_idx" ON "CareRoutine"("petId", "startDay");

-- CreateIndex
CREATE UNIQUE INDEX "CareTask_routineId_day_key" ON "CareTask"("routineId", "day");

-- AddForeignKey
ALTER TABLE "CareTask" ADD CONSTRAINT "CareTask_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "CareRoutine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareRoutine" ADD CONSTRAINT "CareRoutine_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve existing one-off completions when introducing numerical goals.
UPDATE "CareTask" SET "completedCount" = 1 WHERE "completedAt" IS NOT NULL;
ALTER TABLE "CareTask" ADD CONSTRAINT "CareTask_goal_bounds" CHECK ("targetCount" BETWEEN 1 AND 20 AND "completedCount" BETWEEN 0 AND "targetCount");
ALTER TABLE "CareRoutine" ADD CONSTRAINT "CareRoutine_goal_bounds" CHECK ("targetCount" BETWEEN 1 AND 20);

