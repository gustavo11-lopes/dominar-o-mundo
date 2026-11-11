import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { matchSelect, teamSelect, toMatchView, toTeamView, type MatchView, type TeamView } from "./matches";
import { DATA_TAG } from "./tags";
import { getTournamentList, type TournamentCard } from "./tournaments";

const DAY = 86_400_000;

export type ActiveTeam = TeamView & { wins: number; losses: number };

export type HomeData = {
  /** Destaque: partida ao vivo de maior tier; senão, a próxima de maior tier nos próximos 7 dias. */
  featured: (MatchView & { live: boolean }) | null;
  live: MatchView[];
  upcoming: MatchView[];
  results: MatchView[];
  tournaments: TournamentCard[];
  activeTeams: ActiveTeam[];
};

export async function getHomeData(): Promise<HomeData> {
  "use cache";
  cacheTag(DATA_TAG);
  cacheLife("minutes");

  const now = Date.now();
  // Postgres ordena enums pela ordem declarada: S, A, B, C, D, UNRANKED.
  const byTier = [
    { stage: { tier: "asc" as const } },
    { scheduledAt: { sort: "asc" as const, nulls: "last" as const } },
  ];

  const [live, nextFeatured, upcoming, results, tournaments, teamRows] = await Promise.all([
    db.match.findMany({ where: { status: "LIVE" }, orderBy: byTier, take: 8, select: matchSelect }),
    db.match.findFirst({
      where: {
        status: "SCHEDULED",
        scheduledAt: { gte: new Date(now - 30 * 60_000), lte: new Date(now + 7 * DAY) },
        teamAId: { not: null },
        teamBId: { not: null },
      },
      orderBy: byTier,
      select: matchSelect,
    }),
    db.match.findMany({
      where: { status: "SCHEDULED", scheduledAt: { gte: new Date(now - 30 * 60_000) } },
      orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
      take: 7,
      select: matchSelect,
    }),
    db.match.findMany({
      where: { status: "FINISHED" },
      orderBy: [{ scheduledAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
      take: 6,
      select: matchSelect,
    }),
    getTournamentList("atuais", 1),
    // Times com mais séries encerradas nos últimos 30 dias.
    db.$queryRaw<{ team_id: string; wins: bigint; losses: bigint }[]>`
      SELECT t.team_id,
             COUNT(*) FILTER (WHERE m.winner_team_id = t.team_id) AS wins,
             COUNT(*) FILTER (WHERE m.winner_team_id <> t.team_id) AS losses
      FROM "match" m
      CROSS JOIN LATERAL (VALUES (m.team_a_id), (m.team_b_id)) AS t(team_id)
      WHERE m.status = 'FINISHED' AND m.winner_team_id IS NOT NULL
        AND m.scheduled_at >= ${new Date(now - 30 * DAY)}
      GROUP BY t.team_id
      ORDER BY COUNT(*) DESC, wins DESC
      LIMIT 8`,
  ]);

  const teams = await db.team.findMany({
    where: { id: { in: teamRows.map((r) => r.team_id) } },
    select: { id: true, ...teamSelect },
  });
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const featuredRow = live[0] ?? nextFeatured;
  const featured = featuredRow ? { ...toMatchView(featuredRow), live: featuredRow.status === "LIVE" } : null;

  return {
    featured,
    live: live.slice(featured?.live ? 1 : 0).map(toMatchView),
    upcoming: upcoming
      .filter((m) => m.id !== featured?.id)
      .slice(0, 6)
      .map(toMatchView),
    results: results.map(toMatchView),
    tournaments: tournaments.items.slice(0, 4),
    activeTeams: teamRows.flatMap((r) => {
      const t = teamById.get(r.team_id);
      return t ? [{ ...toTeamView(t), wins: Number(r.wins), losses: Number(r.losses) }] : [];
    }),
  };
}
