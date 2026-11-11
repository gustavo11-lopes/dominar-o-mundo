import Image from "next/image";
import Link from "next/link";
import { formatDay, formatTime } from "@/lib/format";
import type { MatchView, TeamView } from "@/server/queries/matches";
import { AutoRefresh, Score } from "./live-client";
import { StreamEmbed } from "./stream-embed";
import { Tilt } from "./tilt";
import { initials } from "./ui";

/** Camada que se desloca com o ponteiro (definido pelo Tilt) na proporção de `depth`. */
const layer = (depth: number): React.CSSProperties => ({
  transform: `translate3d(calc(var(--px, 0) * ${depth}px), calc(var(--py, 0) * ${depth}px), ${depth}px)`,
  transition: "transform 300ms ease-out",
});

/**
 * Tamanho do nome do time que cabe na coluna sem quebrar palavra no meio:
 * a maior palavra precisa caber na largura do lado (100cqi). Big Shoulders em caixa alta
 * ocupa cerca de 0,5em por letra. Teto de 4.5rem nas telas grandes.
 */
function fitSize(...names: string[]) {
  // Os dois lados usam o mesmo tamanho: o que faz caber a maior palavra entre os dois nomes.
  const longest = Math.max(...names.flatMap((n) => n.split(/\s+/).map((w) => w.length)), 4);
  return `min(4.5rem, calc(100cqi / ${(longest * 0.52).toFixed(2)}))`;
}

function Side({
  team,
  align,
  score,
  dim,
  nameSize,
}: {
  team: TeamView | null;
  align: "left" | "right";
  score: number | null;
  dim: boolean;
  nameSize: string;
}) {
  const right = align === "right";
  return (
    <div
      className={`@container flex min-w-0 flex-1 flex-col gap-4 ${right ? "items-end text-right enter-right" : "items-start enter-left"}`}
    >
      <div style={layer(40)}>
        {team?.logoUrl ? (
          <Image
            src={team.logoUrl}
            alt=""
            width={128}
            height={128}
            priority
            className="size-20 object-contain drop-shadow-[0_0_28px_rgba(255,255,255,0.18)] sm:size-36"
          />
        ) : (
          <span
            aria-hidden
            className="display grid size-20 place-items-center border border-line bg-[radial-gradient(circle_at_30%_25%,var(--surface-2),var(--surface))] text-3xl text-muted chamfer sm:size-36 sm:text-6xl"
          >
            {team ? initials(team.name) : "?"}
          </span>
        )}
      </div>
      <div style={layer(20)} className="min-w-0 max-w-full">
        {team ? (
          <Link
            href={`/times/${team.slug}`}
            style={{ fontSize: nameSize }}
            className={`display block uppercase hover:text-accent ${dim ? "text-muted" : ""}`}
          >
            {team.name}
          </Link>
        ) : (
          <span style={{ fontSize: nameSize }} className="display block uppercase text-muted">
            A definir
          </span>
        )}
      </div>
      {score !== null ? (
        <span style={layer(30)}>
          <Score value={score} className={`display text-7xl tabular-nums sm:text-8xl ${dim ? "text-muted" : ""}`} />
        </span>
      ) : null}
    </div>
  );
}

export function FaceOff({ match, live, backdrop }: { match: MatchView; live: boolean; backdrop: string | null }) {
  const showScore = live || match.status === "FINISHED";
  const nameSize = fitSize(match.teamA?.name ?? "A definir", match.teamB?.name ?? "A definir");
  const when = match.scheduledAt
    ? `${formatDay(match.scheduledAt)}, ${formatTime(match.scheduledAt)}`
    : "Horário a definir";

  return (
    <section aria-labelledby="destaque" className="relative overflow-hidden border-b border-line">
      {live ? <AutoRefresh seconds={30} /> : null}
      {backdrop ? (
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          <Image src={backdrop} alt="" fill priority sizes="100vw" className="backdrop-drift object-cover opacity-45" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,12,16,0.35)_0%,rgba(11,12,16,0.7)_55%,var(--bg)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,12,16,0.75),transparent_35%,transparent_65%,rgba(11,12,16,0.75))]" />
        </div>
      ) : null}
      <div aria-hidden className="arena-floor" />
      <div aria-hidden className="spotlight spotlight-left" />
      <div aria-hidden className="spotlight spotlight-right" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(60%_80%_at_50%_0%,color-mix(in_oklab,var(--accent)_30%,transparent),transparent)]"
      />
      <div className="relative mx-auto max-w-6xl px-4 pt-10 pb-14 sm:pt-14 sm:pb-20">
        <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {live ? (
            <span className="inline-flex items-center gap-2 bg-live px-2.5 py-1 font-semibold text-white chamfer-sm">
              <span aria-hidden className="live-dot size-2 rounded-full bg-white text-white" />
              Ao vivo agora
            </span>
          ) : (
            <span className="bg-text px-2.5 py-1 font-semibold text-bg chamfer-sm">Próximo destaque</span>
          )}
          <Link href={`/campeonatos/${match.tournamentSlug}`} id="destaque" className="text-text/85 hover:text-text">
            {match.tournament}, {match.stage}
          </Link>
        </div>

        <Tilt>
          <div className="flex items-start gap-4 sm:items-center sm:gap-8">
            <Side
              nameSize={nameSize}
              team={match.teamA}
              align="left"
              score={showScore ? match.scoreA : null}
              dim={match.winner === "B"}
            />
            <div style={layer(60)} className="ignite flex shrink-0 flex-col items-center gap-2 self-center">
              <span className="neon display text-5xl text-accent italic sm:text-8xl" aria-label="contra">
                VS
              </span>
              <span className="text-xs text-muted">MD{match.bestOf}</span>
            </div>
            <Side
              nameSize={nameSize}
              team={match.teamB}
              align="right"
              score={showScore ? match.scoreB : null}
              dim={match.winner === "A"}
            />
          </div>
        </Tilt>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <p className="text-text/85">
            {live
              ? "A série está em andamento."
              : `Começa ${when.charAt(0).toLowerCase()}${when.slice(1)}, horário de Brasília.`}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {live && match.streamEmbedUrl ? (
              <StreamEmbed
                embedUrl={match.streamEmbedUrl}
                title={`Transmissão: ${match.teamA?.name ?? "A definir"} contra ${match.teamB?.name ?? "A definir"}`}
              />
            ) : null}
            {match.streamUrl && match.status !== "FINISHED" ? (
              <a
                href={match.streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-accent px-5 py-2.5 font-semibold text-white chamfer-sm hover:brightness-110"
              >
                {live ? "Abrir na plataforma" : "Assistir transmissão"}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
