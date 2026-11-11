import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { DATA_TAG } from "./tags";

/** Artes de mapa disponíveis para usar como cenário. */
export async function getBackdrops(): Promise<string[]> {
  "use cache";
  cacheTag(DATA_TAG);
  cacheLife("days");

  const maps = await db.gameMap.findMany({
    where: { imageUrl: { not: null } },
    orderBy: { name: "asc" },
    select: { imageUrl: true },
  });
  return maps.flatMap((m) => (m.imageUrl ? [m.imageUrl] : []));
}

/** Escolhe sempre o mesmo cenário para a mesma chave (time, partida), para a página não mudar a cada visita. */
export function pickBackdrop(key: string, backdrops: string[]): string | null {
  if (!backdrops.length) return null;
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return backdrops[h % backdrops.length];
}
