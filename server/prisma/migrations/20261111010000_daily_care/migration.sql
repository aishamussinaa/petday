-- CreateTable
CREATE TABLE "CareTask" (
    "id" UUID NOT NULL,
    "petId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "category" VARCHAR(12) NOT NULL,
    "time" VARCHAR(5) NOT NULL DEFAULT '',
    "notes" VARCHAR(1000) NOT NULL DEFAULT '',
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareEvent" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "action" VARCHAR(16) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CareTask_petId_day_idx" ON "CareTask"("petId", "day");

-- CreateIndex
CREATE INDEX "CareEvent_createdAt_idx" ON "CareEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CareEvent_taskId_version_key" ON "CareEvent"("taskId", "version");

-- AddForeignKey
ALTER TABLE "CareTask" ADD CONSTRAINT "CareTask_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareEvent" ADD CONSTRAINT "CareEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CareTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
