import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { MatchStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { DATA_TAG } from "./tags";

export const PAGE_SIZE = 30;
/** Partida agendada que passou disso sem começar sai de "Próximas" (provedor não atualizou). */
const STALE_SCHEDULED_MS = 12 * 3_600_000;

export type MatchTab = "proximas" | "resultados";

export type TeamView = { slug: string; name: string; acronym: string | null; logoUrl: string | null };

export type MatchView = {
  id: string;
  status: MatchStatus;
  scheduledAt: string | null;
  bestOf: number;
  forfeit: boolean;
  streamUrl: string | null;
  teamA: TeamView | null;
  teamB: TeamView | null;
  scoreA: number;
  scoreB: number;
  winner: "A" | "B" | null;
  stage: string;
  tournament: string;
  tournamentSlug: string;
  tier: string;
};

// O site é escuro: quando existe, o logo para fundo escuro substitui o padrão.
const teamColumns = {
  slug: true,
  name: true,
  acronym: true,
  logoUrl: true,
  logoDarkUrl: true,
} satisfies Prisma.TeamSelect;
export const teamSelect = teamColumns;

type TeamRow = Prisma.TeamGetPayload<{ select: typeof teamColumns }>;
export const toTeamView = (t: TeamRow): TeamView => ({
  slug: t.slug,
  name: t.name,
  acronym: t.acronym,
  logoUrl: t.logoDarkUrl ?? t.logoUrl,
});

export const matchSelect = {
  id: true,
  status: true,
  scheduledAt: true,
  bestOf: true,
  forfeit: true,
  streamUrl: true,
  scoreA: true,
  scoreB: true,
  teamAId: true,
  teamBId: true,
  winnerTeamId: true,
  teamA: { select: teamSelect },
  teamB: { select: teamSelect },
  stage: { select: { name: true, tier: true, tournament: { select: { name: true, slug: true } } } },
} satisfies Prisma.MatchSelect;

type Row = Prisma.MatchGetPayload<{ select: typeof matchSelect }>;

export function toMatchView(row: Row): MatchView {
  return {
    id: row.id,
    status: row.status,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    bestOf: row.bestOf,
    forfeit: row.forfeit,
    streamUrl: row.streamUrl,
    teamA: row.teamA && toTeamView(row.teamA),
    teamB: row.teamB && toTeamView(row.teamB),
    scoreA: row.scoreA,
    scoreB: row.scoreB,
    winner:
      row.winnerTeamId === null
        ? null
        : row.winnerTeamId === row.teamAId
          ? "A"
          : row.winnerTeamId === row.teamBId
            ? "B"
            : null,
    stage: row.stage.name,
    tournament: row.stage.tournament.name,
    tournamentSlug: row.stage.tournament.slug,
    tier: row.stage.tier,
  };
}

export type MatchList = { live: MatchView[]; items: MatchView[]; hasNext: boolean };

export async function getMatchList(tab: MatchTab, majorOnly: boolean, page: number): Promise<MatchList> {
  "use cache";
  cacheTag(DATA_TAG);
  cacheLife("minutes");

  const tierFilter: Prisma.MatchWhereInput = majorOnly ? { stage: { tier: { in: ["S", "A"] } } } : {};
  const skip = (page - 1) * PAGE_SIZE;

  if (tab === "resultados") {
    const rows = await db.match.findMany({
      where: { status: "FINISHED", ...tierFilter },
      orderBy: [{ scheduledAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
      skip,
      take: PAGE_SIZE + 1,
      select: matchSelect,
    });
    return { live: [], items: rows.slice(0, PAGE_SIZE).map(toMatchView), hasNext: rows.length > PAGE_SIZE };
  }

  const staleBefore = new Date(Date.now() - STALE_SCHEDULED_MS);
  const [live, rows] = await Promise.all([
    page === 1
      ? db.match.findMany({
          where: { status: "LIVE", ...tierFilter },
          orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { id: "asc" }],
          take: 50,
          select: matchSelect,
        })
      : Promise.resolve([]),
    db.match.findMany({
      where: {
        status: { in: ["SCHEDULED", "POSTPONED"] },
        OR: [{ scheduledAt: null }, { scheduledAt: { gte: staleBefore } }],
        ...tierFilter,
      },
      orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { id: "asc" }],
      skip,
      take: PAGE_SIZE + 1,
      select: matchSelect,
    }),
  ]);

  return {
    live: live.map(toMatchView),
    items: rows.slice(0, PAGE_SIZE).map(toMatchView),
    hasNext: rows.length > PAGE_SIZE,
  };
}

/** Quando os dados foram atualizados pela última vez. Nulo antes da primeira sincronização. */
export async function getLastSync(): Promise<string | null> {
  "use cache";
  cacheTag(DATA_TAG);
  cacheLife("minutes");

  const state = await db.syncState.findUnique({
    where: { source_resource: { source: "PANDASCORE", resource: "MATCHES" } },
    select: { lastSuccessAt: true },
  });
  return state?.lastSuccessAt?.toISOString() ?? null;
}
