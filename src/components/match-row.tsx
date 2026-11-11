import Link from "next/link";
import { formatDayMonth, formatTime } from "@/lib/format";
import type { MatchView, TeamView } from "@/server/queries/matches";
import { Logo } from "./ui";

/*
  A linha se adapta à largura da lista, não da tela (container query):
  - estreita (celular, colunas da home): placar empilhado, um time por linha, nome inteiro;
  - larga (@xl): confronto lado a lado, placar no centro.
*/

type Side = "A" | "B";

const hasScore = (m: MatchView) => m.status === "FINISHED" || m.status === "LIVE";
const loserTone = (m: MatchView, side: Side) => (m.winner && m.winner !== side ? "text-muted" : "");

function TeamLabel({ team, won }: { team: TeamView | null; won: boolean }) {
  return (
    <span className={`truncate ${team ? "" : "text-muted"} ${won ? "font-semibold" : ""}`}>
      {team?.name ?? "A definir"}
    </span>
  );
}

function TeamLink({
  team,
  className,
  children,
}: {
  team: TeamView | null;
  className: string;
  children: React.ReactNode;
}) {
  return team ? (
    <Link href={`/times/${team.slug}`} className={`${className} hover:text-accent`}>
      {children}
    </Link>
  ) : (
    <span className={className}>{children}</span>
  );
}

/** Formato empilhado: cada time numa linha, com o placar à direita. */
function Stacked({ match }: { match: MatchView }) {
  const line = (side: Side) => {
    const team = side === "A" ? match.teamA : match.teamB;
    const score = side === "A" ? match.scoreA : match.scoreB;
    return (
      <div className="flex items-center gap-3">
        <TeamLink team={team} className="flex min-w-0 flex-1 items-center gap-2.5">
          <Logo src={team?.logoUrl ?? null} size={24} />
          <TeamLabel team={team} won={match.winner === side} />
        </TeamLink>
        {hasScore(match) ? (
          <span className={`display w-6 text-right text-2xl tabular-nums ${loserTone(match, side)}`}>{score}</span>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex items-center gap-4 @xl:hidden">
      <div className="min-w-0 flex-1 space-y-2">
        {line("A")}
        {line("B")}
      </div>
      {!hasScore(match) ? (
        <span className="display shrink-0 border-l border-line pl-4 text-xl text-muted">
          {match.scheduledAt ? formatTime(match.scheduledAt) : "--:--"}
        </span>
      ) : null}
    </div>
  );
}

/** Formato lado a lado: time A, placar ou horário, time B. */
function SideBySide({ match }: { match: MatchView }) {
  return (
    <div className="hidden items-center gap-3 @xl:flex">
      <TeamLink team={match.teamA} className="flex min-w-0 flex-1 items-center gap-2">
        <Logo src={match.teamA?.logoUrl ?? null} />
        <TeamLabel team={match.teamA} won={match.winner === "A"} />
      </TeamLink>
      <span className="w-24 shrink-0 text-center">
        {hasScore(match) ? (
          <span className="display text-2xl tabular-nums" aria-label={`Placar ${match.scoreA} a ${match.scoreB}`}>
            <span className={loserTone(match, "A")}>{match.scoreA}</span>
            <span className="mx-1.5 text-muted">:</span>
            <span className={loserTone(match, "B")}>{match.scoreB}</span>
          </span>
        ) : (
          <span className="display text-xl text-muted">
            {match.scheduledAt ? formatTime(match.scheduledAt) : "--:--"}
          </span>
        )}
      </span>
      <TeamLink team={match.teamB} className="flex min-w-0 flex-1 flex-row-reverse items-center gap-2 text-right">
        <Logo src={match.teamB?.logoUrl ?? null} />
        <TeamLabel team={match.teamB} won={match.winner === "B"} />
      </TeamLink>
    </div>
  );
}

function StatusBadge({ match }: { match: MatchView }) {
  if (match.status === "LIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 bg-live px-1.5 py-0.5 text-xs font-semibold text-white">
        <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-white" />
        Ao vivo
      </span>
    );
  }
  const label =
    match.status === "POSTPONED" ? "Adiada" : match.status === "CANCELED" ? "Cancelada" : match.forfeit ? "W.O." : null;
  return label ? <span className="tag text-muted">{label}</span> : null;
}

/**
 * Linha de partida. `context` controla o cabeçalho: "full" mostra campeonato e fase;
 * "stage" (dentro da página do campeonato) omite, porque a página já diz qual é.
 */
export function MatchRow({
  match,
  showDate = false,
  context = "full",
}: {
  match: MatchView;
  showDate?: boolean;
  context?: "full" | "stage";
}) {
  const live = match.status === "LIVE";
  return (
    <li className={`border-b border-line px-4 py-3 last:border-b-0 ${live ? "border-l-2 border-l-live" : ""}`}>
      <div className="mb-2.5 flex items-center gap-2 text-xs text-muted">
        <StatusBadge match={match} />
        {showDate && match.scheduledAt ? <span className="shrink-0">{formatDayMonth(match.scheduledAt)}</span> : null}
        {context === "full" ? (
          <Link href={`/campeonatos/${match.tournamentSlug}`} className="min-w-0 truncate hover:text-text">
            {match.tournament}, {match.stage}
          </Link>
        ) : null}
        <span className="ml-auto shrink-0">
          {context === "full" && match.tier !== "UNRANKED" ? `Tier ${match.tier}, ` : ""}MD{match.bestOf}
        </span>
      </div>
      <Stacked match={match} />
      <SideBySide match={match} />
      {match.streamUrl && (live || match.status === "SCHEDULED") ? (
        <a
          href={match.streamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2.5 inline-block text-xs text-accent hover:underline"
        >
          Assistir transmissão ↗
        </a>
      ) : null}
    </li>
  );
}

export function MatchList({
  matches,
  showDate,
  context,
}: {
  matches: MatchView[];
  showDate?: boolean;
  context?: "full" | "stage";
}) {
  return (
    <ul className="@container panel">
      {matches.map((m) => (
        <MatchRow key={m.id} match={m} showDate={showDate} context={context} />
      ))}
    </ul>
  );
}
