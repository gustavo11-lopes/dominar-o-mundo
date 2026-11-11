import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { matchSelect, teamSelect, toMatchView, toTeamView, type MatchView, type TeamView } from "./matches";
import { DATA_TAG } from "./tags";

export const PLAYERS_PAGE_SIZE = 48;

export type PlayerCard = {
  slug: string;
  handle: string;
  fullName: string | null;
  countryCode: string | null;
  imageUrl: string | null;
  team: TeamView | null;
};

const fullName = (first: string | null, last: string | null) => [first, last].filter(Boolean).join(" ") || null;

/** Só jogadores com time atual: o catálogo do provedor tem muitos perfis antigos e vazios. */
export async function getPlayerList(query: string, page: number): Promise<{ items: PlayerCard[]; hasNext: boolean }> {
  "use cache";
  cacheTag(DATA_TAG);
  cacheLife("hours");

  const rows = await db.player.findMany({
    where: {
      stints: { some: { endedAt: null } },
      ...(query
        ? {
            OR: [
              { handle: { contains: query, mode: "insensitive" } },
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ handle: "asc" }, { id: "asc" }],
    skip: (page - 1) * PLAYERS_PAGE_SIZE,
    take: PLAYERS_PAGE_SIZE + 1,
    select: {
      slug: true,
      handle: true,
      firstName: true,
      lastName: true,
      countryCode: true,
      imageUrl: true,
      stints: { where: { endedAt: null }, take: 1, select: { team: { select: teamSelect } } },
    },
  });

  return {
    items: rows.slice(0, PLAYERS_PAGE_SIZE).map((p) => ({
      slug: p.slug,
      handle: p.handle,
      fullName: fullName(p.firstName, p.lastName),
      countryCode: p.countryCode,
      imageUrl: p.imageUrl,
      team: p.stints[0] ? toTeamView(p.stints[0].team) : null,
    })),
    hasNext: rows.length > PLAYERS_PAGE_SIZE,
  };
}

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
