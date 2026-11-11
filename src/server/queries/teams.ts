import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { matchSelect, toMatchView, type MatchView } from "./matches";
import { DATA_TAG } from "./tags";

export const TEAMS_PAGE_SIZE = 48;
/** "Em atividade" = jogou ou tem jogo marcado nesta janela em torno de hoje. */
const ACTIVE_WINDOW_MS = 30 * 86_400_000;

export type TeamCard = {
  slug: string;
  name: string;
  acronym: string | null;
  countryCode: string | null;
  logoUrl: string | null;
};

const cardSelect = { slug: true, name: true, acronym: true, countryCode: true, logoUrl: true } satisfies Prisma.TeamSelect;

/** Com busca: procura no catálogo inteiro. Sem busca: só times em atividade. */
export async function getTeamList(query: string, page: number): Promise<{ items: TeamCard[]; hasNext: boolean }> {
  "use cache";
  cacheTag(DATA_TAG);
  cacheLife("hours");

  let where: Prisma.TeamWhereInput;
  if (query) {
    where = {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { acronym: { contains: query, mode: "insensitive" } },
      ],
    };
  } else {
    const now = Date.now();
    const window = {
      scheduledAt: { gte: new Date(now - ACTIVE_WINDOW_MS), lte: new Date(now + ACTIVE_WINDOW_MS) },
    };
    where = { OR: [{ matchesAsA: { some: window } }, { matchesAsB: { some: window } }] };
  }

  const rows = await db.team.findMany({
    where,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (page - 1) * TEAMS_PAGE_SIZE,
    take: TEAMS_PAGE_SIZE + 1,
    select: cardSelect,
  });
  return { items: rows.slice(0, TEAMS_PAGE_SIZE), hasNext: rows.length > TEAMS_PAGE_SIZE };
}

export type RosterEntry = {
  slug: string;
  handle: string;
  fullName: string | null;
  countryCode: string | null;
  imageUrl: string | null;
  startedAt: string;
  startObserved: boolean;
  endedAt: string | null;
};

export type TeamDetail = TeamCard & {
  roster: RosterEntry[];
  formerPlayers: RosterEntry[];
  upcoming: MatchView[];
  recent: MatchView[];
  record: { wins: number; losses: number; since: string | null };
  standings: { stage: string; tournament: string; tournamentSlug: string; rank: number }[];
};

const fullName = (first: string | null, last: string | null) => [first, last].filter(Boolean).join(" ") || null;

export async function getTeam(slug: string): Promise<TeamDetail | null> {
  "use cache";
  cacheTag(DATA_TAG);
  cacheLife("minutes");

  const team = await db.team.findUnique({
    where: { slug },
    select: {
      id: true,
      ...cardSelect,
      stints: {
        orderBy: [{ endedAt: { sort: "desc", nulls: "first" } }, { startedAt: "desc" }],
        take: 40,
        select: {
          startedAt: true,
          startObserved: true,
          endedAt: true,
          player: {
            select: { slug: true, handle: true, firstName: true, lastName: true, countryCode: true, imageUrl: true },
          },
        },
      },
      standings: {
        orderBy: { stage: { beginAt: { sort: "desc", nulls: "last" } } },
        take: 10,
        select: {
          rank: true,
          stage: { select: { name: true, tournament: { select: { name: true, slug: true } } } },
        },
      },
    },
  });
  if (!team) return null;

  const involves: Prisma.MatchWhereInput = { OR: [{ teamAId: team.id }, { teamBId: team.id }] };
  const [upcoming, recent, finished] = await Promise.all([
    db.match.findMany({
      where: { ...involves, status: { in: ["SCHEDULED", "LIVE", "POSTPONED"] } },
      orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { id: "asc" }],
      take: 10,
      select: matchSelect,
    }),
    db.match.findMany({
      where: { ...involves, status: "FINISHED" },
      orderBy: [{ scheduledAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
      take: 10,
      select: matchSelect,
    }),
    db.match.findMany({
      where: { ...involves, status: "FINISHED", winnerTeamId: { not: null } },
      orderBy: { scheduledAt: { sort: "asc", nulls: "last" } },
      select: { winnerTeamId: true, scheduledAt: true },
    }),
  ]);

  const wins = finished.filter((m) => m.winnerTeamId === team.id).length;
  const toEntry = (s: (typeof team.stints)[number]): RosterEntry => ({
    slug: s.player.slug,
    handle: s.player.handle,
    fullName: fullName(s.player.firstName, s.player.lastName),
    countryCode: s.player.countryCode,
    imageUrl: s.player.imageUrl,
    startedAt: s.startedAt.toISOString(),
    startObserved: s.startObserved,
    endedAt: s.endedAt?.toISOString() ?? null,
  });

  return {
    slug: team.slug,
    name: team.name,
    acronym: team.acronym,
    countryCode: team.countryCode,
    logoUrl: team.logoUrl,
    roster: team.stints.filter((s) => !s.endedAt).map(toEntry),
    formerPlayers: team.stints.filter((s) => s.endedAt).map(toEntry),
    upcoming: upcoming.map(toMatchView),
    recent: recent.map(toMatchView),
    record: { wins, losses: finished.length - wins, since: finished[0]?.scheduledAt?.toISOString() ?? null },
    standings: team.standings.map((s) => ({
      stage: s.stage.name,
      tournament: s.stage.tournament.name,
      tournamentSlug: s.stage.tournament.slug,
      rank: s.rank,
    })),
  };
}
