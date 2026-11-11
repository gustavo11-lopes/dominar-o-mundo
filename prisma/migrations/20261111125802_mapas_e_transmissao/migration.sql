-- AlterEnum
ALTER TYPE "SyncResource" ADD VALUE 'MAPS';

-- AlterTable
ALTER TABLE "match" ADD COLUMN     "stream_embed_url" TEXT;

-- CreateTable
CREATE TABLE "game_map" (
    "id" UUID NOT NULL,
    "source" "DataSource" NOT NULL,
    "external_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "game_map_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_map_slug_key" ON "game_map"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "game_map_source_external_id_key" ON "game_map"("source", "external_id");
