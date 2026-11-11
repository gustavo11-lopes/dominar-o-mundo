import type { MapStatus, MatchStatus, Tier } from "@/generated/prisma/enums";
import type { PsMatch, PsPlayer, PsStanding, PsTeam } from "./schemas";

// Conversão pura do formato da PandaScore para o nosso. Sem banco, sem rede: testável isoladamente.
// Hierarquia: league (circuito) -> serie (nosso Tournament) -> tournament (nossa Stage) -> match.

export type TeamInput = {
  externalId: string;
  slug: string;
  name: string;
  acronym: string | null;
  countryCode: string | null;
  logoUrl: string | null;
  logoDarkUrl: string | null;
};

export type MatchInput = {
  league: { externalId: string; slug: string; name: string; imageUrl: string | null };
  tournament: {
    externalId: string;
    slug: string;
    name: string;
    beginAt: Date | null;
    endAt: Date | null;
  };
  stage: {
    externalId: string;
    slug: string;
    name: string;
    tier: Tier;
    regionCode: string | null;
    prizePool: string | null;
    beginAt: Date | null;
    endAt: Date | null;
    winnerExternalId: string | null;
  };
  teamA: TeamInput | null;
  teamB: TeamInput | null;
  match: {
    externalId: string;
    name: string;
    status: MatchStatus;
    scheduledAt: Date | null;
    beginAt: Date | null;
    endAt: Date | null;
    bestOf: number;
    scoreA: number;
    scoreB: number;
    winnerExternalId: string | null;
    forfeit: boolean;
    streamUrl: string | null;
    streamEmbedUrl: string | null;
  };
  maps: {
    externalId: string;
    position: number;
    status: MapStatus;
    winnerExternalId: string | null;
    beginAt: Date | null;
    endAt: Date | null;
  }[];
};

export class UnsupportedRecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedRecordError";
  }
}

const MATCH_STATUS: Record<string, MatchStatus> = {
  not_started: "SCHEDULED",
  running: "LIVE",
  finished: "FINISHED",
  canceled: "CANCELED",
  postponed: "POSTPONED",
};

const MAP_STATUS: Record<string, MapStatus> = {
  not_started: "SCHEDULED",
  running: "LIVE",
  finished: "FINISHED",
  not_played: "NOT_PLAYED",
};

const TIER: Record<string, Tier> = { s: "S", a: "A", b: "B", c: "C", d: "D" };

const date = (value: string | null) => (value ? new Date(value) : null);
const blankToNull = (value: string | null) => (value && value.trim() ? value.trim() : null);

function countryCode(location: string | null): string | null {
  const code = location?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) ? code : null;
}

export function mapTeam(team: PsTeam): TeamInput {
  return {
    externalId: String(team.id),
    slug: team.slug ?? `team-${team.id}`,
    name: team.name.trim(),
    acronym: blankToNull(team.acronym),
    countryCode: countryCode(team.location),
    logoUrl: team.image_url,
    logoDarkUrl: team.dark_mode_image_url ?? null,
  };
}

function teamWinner(id: number | null, type: string | null): string | null {
  return id !== null && type === "Team" ? String(id) : null;
}

export function mapMatch(m: PsMatch): MatchInput {
  const status = MATCH_STATUS[m.status];
  if (!status) throw new UnsupportedRecordError(`partida ${m.id}: status desconhecido "${m.status}"`);
  if (m.number_of_games < 1) {
    throw new UnsupportedRecordError(`partida ${m.id}: number_of_games inválido (${m.number_of_games})`);
  }
  if (m.opponents.some((o) => o.type !== "Team")) {
    throw new UnsupportedRecordError(`partida ${m.id}: adversário que não é time`);
  }
  if (m.opponents.length > 2) {
    throw new UnsupportedRecordError(`partida ${m.id}: ${m.opponents.length} adversários`);
  }

  const [a, b] = m.opponents.map((o) => mapTeam(o.opponent));
  const score = (team: TeamInput | undefined) =>
    team ? (m.results.find((r) => String(r.team_id) === team.externalId)?.score ?? 0) : 0;

  const winner = teamWinner(m.winner_id, m.winner_type);
  const participants = [a?.externalId, b?.externalId];
  if (winner && !participants.includes(winner)) {
    throw new UnsupportedRecordError(`partida ${m.id}: vencedor ${winner} não está entre os adversários`);
  }

  const stream = m.streams_list.find((s) => s.main) ?? m.streams_list[0];

  return {
    league: {
      externalId: String(m.league.id),
      slug: m.league.slug,
      name: m.league.name,
      imageUrl: m.league.image_url,
    },
    tournament: {
      externalId: String(m.serie.id),
      slug: m.serie.slug,
      name: blankToNull(m.serie.full_name) ?? blankToNull(m.serie.name) ?? m.league.name,
      beginAt: date(m.serie.begin_at),
      endAt: date(m.serie.end_at),
    },
    stage: {
      externalId: String(m.tournament.id),
      slug: m.tournament.slug,
      name: m.tournament.name,
      tier: (m.tournament.tier && TIER[m.tournament.tier.toLowerCase()]) || "UNRANKED",
      regionCode: blankToNull(m.tournament.region)?.toUpperCase() ?? null,
      prizePool: blankToNull(m.tournament.prizepool),
      beginAt: date(m.tournament.begin_at),
      endAt: date(m.tournament.end_at),
      winnerExternalId: teamWinner(m.tournament.winner_id, m.tournament.winner_type),
    },
    teamA: a ?? null,
    teamB: b ?? null,
    match: {
      externalId: String(m.id),
      name: m.name,
      status,
      scheduledAt: date(m.scheduled_at),
      beginAt: date(m.begin_at),
      endAt: date(m.end_at),
      bestOf: m.number_of_games,
      scoreA: score(a),
      scoreB: score(b),
      winnerExternalId: winner,
      forfeit: m.forfeit,
      streamUrl: stream?.raw_url ?? null,
      streamEmbedUrl: stream?.embed_url ?? null,
    },
    maps: m.games.map((g) => {
      const mapStatus = MAP_STATUS[g.status];
      if (!mapStatus) throw new UnsupportedRecordError(`mapa ${g.id}: status desconhecido "${g.status}"`);
      return {
        externalId: String(g.id),
        position: g.position,
        status: mapStatus,
        winnerExternalId: teamWinner(g.winner?.id ?? null, g.winner?.type ?? null),
        beginAt: date(g.begin_at),
        endAt: date(g.end_at),
      };
    }),
  };
}

export type PlayerInput = {
  externalId: string;
  slug: string;
  handle: string;
  firstName: string | null;
  lastName: string | null;
  countryCode: string | null;
  imageUrl: string | null;
};

export function mapPlayer(p: PsPlayer): PlayerInput {
  return {
    externalId: String(p.id),
    slug: p.slug ?? `player-${p.id}`,
    handle: p.name.trim(),
    firstName: blankToNull(p.first_name),
    lastName: blankToNull(p.last_name),
    countryCode: countryCode(p.nationality),
    imageUrl: p.image_url,
  };
}

export type StandingInput = {
  team: TeamInput;
  rank: number;
  wins: number | null;
  losses: number | null;
  mapWins: number | null;
  mapLosses: number | null;
};

export function mapStanding(s: PsStanding): StandingInput {
  return {
    team: mapTeam(s.team),
    rank: s.rank,
    wins: s.wins ?? null,
    losses: s.losses ?? null,
    mapWins: s.game_wins ?? null,
    mapLosses: s.game_losses ?? null,
  };
}

/** Nomes legíveis para os códigos de região que a PandaScore usa. Código desconhecido vira o próprio nome. */
const REGION_NAMES: Record<string, string> = {
  NA: "América do Norte",
  SA: "América do Sul",
  LAT: "América Latina",
  WEU: "Europa Ocidental",
  EEU: "Europa Oriental",
  ME: "Oriente Médio",
  ASIA: "Ásia",
  OCE: "Oceania",
  AF: "África",
};

export function regionName(code: string): string {
  return REGION_NAMES[code] ?? code;
}
