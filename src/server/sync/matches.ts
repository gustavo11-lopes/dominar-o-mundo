import type { PrismaClient } from "@/generated/prisma/client";
import { fetchAllPages } from "@/server/pandascore/client";
import { mapMatch, regionName, UnsupportedRecordError, type MatchInput, type TeamInput } from "@/server/pandascore/map";
import { psMatchSchema } from "@/server/pandascore/schemas";

/** Busca partidas cruas no provedor. `since` nulo = primeira carga. */
export type MatchFetcher = (since: Date | null, now: Date) => Promise<unknown[]>;

export type SyncReport =
  | { status: "skipped"; reason: string }
  | { status: "ok"; fetched: number; saved: number; failed: { id: unknown; reason: string }[]; since: Date | null };

const SOURCE = "PANDASCORE" as const;
/** Sobreposição entre janelas, para não perder registros alterados durante a execução anterior. */
const OVERLAP_MS = 5 * 60_000;
/** Primeira carga: resultados deste período para trás. */
const INITIAL_PAST_DAYS = 30;
/** Execução travada há mais tempo que isso é considerada morta e pode ser assumida. */
const LEASE_MS = 10 * 60_000;

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

/** Garante que só uma execução rode por vez. Devolve a data do último sucesso, ou `false` se já há outra rodando. */
async function acquireLease(db: PrismaClient, now: Date): Promise<{ lastSuccessAt: Date | null } | false> {
  await db.syncState.upsert({
    where: { source_resource: { source: SOURCE, resource: "MATCHES" } },
    create: { source: SOURCE, resource: "MATCHES" },
    update: {},
  });
  const staleBefore = new Date(now.getTime() - LEASE_MS);
  const rows = await db.$queryRaw<{ last_success_at: Date | null }[]>`
    UPDATE "sync_state" SET "last_started_at" = ${now}
    WHERE "source" = 'PANDASCORE' AND "resource" = 'MATCHES'
      AND (
        "last_started_at" IS NULL
        OR ("last_finished_at" IS NOT NULL AND "last_finished_at" >= "last_started_at")
        OR "last_started_at" < ${staleBefore}
      )
    RETURNING "last_success_at"`;
  return rows.length === 1 ? { lastSuccessAt: rows[0].last_success_at } : false;
}

/** Cache de ids internos por execução: o mesmo time aparece em várias partidas. */
type IdCache = Map<string, string>;

async function upsertTeam(db: PrismaClient, team: TeamInput, cache: IdCache): Promise<string> {
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

async function teamIdByExternal(db: PrismaClient, externalId: string | null, cache: IdCache) {
  if (!externalId) return null;
  const cached = cache.get(`team:${externalId}`);
  if (cached) return cached;
  const row = await db.team.findUnique({
    where: { source_externalId: { source: SOURCE, externalId } },
    select: { id: true },
  });
  return row?.id ?? null;
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

function describe(err: unknown): string {
  if (err instanceof UnsupportedRecordError) return err.message;
  if (err instanceof Error) return `${err.name}: ${err.message.split("\n").at(-1)?.slice(0, 300)}`;
  return String(err);
}

/**
 * Sincroniza partidas do provedor para o banco. Idempotente: rodar duas vezes com os mesmos
 * dados não muda nada. Um registro inválido não derruba os demais; vai para o relatório.
 */
export async function syncMatches(
  db: PrismaClient,
  fetchMatches: MatchFetcher,
  now: Date = new Date(),
): Promise<SyncReport> {
  // Tudo no mesmo relógio (`now`): o lease compara início e fim da execução.
  const t0 = Date.now();
  const finishedAt = () => new Date(now.getTime() + (Date.now() - t0));

  const lease = await acquireLease(db, now);
  if (!lease) return { status: "skipped", reason: "outra sincronização em andamento" };

  const where = { source_resource: { source: SOURCE, resource: "MATCHES" as const } };
  const since = lease.lastSuccessAt ? new Date(lease.lastSuccessAt.getTime() - OVERLAP_MS) : null;

  try {
    const raw = await fetchMatches(since, now);

    // A mesma partida pode vir em duas listas; a última ocorrência prevalece.
    const byId = new Map<unknown, unknown>();
    for (const item of raw) {
      byId.set((item as { id?: unknown })?.id, item);
    }

    const cache: IdCache = new Map();
    const failed: { id: unknown; reason: string }[] = [];
    let saved = 0;

    for (const [id, item] of byId) {
      try {
        const parsed = psMatchSchema.safeParse(item);
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          throw new UnsupportedRecordError(`partida ${String(id)}: ${issue.path.join(".")} ${issue.message}`);
        }
        await saveMatch(db, mapMatch(parsed.data), cache);
        saved++;
      } catch (err) {
        failed.push({ id, reason: describe(err) });
      }
    }

    await db.syncState.update({
      where,
      data: {
        lastSuccessAt: now,
        lastFinishedAt: finishedAt(),
        lastError: failed.length
          ? `${failed.length} partida(s) ignorada(s). Primeira: ${failed[0].reason}`
          : null,
      },
    });

    return { status: "ok", fetched: byId.size, saved, failed, since };
  } catch (err) {
    await db.syncState.update({
      where,
      data: { lastFinishedAt: finishedAt(), lastError: describe(err) },
    });
    throw err;
  }
}
