import Link from "next/link";
import { Suspense } from "react";
import { FaceOff } from "@/components/face-off";
import { MatchList } from "@/components/match-row";
import { Empty, ListSkeleton, Logo } from "@/components/ui";
import { formatRange } from "@/lib/format";
import { getHomeData } from "@/server/queries/home";
import { getBackdrops, pickBackdrop } from "@/server/queries/maps";

function SectionHead({ id, title, href, linkLabel }: { id: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <h2 id={id} className="section-title">
        {title}
      </h2>
      {href ? (
        <Link href={href} className="text-sm text-muted hover:text-text">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

async function Home() {
  const [data, backdrops] = await Promise.all([getHomeData(), getBackdrops()]);

  return (
    <>
      {data.featured ? (
        <FaceOff match={data.featured} live={data.featured.live} backdrop={pickBackdrop(data.featured.id, backdrops)} />
      ) : (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <h1 className="display text-6xl uppercase">VALORANT competitivo</h1>
          <p className="mt-3 text-muted">Nenhuma partida marcada para os próximos dias.</p>
        </section>
      )}
      <h1 className="sr-only">esports-hub: VALORANT competitivo</h1>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-12">
        {data.live.length ? (
          <section aria-labelledby="ao-vivo" className="reveal">
            <SectionHead id="ao-vivo" title="Também ao vivo" />
            <MatchList matches={data.live} />
          </section>
        ) : null}

        <div className="grid gap-10 lg:grid-cols-2 [&>*]:min-w-0">
          <section aria-labelledby="proximas" className="reveal">
            <SectionHead id="proximas" title="Próximas" href="/partidas" linkLabel="Agenda completa" />
            {data.upcoming.length ? (
              <MatchList matches={data.upcoming} showDate />
            ) : (
              <Empty>Nenhuma partida marcada.</Empty>
            )}
          </section>
          <section aria-labelledby="resultados" className="reveal">
            <SectionHead
              id="resultados"
              title="Resultados"
              href="/partidas?aba=resultados"
              linkLabel="Todos os resultados"
            />
            {data.results.length ? (
              <MatchList matches={data.results} showDate />
            ) : (
              <Empty>Nenhum resultado ainda.</Empty>
            )}
          </section>
        </div>

        {data.tournaments.length ? (
          <section aria-labelledby="campeonatos" className="reveal">
            <SectionHead id="campeonatos" title="Em andamento" href="/campeonatos" linkLabel="Todos os campeonatos" />
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.tournaments.map((t) => (
                <li key={t.slug}>
                  <Link href={`/campeonatos/${t.slug}`} className="flex h-full flex-col gap-3 panel-link p-4 chamfer">
                    <Logo src={t.leagueImageUrl} name={t.league} size={36} />
                    <span className="display text-2xl uppercase">{t.name}</span>
                    <span className="mt-auto text-xs text-muted">
                      {formatRange(t.beginAt, t.endAt)}
                      {t.tier !== "UNRANKED" ? `, tier ${t.tier}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {data.activeTeams.length ? (
          <section aria-labelledby="times" className="reveal">
            <SectionHead id="times" title="Mais ativos no mês" href="/times" linkLabel="Todos os times" />
            <p className="-mt-1 mb-4 text-sm text-muted">Times com mais séries disputadas nos últimos 30 dias.</p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {data.activeTeams.map((t) => (
                <li key={t.slug}>
                  <Link href={`/times/${t.slug}`} className="flex h-full items-center gap-3 panel-link p-3">
                    <Logo src={t.logoUrl} name={t.name} size={36} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{t.name}</span>
                      <span className="block text-xs text-muted tabular-nums">
                        {t.wins} vitórias, {t.losses} derrotas
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}

function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="h-[420px] border-b border-line bg-surface/40" />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <ListSkeleton rows={6} />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <Home />
    </Suspense>
  );
}
