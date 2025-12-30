-- CreateEnum
CREATE TYPE "Source" AS ENUM ('votehub', 'civicapi', 'fivethirtyeight');

-- CreateTable
CREATE TABLE "Poll" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source" "Source" NOT NULL,
    "sourcePollId" TEXT NOT NULL,
    "pollType" TEXT NOT NULL,
    "subject" TEXT,
    "jurisdiction" TEXT,
    "office" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "sampleSize" INTEGER,
    "population" TEXT,
    "pollster" TEXT,
    "sponsor" TEXT,
    "methodology" TEXT,
    "url" TEXT,
    "internal" BOOLEAN,
    "partisan" BOOLEAN,
    "hypothetical" BOOLEAN,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollAnswer" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pollId" UUID NOT NULL,
    "choice" TEXT NOT NULL,
    "party" TEXT,
    "percent" DOUBLE PRECISION,

    CONSTRAINT "PollAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollRun" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source" "Source" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "stats" JSONB,
    "error" TEXT,

    CONSTRAINT "PollRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Poll_source_sourcePollId_key" ON "Poll"("source", "sourcePollId");

-- CreateIndex
CREATE INDEX "Poll_pollType_endDate_idx" ON "Poll"("pollType", "endDate");

-- CreateIndex
CREATE INDEX "Poll_subject_idx" ON "Poll"("subject");

-- CreateIndex
CREATE INDEX "Poll_pollster_idx" ON "Poll"("pollster");

-- CreateIndex
CREATE INDEX "PollAnswer_pollId_idx" ON "PollAnswer"("pollId");

-- CreateIndex
CREATE INDEX "PollRun_source_startedAt_idx" ON "PollRun"("source", "startedAt");

-- AddForeignKey
ALTER TABLE "PollAnswer" ADD CONSTRAINT "PollAnswer_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create trigger to keep updatedAt fresh (Prisma normally manages this, but migrations should enforce it too)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Poll_set_updatedAt" ON "Poll";
CREATE TRIGGER "Poll_set_updatedAt"
BEFORE UPDATE ON "Poll"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
