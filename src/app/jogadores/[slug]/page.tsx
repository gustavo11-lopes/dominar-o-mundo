import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MatchList } from "@/components/match-row";
import { Country, Empty, ListSkeleton, Logo, Reveal, SkeletonExit, Morph } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { HeroHeader } from "@/components/hero-header";
import { getBackdrops, pickBackdrop } from "@/server/queries/maps";
import { getPlayer } from "@/server/queries/players";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const player = await getPlayer((await params).slug);
  return player ? { title: player.handle, description: `Perfil de ${player.handle} no VALORANT competitivo.` } : {};
}

function period(startedAt: string, startObserved: boolean, endedAt: string | null) {
  const start = startObserved ? `desde ${formatDate(startedAt)}` : null;
  if (!endedAt) return start ? `Atual, ${start}` : "Atual";
  return `Saída registrada em ${formatDate(endedAt)}`;
}

async function PlayerContent({ params }: { params: Params }) {
  const [p, backdrops] = await Promise.all([getPlayer((await params).slug), getBackdrops()]);
  if (!p) notFound();

  return (
    <>
      <HeroHeader
        backdrop={pickBackdrop(p.team?.slug ?? p.slug, backdrops)}
        emblem={
          <Morph name={`player-${p.slug}`}>
            <Logo src={p.imageUrl} name={p.handle} size={112} rounded />
          </Morph>
        }
        title={p.handle}
      >
        <p>{p.fullName ?? "Nome não informado"}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Country code={p.countryCode} />
          {p.team ? (
            <Link href={`/times/${p.team.slug}`} className="inline-flex items-center gap-1.5 hover:text-accent">
              <Logo src={p.team.logoUrl} name={p.team.name} size={18} />
              {p.team.name}
            </Link>
          ) : (
            <span className="text-muted">Sem time</span>
          )}
        </p>
      </HeroHeader>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <section aria-labelledby="partidas" className="min-w-0">
          <h2 id="partidas" className="mb-3 section-title">
            {p.team ? `Partidas recentes de ${p.team.name}` : "Partidas recentes"}
          </h2>
          <p className="mb-2 text-xs text-muted">
            A fonte não informa a escalação de cada partida; estas são as partidas do time atual.
          </p>
          {p.teamMatches.length ? (
            <MatchList matches={p.teamMatches} showDate />
          ) : (
            <Empty>Nenhuma partida registrada.</Empty>
          )}
        </section>

        <aside aria-labelledby="historico">
          <h2 id="historico" className="mb-3 section-title">
            Histórico de times
          </h2>
          {p.history.length ? (
            <ul className="divide-y divide-line panel">
              {p.history.map((h) => (
                <li key={`${h.team.slug}-${h.startedAt}`}>
                  <Link href={`/times/${h.team.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <Logo src={h.team.logoUrl} name={h.team.name} />
                    <span className="min-w-0">
                      <span className="block truncate">{h.team.name}</span>
                      <span className="block text-xs text-muted">
                        {period(h.startedAt, h.startObserved, h.endedAt)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Sem histórico registrado.</Empty>
          )}
          <p className="mt-2 text-xs text-muted">
            O histórico começa quando o site passou a acompanhar os elencos. Passagens anteriores não aparecem.
          </p>
        </aside>
      </div>
    </>
  );
}

export default function PlayerPage({ params }: { params: Params }) {
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
          <PlayerContent params={params} />
        </Reveal>
      </Suspense>
    </main>
  );
}
