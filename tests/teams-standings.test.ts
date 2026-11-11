import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { syncMatches } from "@/server/sync/matches";
import { syncStandings } from "@/server/sync/standings";
import { syncTeams } from "@/server/sync/teams";
import past from "./fixtures/pandascore-matches-past.json";
import bracket from "./fixtures/pandascore-standings-bracket.json";
import teams from "./fixtures/pandascore-teams.json";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("syncTeams e syncStandings (Postgres)", () => {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url!, options: "-c TimeZone=UTC" }),
  });
  // Relógio real: a seleção de fases compara com o updatedAt que o banco grava agora.
  const T0 = new Date();
  const T1 = new Date(T0.getTime() + 60_000);
  const [alg, lng] = teams;
  const movingPlayer = alg.players[0];

  const openStints = (externalId: string) =>
    db.playerTeamStint.findMany({
      where: { player: { externalId }, endedAt: null },
      include: { team: true },
    });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      `TRUNCATE region, team, player, player_team_stint, league, tournament, stage, stage_standing, match, match_map, sync_state CASCADE`,
    );
  });
  afterAll(() => db.$disconnect());

  it("primeira carga cria elencos com início não observado", async () => {
    const report = await syncTeams(db, async () => structuredClone(teams), T0);
    expect(report).toMatchObject({ status: "ok", saved: 2, failed: [] });

    const open = await db.playerTeamStint.count({ where: { endedAt: null } });
    expect(open).toBe(alg.players.length + lng.players.length);
    expect(await db.playerTeamStint.count({ where: { startObserved: true } })).toBe(0);
  });

  it("transferência encerra a passagem antiga e abre uma nova, observada", async () => {
    await syncTeams(db, async () => structuredClone(teams), T0);

    const algAfter = { ...structuredClone(alg), players: alg.players.slice(1) };
    const lngAfter = { ...structuredClone(lng), players: [...lng.players, movingPlayer] };
    await syncTeams(db, async () => [algAfter, lngAfter], T1);

    const open = await openStints(String(movingPlayer.id));
    expect(open).toHaveLength(1);
    expect(open[0].team.externalId).toBe(String(lng.id));
    expect(open[0].startObserved).toBe(true);
    expect(open[0].startedAt.toISOString()).toBe(T1.toISOString());

    const closed = await db.playerTeamStint.findFirstOrThrow({
      where: { player: { externalId: String(movingPlayer.id) }, endedAt: { not: null } },
      include: { team: true },
    });
    expect(closed.team.externalId).toBe(String(alg.id));

    // Repetir o mesmo estado não cria nem encerra nada.
    const before = await db.playerTeamStint.count();
    await syncTeams(db, async () => [algAfter, lngAfter], new Date(T1.getTime() + 3_600_000));
    expect(await db.playerTeamStint.count()).toBe(before);
  });

  it("jogador que sai sem ir para outro time fica sem passagem aberta", async () => {
    await syncTeams(db, async () => structuredClone(teams), T0);
    await syncTeams(db, async () => [{ ...structuredClone(alg), players: alg.players.slice(1) }], T1);
    expect(await openStints(String(movingPlayer.id))).toHaveLength(0);
  });

  it("classificação de chave: só posição, substituída a cada atualização", async () => {
    await syncMatches(db, async () => structuredClone(past), T0);
    const requested: string[] = [];
    const report = await syncStandings(
      db,
      async (id) => {
        requested.push(id);
        return id === "22427" ? structuredClone(bracket) : [];
      },
      T0,
    );
    expect(report).toMatchObject({ status: "ok", failed: [] });
    expect(requested).toContain("22427");

    const rows = await db.stageStanding.findMany({
      where: { stage: { externalId: "22427" } },
      orderBy: { rank: "asc" },
      include: { team: true },
    });
    expect(rows.map((r) => [r.rank, r.team.externalId, r.wins])).toEqual([
      [1, "139566", null],
      [2, "137123", null],
      [3, "136225", null],
      [4, "139567", null],
    ]);

    // Nova versão com um time a menos: o que saiu é removido.
    await syncMatches(db, async () => structuredClone(past), T1);
    await syncStandings(db, async (id) => (id === "22427" ? structuredClone(bracket).slice(0, 3) : []), T1);
    expect(await db.stageStanding.count({ where: { stage: { externalId: "22427" } } })).toBe(3);
  });
});
