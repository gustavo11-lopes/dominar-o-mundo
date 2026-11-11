import type { PrismaClient } from "@/generated/prisma/client";
import { fetchAllPages } from "@/server/pandascore/client";
import { mapPlayer, mapTeam, UnsupportedRecordError, type PlayerInput } from "@/server/pandascore/map";
import { psTeamWithPlayersSchema } from "@/server/pandascore/schemas";
import { uuidv7 } from "@/lib/uuid";
import type { PsTeamWithPlayers } from "@/server/pandascore/schemas";
import { dedupeById, describeError, eachRecord, runWithLease, SOURCE, type Failure, type SyncReport } from "./lease";
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

/** Times por lote na gravação em massa. */
const BATCH_SIZE = 100;

/**
 * Grava um lote inteiro com poucas consultas (upsert em massa + passagens por conjunto).
 * Com o banco a alguns milissegundos de distância, isso é a diferença entre segundos e minutos.
 */
async function saveBatch(db: PrismaClient, batch: PsTeamWithPlayers[], now: Date, observed: boolean) {
  const teams = batch.map(mapTeam);
  // Um jogador listado em dois elencos do mesmo lote fica no último (evita duas passagens abertas).
  const rosterByPlayer = new Map<string, { player: PlayerInput; teamExternalId: string }>();
  for (const t of batch) {
    for (const p of t.players) {
      if (p.active) rosterByPlayer.set(String(p.id), { player: mapPlayer(p), teamExternalId: String(t.id) });
    }
  }
  const players = [...rosterByPlayer.values()].map((r) => r.player);
  const ts = now.getTime();

  await db.$transaction(async (tx) => {
    const teamRows = await tx.$queryRaw<{ id: string; external_id: string }[]>`
      INSERT INTO "team" ("id", "source", "external_id", "slug", "name", "acronym", "country_code", "logo_url", "logo_dark_url", "updated_at")
      SELECT r.id::uuid, 'PANDASCORE', r.external_id, r.slug, r.name, r.acronym, r.country_code, r.logo_url, r.logo_dark_url, ${now}
      FROM unnest(
        ${teams.map(() => uuidv7(ts))}::text[], ${teams.map((t) => t.externalId)}::text[], ${teams.map((t) => t.slug)}::text[],
        ${teams.map((t) => t.name)}::text[], ${teams.map((t) => t.acronym)}::text[], ${teams.map((t) => t.countryCode)}::text[],
        ${teams.map((t) => t.logoUrl)}::text[], ${teams.map((t) => t.logoDarkUrl)}::text[]
      ) AS r(id, external_id, slug, name, acronym, country_code, logo_url, logo_dark_url)
      ON CONFLICT ("source", "external_id") DO UPDATE SET
        "slug" = EXCLUDED."slug", "name" = EXCLUDED."name", "acronym" = EXCLUDED."acronym",
        "country_code" = EXCLUDED."country_code", "logo_url" = EXCLUDED."logo_url",
        "logo_dark_url" = EXCLUDED."logo_dark_url", "updated_at" = EXCLUDED."updated_at"
      RETURNING "id", "external_id"`;
    const teamId = new Map(teamRows.map((r) => [r.external_id, r.id]));

    const playerRows = players.length
      ? await tx.$queryRaw<{ id: string; external_id: string }[]>`
          INSERT INTO "player" ("id", "source", "external_id", "slug", "handle", "first_name", "last_name", "country_code", "image_url", "updated_at")
          SELECT r.id::uuid, 'PANDASCORE', r.external_id, r.slug, r.handle, r.first_name, r.last_name, r.country_code, r.image_url, ${now}
          FROM unnest(
            ${players.map(() => uuidv7(ts))}::text[], ${players.map((p) => p.externalId)}::text[], ${players.map((p) => p.slug)}::text[],
            ${players.map((p) => p.handle)}::text[], ${players.map((p) => p.firstName)}::text[], ${players.map((p) => p.lastName)}::text[],
            ${players.map((p) => p.countryCode)}::text[], ${players.map((p) => p.imageUrl)}::text[]
          ) AS r(id, external_id, slug, handle, first_name, last_name, country_code, image_url)
          ON CONFLICT ("source", "external_id") DO UPDATE SET
            "slug" = EXCLUDED."slug", "handle" = EXCLUDED."handle", "first_name" = EXCLUDED."first_name",
            "last_name" = EXCLUDED."last_name", "country_code" = EXCLUDED."country_code",
            "image_url" = EXCLUDED."image_url", "updated_at" = EXCLUDED."updated_at"
          RETURNING "id", "external_id"`
      : [];
    const playerId = new Map(playerRows.map((r) => [r.external_id, r.id]));

    const pairs = [...rosterByPlayer.entries()].map(([pid, r]) => ({
      playerId: playerId.get(pid)!,
      teamId: teamId.get(r.teamExternalId)!,
    }));
    const batchTeamIds = [...teamId.values()];
    const pairPlayers = pairs.map((p) => p.playerId);
    const pairTeams = pairs.map((p) => p.teamId);

    // 1. Quem saiu de um time do lote e não está mais no elenco dele.
    await tx.$executeRaw`
      UPDATE "player_team_stint" s SET "ended_at" = GREATEST(${now}, s."started_at")
      WHERE s."ended_at" IS NULL AND s."team_id" = ANY(${batchTeamIds}::uuid[])
        AND NOT EXISTS (
          SELECT 1 FROM unnest(${pairPlayers}::uuid[], ${pairTeams}::uuid[]) AS r(p, t)
          WHERE r.p = s."player_id" AND r.t = s."team_id"
        )`;
    // 2. Quem está num elenco do lote mas tinha passagem aberta em outro time.
    await tx.$executeRaw`
      UPDATE "player_team_stint" s SET "ended_at" = GREATEST(${now}, s."started_at")
      FROM unnest(${pairPlayers}::uuid[], ${pairTeams}::uuid[]) AS r(p, t)
      WHERE s."ended_at" IS NULL AND s."player_id" = r.p AND s."team_id" <> r.t`;
    // 3. Passagem nova para quem ficou sem passagem aberta.
    await tx.$executeRaw`
      INSERT INTO "player_team_stint" ("id", "player_id", "team_id", "started_at", "start_observed")
      SELECT r.id::uuid, r.p, r.t, ${now}, ${observed}
      FROM unnest(${pairs.map(() => uuidv7(ts))}::text[], ${pairPlayers}::uuid[], ${pairTeams}::uuid[]) AS r(id, p, t)
      WHERE NOT EXISTS (SELECT 1 FROM "player_team_stint" s WHERE s."player_id" = r.p AND s."ended_at" IS NULL)`;
  });
}

export function syncTeams(db: PrismaClient, fetchTeams: TeamFetcher, now: Date = new Date()): Promise<SyncReport> {
  return runWithLease(db, "TEAMS", now, async (since) => {
    const raw = await fetchTeams(since, now);
    // Na primeira carga não sabemos quando cada jogador entrou; depois, uma entrada nova foi vista acontecer.
    const observed = since !== null;

    const valid: PsTeamWithPlayers[] = [];
    const failed: Failure[] = [];
    for (const [id, item] of dedupeById(raw)) {
      const parsed = psTeamWithPlayersSchema.safeParse(item);
      if (parsed.success) valid.push(parsed.data);
      else {
        const issue = parsed.error.issues[0];
        failed.push({ id, reason: `time ${String(id)}: ${issue.path.join(".")} ${issue.message}` });
      }
    }

    let saved = 0;
    for (let i = 0; i < valid.length; i += BATCH_SIZE) {
      const batch = valid.slice(i, i + BATCH_SIZE);
      try {
        await saveBatch(db, batch, now, observed);
        saved += batch.length;
      } catch (err) {
        // Lote recusado (ex.: slug repetido): grava um a um para isolar o registro problemático.
        console.warn(`[sync] lote de times falhou, gravando um a um: ${describeError(err)}`);
        const one = await saveOneByOne(db, batch, now, observed);
        saved += one.saved;
        failed.push(...one.failed);
      }
    }
    return { fetched: valid.length + failed.length, saved, failed };
  });
}

/** Caminho lento e isolado, usado só quando um lote é recusado. */
function saveOneByOne(db: PrismaClient, batch: PsTeamWithPlayers[], now: Date, observed: boolean) {
  const cache: IdCache = new Map();
  return eachRecord(
    batch.map((t) => [t.id, t] as [unknown, PsTeamWithPlayers]),
    async (team) => {
      const teamId = await upsertTeam(db, mapTeam(team), cache);
      const playerIds: string[] = [];
      for (const p of team.players) {
        if (p.active) playerIds.push(await upsertPlayer(db, mapPlayer(p)));
      }
      await reconcileRoster(db, teamId, playerIds, now, observed);
    },
  );
}
