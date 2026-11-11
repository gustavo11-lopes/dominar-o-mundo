import type { PrismaClient } from "@/generated/prisma/client";
import { fetchAllPages } from "@/server/pandascore/client";
import { mapPlayer, mapTeam, UnsupportedRecordError, type PlayerInput } from "@/server/pandascore/map";
import { psTeamWithPlayersSchema } from "@/server/pandascore/schemas";
import { dedupeById, eachRecord, runWithLease, SOURCE, type SyncReport } from "./lease";
import { upsertTeam, type IdCache } from "./teams-store";

/** Busca times (com elenco atual). `since` nulo = catálogo inteiro. */
export type TeamFetcher = (since: Date | null, now: Date) => Promise<unknown[]>;

const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

export function pandaScoreTeamFetcher(token: string): TeamFetcher {
  return (since, now) =>
    since === null
      ? fetchAllPages("/valorant/teams", { sort: "id" }, token, 40)
      : fetchAllPages(
          "/valorant/teams",
          { "range[modified_at]": `${iso(since)},${iso(now)}`, sort: "modified_at" },
          token,
          20,
        );
}

async function upsertPlayer(db: PrismaClient, p: PlayerInput): Promise<string> {
  const data = {
    slug: p.slug,
    handle: p.handle,
    firstName: p.firstName,
    lastName: p.lastName,
    countryCode: p.countryCode,
    imageUrl: p.imageUrl,
  };
  const row = await db.player.upsert({
    where: { source_externalId: { source: SOURCE, externalId: p.externalId } },
    create: { source: SOURCE, externalId: p.externalId, ...data },
    update: data,
    select: { id: true },
  });
  return row.id;
}

/**
 * Ajusta as passagens para refletir o elenco atual do time:
 * quem saiu tem a passagem encerrada; quem chegou (ou mudou de time) ganha passagem nova.
 */
async function reconcileRoster(db: PrismaClient, teamId: string, playerIds: string[], now: Date, observed: boolean) {
  await db.$transaction(async (tx) => {
    await tx.playerTeamStint.updateMany({
      where: { teamId, endedAt: null, playerId: { notIn: playerIds } },
      data: { endedAt: now },
    });

    for (const playerId of playerIds) {
      const open = await tx.playerTeamStint.findFirst({
        where: { playerId, endedAt: null },
        select: { id: true, teamId: true, startedAt: true },
      });
      if (open?.teamId === teamId) continue;
      if (open) {
        const endedAt = open.startedAt > now ? open.startedAt : now;
        await tx.playerTeamStint.update({ where: { id: open.id }, data: { endedAt } });
      }
      await tx.playerTeamStint.create({
        data: { playerId, teamId, startedAt: now, startObserved: observed },
      });
    }
  });
}

export function syncTeams(db: PrismaClient, fetchTeams: TeamFetcher, now: Date = new Date()): Promise<SyncReport> {
  return runWithLease(db, "TEAMS", now, async (since) => {
    const raw = await fetchTeams(since, now);
    const cache: IdCache = new Map();
    // Na primeira carga não sabemos quando cada jogador entrou; depois, uma entrada nova foi vista acontecer.
    const observed = since !== null;

    return eachRecord(dedupeById(raw), async (item) => {
      const parsed = psTeamWithPlayersSchema.safeParse(item);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const id = (item as { id?: unknown })?.id;
        throw new UnsupportedRecordError(`time ${String(id)}: ${issue.path.join(".")} ${issue.message}`);
      }
      const teamId = await upsertTeam(db, mapTeam(parsed.data), cache);
      const playerIds: string[] = [];
      for (const p of parsed.data.players) {
        if (p.active) playerIds.push(await upsertPlayer(db, mapPlayer(p)));
      }
      await reconcileRoster(db, teamId, playerIds, now, observed);
    });
  });
}
