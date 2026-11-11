import type { PrismaClient } from "@/generated/prisma/client";
import type { TeamInput } from "@/server/pandascore/map";
import { SOURCE } from "./lease";

/** Cache de ids internos por execução: o mesmo time aparece em vários registros. */
export type IdCache = Map<string, string>;

export async function upsertTeam(db: PrismaClient, team: TeamInput, cache: IdCache): Promise<string> {
  const key = `team:${team.externalId}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const data = {
    slug: team.slug,
    name: team.name,
    acronym: team.acronym,
    countryCode: team.countryCode,
    logoUrl: team.logoUrl,
  };
  const row = await db.team.upsert({
    where: { source_externalId: { source: SOURCE, externalId: team.externalId } },
    create: { source: SOURCE, externalId: team.externalId, ...data },
    update: data,
    select: { id: true },
  });
  cache.set(key, row.id);
  return row.id;
}

export async function teamIdByExternal(db: PrismaClient, externalId: string | null, cache: IdCache) {
  if (!externalId) return null;
  const cached = cache.get(`team:${externalId}`);
  if (cached) return cached;
  const row = await db.team.findUnique({
    where: { source_externalId: { source: SOURCE, externalId } },
    select: { id: true },
  });
  return row?.id ?? null;
}
