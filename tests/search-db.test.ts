import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// cacheLife/cacheTag só funcionam dentro do Next; aqui a função roda sem cache.
vi.mock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {} }));

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("busca no banco (Postgres)", () => {
  let search: typeof import("@/server/queries/search");
  let db: typeof import("@/lib/db").db;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = await import("@/lib/db"));
    search = await import("@/server/queries/search");
    await db.$executeRawUnsafe(
      `TRUNCATE region, team, player, player_team_stint, league, tournament, stage, stage_standing, match, match_map, sync_state CASCADE`,
    );
    const teams = [
      ["1", "loud", "LOUD", "LOUD", "BR"],
      ["2", "kru-blaze", "KRÜ Blaze", null, "AR"],
      ["3", "100-thieves", "100 Thieves", "100T", "US"],
      ["4", "sentinels", "Sentinels", "SEN", "US"],
      ["5", "team-x", "Team X", null, null],
    ] as const;
    for (const [id, slug, name, acronym, country] of teams) {
      await db.team.create({
        data: { source: "PANDASCORE", externalId: id, slug, name, acronym, countryCode: country },
      });
    }
    const players = [
      ["10", "luk-xo", "luk xo", "Lucas", "Souza", "BR", "loud"],
      ["11", "aspas", "aspas", "Erick", "Santos", "BR", "loud"],
      ["12", "tenz", "TenZ", "Tyson", "Ngo", "CA", "sentinels"],
      ["13", "joao", "Jôão", null, null, null, null],
    ] as const;
    for (const [id, slug, handle, first, last, country, teamSlug] of players) {
      const p = await db.player.create({
        data: {
          source: "PANDASCORE",
          externalId: id,
          slug,
          handle,
          firstName: first,
          lastName: last,
          countryCode: country,
        },
      });
      if (teamSlug) {
        const t = await db.team.findUniqueOrThrow({ where: { slug: teamSlug } });
        await db.playerTeamStint.create({ data: { playerId: p.id, teamId: t.id, startedAt: new Date() } });
      }
    }
  });
  afterAll(() => db.$disconnect());

  const teamNames = async (q: string) => (await search.searchTeams(q, null)).map((t) => t.name);
  const handles = async (q: string) => (await search.searchPlayers(q, null)).map((p) => p.handle);

  it("acha jogador sem o espaço do nick", async () => {
    expect((await handles("Lukxo"))[0]).toBe("luk xo");
    expect((await handles("LUK XO"))[0]).toBe("luk xo");
  });

  it("ignora acentos nos dois sentidos", async () => {
    expect((await teamNames("kru"))[0]).toBe("KRÜ Blaze");
    expect((await teamNames("krü blaze"))[0]).toBe("KRÜ Blaze");
    expect((await handles("joao"))[0]).toBe("Jôão");
    expect((await handles("Áspas"))[0]).toBe("aspas");
  });

  it("aceita sigla, parte do nome, nome completo e pequenos erros", async () => {
    expect((await teamNames("100t"))[0]).toBe("100 Thieves");
    expect((await teamNames("thiev"))[0]).toBe("100 Thieves");
    expect((await teamNames("sentinls"))[0]).toBe("Sentinels");
    expect((await handles("tyson ngo"))[0]).toBe("TenZ");
  });

  it("ordena por relevância: igual vem antes de parecido", async () => {
    const r = await teamNames("loud");
    expect(r[0]).toBe("LOUD");
  });

  it("filtra por região; região do jogador vem do time atual", async () => {
    expect((await search.searchTeams("s", "na")).every((t) => t.region === "na")).toBe(true);
    const tenz = (await search.searchPlayers("tenz", null))[0];
    expect(tenz.region).toBe("na");
    expect(tenz.team?.name).toBe("Sentinels");
    expect((await search.searchPlayers("tenz", "sa")).length).toBe(0);
    expect((await search.searchTeams("team x", "outras"))[0].name).toBe("Team X");
  });

  it("busca vazia não devolve nada", async () => {
    expect(await teamNames("   ")).toEqual([]);
    expect(await handles("!!!")).toEqual([]);
  });
});
