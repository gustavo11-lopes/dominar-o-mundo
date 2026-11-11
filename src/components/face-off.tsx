import Image from "next/image";
import Link from "next/link";
import { formatDay, formatTime } from "@/lib/format";
import type { MatchView, TeamView } from "@/server/queries/matches";
import { Tilt } from "./tilt";

/** Camada que se desloca com o ponteiro (definido pelo Tilt) na proporção de `depth`. */
const layer = (depth: number): React.CSSProperties => ({
  transform: `translate3d(calc(var(--px, 0) * ${depth}px), calc(var(--py, 0) * ${depth}px), ${depth}px)`,
  transition: "transform 300ms ease-out",
});

function Side({
  team,
  align,
  score,
  dim,
}: {
  team: TeamView | null;
  align: "left" | "right";
  score: number | null;
  dim: boolean;
}) {
  const right = align === "right";
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col gap-4 ${right ? "items-end text-right enter-right" : "items-start enter-left"}`}
    >
      <div style={layer(40)}>
        {team?.logoUrl ? (
          <Image
            src={team.logoUrl}
            alt=""
            width={128}
            height={128}
            priority
            className="size-20 object-contain drop-shadow-[0_12px_30px_rgba(0,0,0,0.7)] sm:size-32"
          />
        ) : (
          <span aria-hidden className="block size-20 bg-surface-2 chamfer sm:size-32" />
        )}
      </div>
      <div style={layer(20)} className="min-w-0 max-w-full">
        {team ? (
          <Link
            href={`/times/${team.slug}`}
            className={`display block text-3xl break-words uppercase hover:text-accent sm:text-6xl lg:text-7xl ${dim ? "text-muted" : ""}`}
          >
            {team.name}
          </Link>
        ) : (
          <span className="display text-3xl uppercase text-muted sm:text-6xl">A definir</span>
        )}
      </div>
      {score !== null ? (
        <span style={layer(30)} className={`display text-7xl tabular-nums sm:text-8xl ${dim ? "text-muted" : ""}`}>
          {score}
        </span>
      ) : null}
    </div>
  );
}

export function FaceOff({ match, live }: { match: MatchView; live: boolean }) {
  const showScore = live || match.status === "FINISHED";
  const when = match.scheduledAt
    ? `${formatDay(match.scheduledAt)}, ${formatTime(match.scheduledAt)}`
    : "Horário a definir";

  return (
    <section aria-labelledby="destaque" className="relative overflow-hidden border-b border-line">
      <div aria-hidden className="arena-floor" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(60%_80%_at_50%_0%,color-mix(in_oklab,var(--accent)_22%,transparent),transparent)]"
      />
      <div className="relative mx-auto max-w-6xl px-4 pt-10 pb-14 sm:pt-14 sm:pb-20">
        <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {live ? (
            <span className="inline-flex items-center gap-2 bg-live px-2.5 py-1 font-semibold text-white chamfer-sm">
              <span aria-hidden className="size-2 animate-pulse rounded-full bg-white" />
              Ao vivo agora
            </span>
          ) : (
            <span className="bg-surface-2 px-2.5 py-1 font-medium chamfer-sm">Próximo destaque</span>
          )}
          <Link href={`/campeonatos/${match.tournamentSlug}`} id="destaque" className="text-muted hover:text-text">
            {match.tournament}, {match.stage}
          </Link>
        </div>

        <Tilt>
          <div className="flex items-start gap-4 sm:items-center sm:gap-8">
            <Side team={match.teamA} align="left" score={showScore ? match.scoreA : null} dim={match.winner === "B"} />
            <div style={layer(60)} className="ignite flex shrink-0 flex-col items-center gap-2 self-center">
              <span className="display text-5xl text-accent italic sm:text-7xl" aria-label="contra">
                VS
              </span>
              <span className="text-xs text-muted">MD{match.bestOf}</span>
            </div>
            <Side team={match.teamB} align="right" score={showScore ? match.scoreB : null} dim={match.winner === "A"} />
          </div>
        </Tilt>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <p className="text-muted">
            {live
              ? "A série está em andamento."
              : `Começa ${when.charAt(0).toLowerCase()}${when.slice(1)}, horário de Brasília.`}
          </p>
          {match.streamUrl && match.status !== "FINISHED" ? (
            <a
              href={match.streamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-accent px-5 py-2.5 font-semibold text-white chamfer-sm hover:brightness-110"
            >
              Assistir transmissão
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
