import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Prisma, Tier } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { matchSelect, teamSelect, toMatchView, toTeamView, type MatchView, type TeamView } from "./matches";
import { DATA_TAG } from "./tags";

export type TournamentTab = "atuais" | "proximos" | "encerrados";
export const TOURNAMENTS_PAGE_SIZE = 24;

export type TournamentCard = {
  slug: string;
  name: string;
  league: string;
  leagueImageUrl: string | null;
  beginAt: string | null;
  endAt: string | null;
  /** Maior tier entre as fases. */
  tier: Tier;
  regions: string[];
  /** Premiação como publicada pelo provedor, de cada fase que divulgou. */
  prizePools: string[];
};

const TIER_ORDER: Tier[] = ["S", "A", "B", "C", "D", "UNRANKED"];

const cardSelect = {
  slug: true,
  name: true,
  beginAt: true,
  endAt: true,
  league: { select: { name: true, imageUrl: true } },
  stages: { select: { tier: true, prizePool: true, region: { select: { name: true } } } },
} satisfies Prisma.TournamentSelect;

type CardRow = Prisma.TournamentGetPayload<{ select: typeof cardSelect }>;

function toCard(t: CardRow): TournamentCard {
  const tiers = t.stages.map((s) => s.tier);
  return {
    slug: t.slug,
    name: t.name,
    league: t.league.name,
    leagueImageUrl: t.league.imageUrl,
    beginAt: t.beginAt?.toISOString() ?? null,
    endAt: t.endAt?.toISOString() ?? null,
    tier: TIER_ORDER.find((tier) => tiers.includes(tier)) ?? "UNRANKED",
    regions: [...new Set(t.stages.flatMap((s) => (s.region ? [s.region.name] : [])))],
    prizePools: [...new Set(t.stages.flatMap((s) => (s.prizePool ? [s.prizePool] : [])))],
  };
}

export async function getTournamentList(
  tab: TournamentTab,
  page: number,
): Promise<{ items: TournamentCard[]; hasNext: boolean }> {
  "use cache";
  cacheTag(DATA_TAG);
  cacheLife("minutes");

  const now = new Date();
  const where: Prisma.TournamentWhereInput =
    tab === "atuais"
      ? { beginAt: { lte: now }, OR: [{ endAt: null }, { endAt: { gte: now } }] }
      : tab === "proximos"
        ? { OR: [{ beginAt: { gt: now } }, { beginAt: null }] }
        : { endAt: { lt: now } };
  const orderBy: Prisma.TournamentOrderByWithRelationInput[] =
    tab === "encerrados"
      ? [{ endAt: { sort: "desc", nulls: "last" } }, { id: "desc" }]
      : [{ beginAt: { sort: "asc", nulls: "last" } }, { id: "asc" }];

  const rows = await db.tournament.findMany({
    where,
    orderBy,
    skip: (page - 1) * TOURNAMENTS_PAGE_SIZE,
    take: TOURNAMENTS_PAGE_SIZE + 1,
    select: cardSelect,
  });
  return { items: rows.slice(0, TOURNAMENTS_PAGE_SIZE).map(toCard), hasNext: rows.length > TOURNAMENTS_PAGE_SIZE };
}

export type StageDetail = {
  slug: string;
  name: string;
  tier: Tier;
  region: string | null;
  prizePool: string | null;
  beginAt: string | null;
  endAt: string | null;
  winner: TeamView | null;
  standings: {
    team: TeamView;
    rank: number;
    wins: number | null;
    losses: number | null;
    mapWins: number | null;
    mapLosses: number | null;
  }[];
  matches: MatchView[];
};

export type TournamentDetail = TournamentCard & { stages: StageDetail[] };

export async function getTournament(slug: string): Promise<TournamentDetail | null> {
  "use cache";
  cacheTag(DATA_TAG);
  cacheLife("minutes");

  const t = await db.tournament.findUnique({
    where: { slug },
    select: {
      ...cardSelect,
      stages: {
        orderBy: [{ beginAt: { sort: "asc", nulls: "last" } }, { name: "asc" }],
        select: {
          slug: true,
          name: true,
          tier: true,
          prizePool: true,
          beginAt: true,
          endAt: true,
          region: { select: { name: true } },
          winner: { select: teamSelect },
          standings: {
            orderBy: [{ rank: "asc" }, { team: { name: "asc" } }],
            select: {
              rank: true,
              wins: true,
              losses: true,
              mapWins: true,
              mapLosses: true,
              team: { select: teamSelect },
            },
          },
          matches: {
            orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { id: "asc" }],
            take: 100,
            select: matchSelect,
          },
        },
      },
    },
  });
  if (!t) return null;

  return {
    ...toCard(t),
    stages: t.stages.map((s) => ({
      slug: s.slug,
      name: s.name,
      tier: s.tier,
      region: s.region?.name ?? null,
      prizePool: s.prizePool,
      beginAt: s.beginAt?.toISOString() ?? null,
      endAt: s.endAt?.toISOString() ?? null,
      winner: s.winner && toTeamView(s.winner),
      standings: s.standings.map((row) => ({ ...row, team: toTeamView(row.team) })),
      matches: s.matches.map(toMatchView),
    })),
  };
}
