import Link from "next/link";
import { formatDayMonth, formatTime } from "@/lib/format";
import type { MatchView, TeamView } from "@/server/queries/matches";
import { Logo } from "./ui";

function TeamName({ team, won, align }: { team: TeamView | null; won: boolean; align: "left" | "right" }) {
  const body = (
    <>
      <Logo src={team?.logoUrl ?? null} />
      <span className={`truncate ${team ? "" : "text-muted"} ${won ? "font-semibold" : ""}`}>
        <span className="hidden sm:inline">{team?.name ?? "A definir"}</span>
        <span className="sm:hidden">{team?.acronym ?? team?.name ?? "A definir"}</span>
      </span>
    </>
  );
  const cls = `flex min-w-0 flex-1 items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`;
  return team ? (
    <Link href={`/times/${team.slug}`} className={`${cls} hover:text-accent`}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}

function Center({ match }: { match: MatchView }) {
  if (match.status === "FINISHED" || match.status === "LIVE") {
    const tone = (side: "A" | "B") => (match.winner && match.winner !== side ? "text-muted" : "");
    return (
      <span className="font-mono text-lg tabular-nums" aria-label={`Placar ${match.scoreA} a ${match.scoreB}`}>
        <span className={tone("A")}>{match.scoreA}</span>
        <span className="mx-1.5 text-muted">:</span>
        <span className={tone("B")}>{match.scoreB}</span>
      </span>
    );
  }
  return (
    <span className="font-mono text-sm text-muted">{match.scheduledAt ? formatTime(match.scheduledAt) : "--:--"}</span>
  );
}

function StatusBadge({ match }: { match: MatchView }) {
  if (match.status === "LIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded bg-live/15 px-1.5 py-0.5 text-xs font-semibold text-live">
        <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-live" />
        AO VIVO
      </span>
    );
  }
  if (match.status === "POSTPONED") {
    return <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted">Adiada</span>;
  }
  if (match.status === "CANCELED") {
    return <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted">Cancelada</span>;
  }
  if (match.forfeit) {
    return <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted">W.O.</span>;
  }
  return null;
}

/**
 * Linha de partida. `context` controla o cabeçalho: "full" mostra campeonato e fase;
 * "stage" (dentro da página do campeonato) mostra só a data.
 */
export function MatchRow({ match, showDate = false, context = "full" }: { match: MatchView; showDate?: boolean; context?: "full" | "stage" }) {
  return (
    <li className="border-b border-line px-4 py-3 last:border-b-0">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted">
        <StatusBadge match={match} />
        {showDate && match.scheduledAt ? (
          <span className="shrink-0">{formatDayMonth(match.scheduledAt)}</span>
        ) : null}
        {context === "full" ? (
          <Link href={`/campeonatos/${match.tournamentSlug}`} className="truncate hover:text-text">
            {match.tournament} · {match.stage}
          </Link>
        ) : null}
        <span className="ml-auto shrink-0">
          {context === "full" && match.tier !== "UNRANKED" ? `Tier ${match.tier} · ` : ""}MD{match.bestOf}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <TeamName team={match.teamA} won={match.winner === "A"} align="left" />
        <span className="w-20 shrink-0 text-center">
          <Center match={match} />
        </span>
        <TeamName team={match.teamB} won={match.winner === "B"} align="right" />
      </div>
      {match.streamUrl && (match.status === "LIVE" || match.status === "SCHEDULED") ? (
        <a
          href={match.streamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-accent hover:underline"
        >
          Assistir transmissão ↗
        </a>
      ) : null}
    </li>
  );
}

export function MatchList({ matches, showDate, context }: { matches: MatchView[]; showDate?: boolean; context?: "full" | "stage" }) {
  return (
    <ul className="rounded-lg border border-line bg-surface">
      {matches.map((m) => (
        <MatchRow key={m.id} match={m} showDate={showDate} context={context} />
      ))}
    </ul>
  );
}
