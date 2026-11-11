import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { syncMatches, type MatchFetcher } from "@/server/sync/matches";
import past from "./fixtures/pandascore-matches-past.json";
import upcoming from "./fixtures/pandascore-matches-upcoming.json";

// Integração contra um Postgres de verdade, com as migrações aplicadas.
// Rode com TEST_DATABASE_URL apontando para um banco descartável: os dados são apagados.
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("syncMatches (Postgres)", () => {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url! }),
  });
  const all = [...past, ...upcoming];
  const fixed =
    (items: unknown[]): MatchFetcher =>
    async () =>
      structuredClone(items);
  const counts = async () => ({
    matches: await db.match.count(),
    maps: await db.matchMap.count(),
    teams: await db.team.count(),
    stages: await db.stage.count(),
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      `TRUNCATE region, team, player, player_team_stint, league, tournament, stage, stage_standing, match, match_map, sync_state CASCADE`,
    );
  });
  afterAll(() => db.$disconnect());

  it("grava tudo na primeira carga e não duplica na segunda", async () => {
    const first = await syncMatches(db, fixed(all), new Date("2026-11-11T12:00:00Z"));
    expect(first).toMatchObject({ status: "ok", fetched: 6, saved: 6, failed: [], since: null });
    const afterFirst = await counts();
    expect(afterFirst.matches).toBe(6);

    const second = await syncMatches(db, fixed(all), new Date("2026-11-11T12:05:00Z"));
    expect(second).toMatchObject({ status: "ok", saved: 6 });
    // A segunda janela começa 5 min antes do início da primeira.
    expect(second.status === "ok" && second.since?.toISOString()).toBe("2026-11-11T11:55:00.000Z");
    expect(await counts()).toEqual(afterFirst);

    const final = await db.match.findFirstOrThrow({
      where: { externalId: "1802840" },
      include: { teamA: true, winner: true },
    });
    expect(final.scheduledAt?.toISOString()).toBe("2026-11-10T18:45:00.000Z");
    expect([final.scoreA, final.scoreB, final.winner?.name]).toEqual([2, 1, "Aurora Gaming"]);
  });

  it("um registro inválido vai para o relatório e não impede os outros", async () => {
    const broken = structuredClone(past[0]) as Record<string, unknown>;
    broken.status = "paused";
    const report = await syncMatches(db, fixed([broken, past[1], past[2]]));
    expect(report).toMatchObject({ status: "ok", fetched: 3, saved: 2 });
    expect(report.status === "ok" && report.failed[0].reason).toMatch(/status desconhecido/);

    const state = await db.syncState.findFirstOrThrow();
    expect(state.lastError).toMatch(/1 registro/);
  });

  it("atualiza a série e remove mapas que o provedor deixou de enviar", async () => {
    await syncMatches(db, fixed([past[0]]));
    const changed = structuredClone(past[0]);
    changed.games = changed.games.slice(0, 2);
    changed.results = changed.results.map((r) => ({ ...r, score: r.team_id === 139566 ? 1 : 1 }));
    changed.winner_id = null as unknown as number;
    changed.status = "running";
    await syncMatches(db, fixed([changed]), new Date(Date.now() + 60_000));

    const m = await db.match.findFirstOrThrow({ include: { maps: true } });
    expect([m.status, m.scoreA, m.scoreB, m.winnerTeamId]).toEqual(["LIVE", 1, 1, null]);
    expect(m.maps).toHaveLength(2);
  });

  it("não roda duas sincronizações ao mesmo tempo", async () => {
    let release!: () => void;
    const slow: MatchFetcher = () => new Promise((resolve) => (release = () => resolve([])));
    const running = syncMatches(db, slow);
    await new Promise((r) => setTimeout(r, 100));

    await expect(syncMatches(db, fixed(all))).resolves.toEqual({
      status: "skipped",
      reason: "outra sincronização em andamento",
    });
    release();
    await expect(running).resolves.toMatchObject({ status: "ok" });
  });
});
