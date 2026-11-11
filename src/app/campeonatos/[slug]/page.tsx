import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MatchList } from "@/components/match-row";
import { ListSkeleton, Logo, Reveal, SkeletonExit } from "@/components/ui";
import { formatRange } from "@/lib/format";
import { HeroHeader } from "@/components/hero-header";
import { getBackdrops, pickBackdrop } from "@/server/queries/maps";
import { getTournament, type StageDetail } from "@/server/queries/tournaments";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const t = await getTournament((await params).slug);
  return t ? { title: t.name, description: `Fases, classificação e partidas de ${t.name}.` } : {};
}

function Standings({ stage }: { stage: StageDetail }) {
  if (!stage.standings.length) return null;
  const hasRecord = stage.standings.some((s) => s.wins !== null);

  return (
    <div className="overflow-x-auto panel">
      <table className="w-full text-sm">
        <caption className="sr-only">Classificação de {stage.name}</caption>
        <thead className="text-xs text-muted">
          <tr className="border-b border-line">
            <th scope="col" className="w-10 px-4 py-2 text-left font-normal">
              #
            </th>
            <th scope="col" className="px-2 py-2 text-left font-normal">
              Time
            </th>
            {hasRecord ? (
              <>
                <th scope="col" className="px-2 py-2 text-right font-normal">
                  <abbr title="Vitórias em séries">V</abbr>
                </th>
                <th scope="col" className="px-2 py-2 text-right font-normal">
                  <abbr title="Derrotas em séries">D</abbr>
                </th>
                <th scope="col" className="px-4 py-2 text-right font-normal">
                  Mapas
                </th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {stage.standings.map((s) => (
            <tr key={s.team.slug} className="border-b border-line last:border-b-0">
              <td className="px-4 py-2 display text-lg tabular-nums">{s.rank}</td>
              <td className="px-2 py-2">
                <Link href={`/times/${s.team.slug}`} className="flex items-center gap-2 hover:text-accent">
                  <Logo src={s.team.logoUrl} name={s.team.name} size={20} />
                  <span className="truncate">{s.team.name}</span>
                </Link>
              </td>
              {hasRecord ? (
                <>
                  <td className="px-2 py-2 text-right tabular-nums">{s.wins ?? "–"}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{s.losses ?? "–"}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted">
                    {s.mapWins !== null && s.mapLosses !== null ? `${s.mapWins}–${s.mapLosses}` : "–"}
                  </td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function TournamentContent({ params }: { params: Params }) {
  const [t, backdrops] = await Promise.all([getTournament((await params).slug), getBackdrops()]);
  if (!t) notFound();

  return (
    <>
      <HeroHeader
        backdrop={pickBackdrop(t.slug, backdrops)}
        emblem={<Logo src={t.leagueImageUrl} name={t.league} size={96} />}
        title={t.name}
      >
        <p>
          {t.league} · {formatRange(t.beginAt, t.endAt)}
        </p>
        {t.prizePools.length ? <p className="mt-1">Premiação divulgada: {t.prizePools.join(" + ")}</p> : null}
      </HeroHeader>

      {t.stages.length > 1 ? (
        <nav aria-label="Fases" className="mb-8 flex flex-wrap gap-1">
          {t.stages.map((s) => (
            <a
              key={s.slug}
              href={`#${s.slug}`}
              className="chamfer-sm px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-text"
            >
              {s.name}
            </a>
          ))}
        </nav>
      ) : null}

      <div className="space-y-12">
        {t.stages.map((s) => (
          <section key={s.slug} id={s.slug} aria-labelledby={`${s.slug}-titulo`} className="scroll-mt-6">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 id={`${s.slug}-titulo`} className="section-title">
                {s.name}
              </h2>
              <span className="text-sm text-muted">
                {formatRange(s.beginAt, s.endAt)}
                {s.tier !== "UNRANKED" ? ` · Tier ${s.tier}` : ""}
                {s.region ? ` · ${s.region}` : ""}
              </span>
            </div>
            {s.winner ? (
              <p className="mb-3 flex items-center gap-2 text-sm">
                <span className="text-muted">Campeão:</span>
                <Link
                  href={`/times/${s.winner.slug}`}
                  className="flex items-center gap-1.5 font-medium hover:text-accent"
                >
                  <Logo src={s.winner.logoUrl} name={s.winner.name} size={20} />
                  {s.winner.name}
                </Link>
              </p>
            ) : null}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              {s.standings.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-muted">Classificação</h3>
                  <Standings stage={s} />
                </div>
              ) : null}
              <div className={s.standings.length ? "" : "lg:col-span-2"}>
                <h3 className="mb-2 text-sm font-semibold text-muted">Partidas</h3>
                {s.matches.length ? (
                  <MatchList matches={s.matches} showDate context="stage" />
                ) : (
                  <p className="text-sm text-muted">Nenhuma partida registrada nesta fase.</p>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

export default function TournamentPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Suspense
        fallback={
          <SkeletonExit>
            <ListSkeleton />
          </SkeletonExit>
        }
      >
        <Reveal>
          <TournamentContent params={params} />
        </Reveal>
      </Suspense>
    </main>
  );
}
