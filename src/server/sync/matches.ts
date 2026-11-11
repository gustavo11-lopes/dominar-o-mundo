import type { PrismaClient } from "@/generated/prisma/client";
import { fetchAllPages } from "@/server/pandascore/client";
import { mapMatch, regionName, UnsupportedRecordError, type MatchInput } from "@/server/pandascore/map";
import { psMatchSchema } from "@/server/pandascore/schemas";
import { dedupeById, eachRecord, runWithLease, SOURCE, type SyncReport } from "./lease";
import { teamIdByExternal, upsertTeam, type IdCache } from "./teams-store";

/** Busca partidas cruas no provedor. `since` nulo = primeira carga. */
export type MatchFetcher = (since: Date | null, now: Date) => Promise<unknown[]>;

/** Primeira carga: resultados deste período para trás. */
const INITIAL_PAST_DAYS = 30;

const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

export function pandaScoreFetcher(token: string): MatchFetcher {
  return async (since, now) => {
    const batches: unknown[][] = [];
    if (since === null) {
      batches.push(await fetchAllPages("/valorant/matches/upcoming", { sort: "scheduled_at" }, token, 10));
      const from = new Date(now.getTime() - INITIAL_PAST_DAYS * 86_400_000);
      batches.push(
        await fetchAllPages(
          "/valorant/matches/past",
          { "range[scheduled_at]": `${iso(from)},${iso(now)}`, sort: "-scheduled_at" },
          token,
          20,
        ),
      );
    } else {
      batches.push(
        await fetchAllPages(
          "/valorant/matches",
          { "range[modified_at]": `${iso(since)},${iso(now)}`, sort: "modified_at" },
          token,
          20,
        ),
      );
    }
    // Sempre por último: o estado ao vivo é o mais recente e prevalece na deduplicação.
    batches.push(await fetchAllPages("/valorant/matches/running", {}, token, 2));
    return batches.flat();
  };
}

async function saveMatch(db: PrismaClient, input: MatchInput, cache: IdCache) {
  const { league, tournament, stage, match } = input;

  let regionId: string | null = null;
  if (stage.regionCode) {
    const key = `region:${stage.regionCode}`;
    regionId = cache.get(key) ?? null;
    if (!regionId) {
      const row = await db.region.upsert({
        where: { code: stage.regionCode },
        create: { code: stage.regionCode, name: regionName(stage.regionCode) },
        update: {},
        select: { id: true },
      });
      regionId = row.id;
      cache.set(key, regionId);
    }
  }

  const leagueKey = `league:${league.externalId}`;
  let leagueId = cache.get(leagueKey);
  if (!leagueId) {
    const data = { slug: league.slug, name: league.name, imageUrl: league.imageUrl };
    leagueId = (
      await db.league.upsert({
        where: { source_externalId: { source: SOURCE, externalId: league.externalId } },
        create: { source: SOURCE, externalId: league.externalId, ...data },
        update: data,
        select: { id: true },
      })
    ).id;
    cache.set(leagueKey, leagueId);
  }

  const tournamentKey = `tournament:${tournament.externalId}`;
  let tournamentId = cache.get(tournamentKey);
  if (!tournamentId) {
    const data = {
      leagueId,
      slug: tournament.slug,
      name: tournament.name,
      beginAt: tournament.beginAt,
      endAt: tournament.endAt,
    };
    tournamentId = (
      await db.tournament.upsert({
        where: { source_externalId: { source: SOURCE, externalId: tournament.externalId } },
        create: { source: SOURCE, externalId: tournament.externalId, ...data },
        update: data,
        select: { id: true },
      })
    ).id;
    cache.set(tournamentKey, tournamentId);
  }

  const teamAId = input.teamA ? await upsertTeam(db, input.teamA, cache) : null;
  const teamBId = input.teamB ? await upsertTeam(db, input.teamB, cache) : null;

  const stageKey = `stage:${stage.externalId}`;
  let stageId = cache.get(stageKey);
  if (!stageId) {
    const data = {
      tournamentId,
      regionId,
      slug: stage.slug,
      name: stage.name,
      tier: stage.tier,
      prizePool: stage.prizePool,
      beginAt: stage.beginAt,
      endAt: stage.endAt,
      winnerTeamId: await teamIdByExternal(db, stage.winnerExternalId, cache),
    };
    stageId = (
      await db.stage.upsert({
        where: { source_externalId: { source: SOURCE, externalId: stage.externalId } },
        create: { source: SOURCE, externalId: stage.externalId, ...data },
        update: data,
        select: { id: true },
      })
    ).id;
    cache.set(stageKey, stageId);
  }

  // Vencedores só podem ser os próprios participantes.
  const participant = (externalId: string | null) =>
    externalId === input.teamA?.externalId ? teamAId : externalId === input.teamB?.externalId ? teamBId : null;

  const matchData = {
    stageId,
    name: match.name,
    status: match.status,
    scheduledAt: match.scheduledAt,
    beginAt: match.beginAt,
    endAt: match.endAt,
    bestOf: match.bestOf,
    teamAId,
    teamBId,
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    winnerTeamId: participant(match.winnerExternalId),
    forfeit: match.forfeit,
    streamUrl: match.streamUrl,
    streamEmbedUrl: match.streamEmbedUrl,
  };

  await db.$transaction(async (tx) => {
    const { id: matchId } = await tx.match.upsert({
      where: { source_externalId: { source: SOURCE, externalId: match.externalId } },
      create: { source: SOURCE, externalId: match.externalId, ...matchData },
      update: matchData,
      select: { id: true },
    });

    // O provedor pode recriar os mapas de uma série; o que não veio nesta versão sai.
    await tx.matchMap.deleteMany({
      where: { matchId, externalId: { notIn: input.maps.map((m) => m.externalId) } },
    });
    for (const map of input.maps) {
      const data = {
        matchId,
        position: map.position,
        status: map.status,
        winnerTeamId: participant(map.winnerExternalId),
        beginAt: map.beginAt,
        endAt: map.endAt,
      };
      await tx.matchMap.upsert({
        where: { source_externalId: { source: SOURCE, externalId: map.externalId } },
        create: { source: SOURCE, externalId: map.externalId, ...data },
        update: data,
      });
    }
  });
}

/**
 * Sincroniza partidas do provedor para o banco. Idempotente: rodar duas vezes com os mesmos
 * dados não muda nada. Um registro inválido não derruba os demais; vai para o relatório.
 */
export function syncMatches(db: PrismaClient, fetchMatches: MatchFetcher, now: Date = new Date()): Promise<SyncReport> {
  return runWithLease(db, "MATCHES", now, async (since) => {
    const raw = await fetchMatches(since, now);
    const cache: IdCache = new Map();
    return eachRecord(dedupeById(raw), async (item) => {
      const parsed = psMatchSchema.safeParse(item);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const id = (item as { id?: unknown })?.id;
        throw new UnsupportedRecordError(`partida ${String(id)}: ${issue.path.join(".")} ${issue.message}`);
      }
      await saveMatch(db, mapMatch(parsed.data), cache);
    });
  });
}
