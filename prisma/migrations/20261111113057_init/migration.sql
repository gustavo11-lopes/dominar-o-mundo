-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('PANDASCORE');

-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('S', 'A', 'B', 'C', 'D', 'UNRANKED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED', 'CANCELED', 'POSTPONED');

-- CreateEnum
CREATE TYPE "MapStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED', 'NOT_PLAYED');

-- CreateEnum
CREATE TYPE "SyncResource" AS ENUM ('MATCHES');

-- CreateTable
CREATE TABLE "region" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" UUID NOT NULL,
    "source" "DataSource" NOT NULL,
    "external_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "acronym" TEXT,
    "country_code" CHAR(2),
    "logo_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player" (
    "id" UUID NOT NULL,
    "source" "DataSource" NOT NULL,
    "external_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "country_code" CHAR(2),
    "image_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_team_stint" (
    "id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "ended_at" TIMESTAMPTZ(3),

    CONSTRAINT "player_team_stint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league" (
    "id" UUID NOT NULL,
    "source" "DataSource" NOT NULL,
    "external_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "league_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament" (
    "id" UUID NOT NULL,
    "source" "DataSource" NOT NULL,
    "external_id" TEXT NOT NULL,
    "league_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "begin_at" TIMESTAMPTZ(3),
    "end_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage" (
    "id" UUID NOT NULL,
    "source" "DataSource" NOT NULL,
    "external_id" TEXT NOT NULL,
    "tournament_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" "Tier" NOT NULL DEFAULT 'UNRANKED',
    "begin_at" TIMESTAMPTZ(3),
    "end_at" TIMESTAMPTZ(3),
    "prize_pool" TEXT,
    "region_id" UUID,
    "winner_team_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match" (
    "id" UUID NOT NULL,
    "source" "DataSource" NOT NULL,
    "external_id" TEXT NOT NULL,
    "stage_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_at" TIMESTAMPTZ(3),
    "begin_at" TIMESTAMPTZ(3),
    "end_at" TIMESTAMPTZ(3),
    "best_of" SMALLINT NOT NULL,
    "team_a_id" UUID,
    "team_b_id" UUID,
    "score_a" SMALLINT NOT NULL DEFAULT 0,
    "score_b" SMALLINT NOT NULL DEFAULT 0,
    "winner_team_id" UUID,
    "forfeit" BOOLEAN NOT NULL DEFAULT false,
    "stream_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_map" (
    "id" UUID NOT NULL,
    "source" "DataSource" NOT NULL,
    "external_id" TEXT NOT NULL,
    "match_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "status" "MapStatus" NOT NULL DEFAULT 'SCHEDULED',
    "winner_team_id" UUID,
    "begin_at" TIMESTAMPTZ(3),
    "end_at" TIMESTAMPTZ(3),

    CONSTRAINT "match_map_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_state" (
    "id" UUID NOT NULL,
    "source" "DataSource" NOT NULL,
    "resource" "SyncResource" NOT NULL,
    "last_started_at" TIMESTAMPTZ(3),
    "last_finished_at" TIMESTAMPTZ(3),
    "last_success_at" TIMESTAMPTZ(3),
    "last_error" TEXT,

    CONSTRAINT "sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "region_code_key" ON "region"("code");

-- CreateIndex
CREATE UNIQUE INDEX "team_slug_key" ON "team"("slug");

-- CreateIndex
CREATE INDEX "team_name_idx" ON "team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "team_source_external_id_key" ON "team"("source", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_slug_key" ON "player"("slug");

-- CreateIndex
CREATE INDEX "player_handle_idx" ON "player"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "player_source_external_id_key" ON "player"("source", "external_id");

-- CreateIndex
CREATE INDEX "player_team_stint_player_id_idx" ON "player_team_stint"("player_id");

-- CreateIndex
CREATE INDEX "player_team_stint_team_id_ended_at_idx" ON "player_team_stint"("team_id", "ended_at");

-- CreateIndex
CREATE UNIQUE INDEX "league_slug_key" ON "league"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "league_source_external_id_key" ON "league"("source", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_slug_key" ON "tournament"("slug");

-- CreateIndex
CREATE INDEX "tournament_league_id_begin_at_idx" ON "tournament"("league_id", "begin_at");

-- CreateIndex
CREATE INDEX "tournament_begin_at_idx" ON "tournament"("begin_at");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_source_external_id_key" ON "tournament"("source", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "stage_slug_key" ON "stage"("slug");

-- CreateIndex
CREATE INDEX "stage_tournament_id_begin_at_idx" ON "stage"("tournament_id", "begin_at");

-- CreateIndex
CREATE INDEX "stage_winner_team_id_idx" ON "stage"("winner_team_id");

-- CreateIndex
CREATE INDEX "stage_region_id_idx" ON "stage"("region_id");

-- CreateIndex
CREATE UNIQUE INDEX "stage_source_external_id_key" ON "stage"("source", "external_id");

-- CreateIndex
CREATE INDEX "match_status_scheduled_at_idx" ON "match"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "match_stage_id_scheduled_at_idx" ON "match"("stage_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "match_team_a_id_scheduled_at_idx" ON "match"("team_a_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "match_team_b_id_scheduled_at_idx" ON "match"("team_b_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "match_winner_team_id_idx" ON "match"("winner_team_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_source_external_id_key" ON "match"("source", "external_id");

-- CreateIndex
CREATE INDEX "match_map_winner_team_id_idx" ON "match_map"("winner_team_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_map_source_external_id_key" ON "match_map"("source", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_map_match_id_position_key" ON "match_map"("match_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "sync_state_source_resource_key" ON "sync_state"("source", "resource");

-- AddForeignKey
ALTER TABLE "player_team_stint" ADD CONSTRAINT "player_team_stint_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_team_stint" ADD CONSTRAINT "player_team_stint_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "league"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage" ADD CONSTRAINT "stage_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage" ADD CONSTRAINT "stage_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage" ADD CONSTRAINT "stage_winner_team_id_fkey" FOREIGN KEY ("winner_team_id") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_team_a_id_fkey" FOREIGN KEY ("team_a_id") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_team_b_id_fkey" FOREIGN KEY ("team_b_id") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_winner_team_id_fkey" FOREIGN KEY ("winner_team_id") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_map" ADD CONSTRAINT "match_map_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_map" ADD CONSTRAINT "match_map_winner_team_id_fkey" FOREIGN KEY ("winner_team_id") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Invariantes que o schema do Prisma não descreve. Mantidas à mão.
-- ---------------------------------------------------------------------------

-- Um jogador tem no máximo uma passagem em andamento.
CREATE UNIQUE INDEX "player_team_stint_one_open_per_player"
  ON "player_team_stint" ("player_id") WHERE "ended_at" IS NULL;

ALTER TABLE "player_team_stint"
  ADD CONSTRAINT "player_team_stint_period_check" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at");

ALTER TABLE "team"
  ADD CONSTRAINT "team_country_code_check" CHECK ("country_code" IS NULL OR "country_code" ~ '^[A-Z]{2}$');

ALTER TABLE "player"
  ADD CONSTRAINT "player_country_code_check" CHECK ("country_code" IS NULL OR "country_code" ~ '^[A-Z]{2}$');

ALTER TABLE "match"
  ADD CONSTRAINT "match_best_of_check" CHECK ("best_of" >= 1),
  ADD CONSTRAINT "match_score_check" CHECK ("score_a" >= 0 AND "score_b" >= 0),
  ADD CONSTRAINT "match_distinct_teams_check" CHECK ("team_a_id" IS NULL OR "team_b_id" IS NULL OR "team_a_id" <> "team_b_id"),
  ADD CONSTRAINT "match_winner_is_participant_check" CHECK (
    "winner_team_id" IS NULL
    OR ("winner_team_id" = "team_a_id") IS TRUE
    OR ("winner_team_id" = "team_b_id") IS TRUE
  );

ALTER TABLE "match_map"
  ADD CONSTRAINT "match_map_position_check" CHECK ("position" >= 1);
