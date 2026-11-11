import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { matchSelect, teamSelect, toMatchView, toTeamView, type MatchView, type TeamView } from "./matches";
import { DATA_TAG } from "./tags";

export type PlayerCard = {
  slug: string;
  handle: string;
  fullName: string | null;
  countryCode: string | null;
  imageUrl: string | null;
  team: TeamView | null;
};

const fullName = (first: string | null, last: string | null) => [first, last].filter(Boolean).join(" ") || null;

export type PlayerDetail = PlayerCard & {
  history: { team: TeamView; startedAt: string; startObserved: boolean; endedAt: string | null }[];
  /** Partidas do time atual. O provedor não informa a escalação de cada partida. */
  teamMatches: MatchView[];
};

export async function getPlayer(slug: string): Promise<PlayerDetail | null> {
  "use cache";
  cacheTag(DATA_TAG);
  cacheLife("minutes");

  const p = await db.player.findUnique({
    where: { slug },
    select: {
      slug: true,
      handle: true,
      firstName: true,
      lastName: true,
      countryCode: true,
      imageUrl: true,
      stints: {
        orderBy: [{ endedAt: { sort: "desc", nulls: "first" } }, { startedAt: "desc" }],
        select: {
          teamId: true,
          startedAt: true,
          startObserved: true,
          endedAt: true,
          team: { select: teamSelect },
        },
      },
    },
  });
  if (!p) return null;

  const current = p.stints.find((s) => !s.endedAt) ?? null;
  const teamMatches = current
    ? await db.match.findMany({
        where: {
          OR: [{ teamAId: current.teamId }, { teamBId: current.teamId }],
          status: { in: ["FINISHED", "LIVE"] },
        },
        orderBy: [{ scheduledAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
        take: 10,
        select: matchSelect,
      })
    : [];

  return {
    slug: p.slug,
    handle: p.handle,
    fullName: fullName(p.firstName, p.lastName),
    countryCode: p.countryCode,
    imageUrl: p.imageUrl,
    team: current ? toTeamView(current.team) : null,
    history: p.stints.map((s) => ({
      team: toTeamView(s.team),
      startedAt: s.startedAt.toISOString(),
      startObserved: s.startObserved,
      endedAt: s.endedAt?.toISOString() ?? null,
    })),
    teamMatches: teamMatches.map(toMatchView),
  };
}
