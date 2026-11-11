import Image from "next/image";
import { formatTime } from "@/lib/format";
import type { MatchView, TeamView } from "@/server/queries/matches";

function TeamLogo({ team }: { team: TeamView | null }) {
  if (team?.logoUrl) {
    return <Image src={team.logoUrl} alt="" width={28} height={28} className="size-7 shrink-0 object-contain" />;
  }
  return <span aria-hidden className="size-7 shrink-0 rounded bg-surface-2" />;
}

function TeamName({ team, won, align }: { team: TeamView | null; won: boolean; align: "left" | "right" }) {
  return (
    <span
      className={`flex min-w-0 flex-1 items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}
    >
      <TeamLogo team={team} />
      <span className={`truncate ${team ? "" : "text-muted"} ${won ? "font-semibold" : ""}`}>
        <span className="hidden sm:inline">{team?.name ?? "A definir"}</span>
        <span className="sm:hidden">{team?.acronym ?? team?.name ?? "A definir"}</span>
      </span>
    </span>
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
  if (match.forfeit) {
    return <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted">W.O.</span>;
  }
  return null;
}

export function MatchRow({ match }: { match: MatchView }) {
  return (
    <li className="border-b border-line px-4 py-3 last:border-b-0">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted">
        <StatusBadge match={match} />
        <span className="truncate">
          {match.tournament} · {match.stage}
        </span>
        <span className="ml-auto shrink-0">
          {match.tier !== "UNRANKED" ? `Tier ${match.tier} · ` : ""}MD{match.bestOf}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <TeamName team={match.teamA} won={match.winner === "A"} align="left" />
        <span className="w-20 shrink-0 text-center">
          <Center match={match} />
        </span>
        <TeamName team={match.teamB} won={match.winner === "B"} align="right" />
      </div>
      {match.streamUrl && match.status !== "FINISHED" ? (
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
