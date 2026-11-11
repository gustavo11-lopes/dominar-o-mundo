import type { PrismaClient } from "@/generated/prisma/client";
import { fetchList } from "@/server/pandascore/client";
import { psGameMapSchema } from "@/server/pandascore/schemas";
import { dedupeById, eachRecord, runWithLease, SOURCE, type SyncReport } from "./lease";

export type MapFetcher = () => Promise<unknown[]>;

export const pandaScoreMapFetcher =
  (token: string): MapFetcher =>
  () =>
    fetchList("/valorant/maps", {}, token);

/** Catálogo de mapas do jogo (poucas linhas, uma requisição). */
export function syncMaps(db: PrismaClient, fetchMaps: MapFetcher, now: Date = new Date()): Promise<SyncReport> {
  return runWithLease(db, "MAPS", now, async () =>
    eachRecord(dedupeById(await fetchMaps()), async (item) => {
      const m = psGameMapSchema.parse(item);
      const data = { slug: m.slug, name: m.name, imageUrl: m.image_url };
      await db.gameMap.upsert({
        where: { source_externalId: { source: SOURCE, externalId: String(m.id) } },
        create: { source: SOURCE, externalId: String(m.id), ...data },
        update: data,
      });
    }),
  );
}
