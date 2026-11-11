-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SyncResource" ADD VALUE 'TEAMS';
ALTER TYPE "SyncResource" ADD VALUE 'STANDINGS';

-- AlterTable
ALTER TABLE "player_team_stint" ADD COLUMN     "start_observed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "stage_standing" (
    "id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "rank" SMALLINT NOT NULL,
    "wins" SMALLINT,
    "losses" SMALLINT,
    "map_wins" SMALLINT,
    "map_losses" SMALLINT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stage_standing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stage_standing_team_id_idx" ON "stage_standing"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "stage_standing_stage_id_team_id_key" ON "stage_standing"("stage_id", "team_id");

-- AddForeignKey
ALTER TABLE "stage_standing" ADD CONSTRAINT "stage_standing_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_standing" ADD CONSTRAINT "stage_standing_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariantes mantidas à mão (o Prisma não descreve CHECKs).
ALTER TABLE "stage_standing"
  ADD CONSTRAINT "stage_standing_rank_check" CHECK ("rank" >= 1),
  ADD CONSTRAINT "stage_standing_counts_check" CHECK (
    COALESCE("wins", 0) >= 0 AND COALESCE("losses", 0) >= 0
    AND COALESCE("map_wins", 0) >= 0 AND COALESCE("map_losses", 0) >= 0
  );
