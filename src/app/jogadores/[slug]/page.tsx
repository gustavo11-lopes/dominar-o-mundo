import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MatchList } from "@/components/match-row";
import { Country, Empty, ListSkeleton, Logo } from "@/components/ui";
import { formatDate } from "@/lib/format";
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
  const p = await getPlayer((await params).slug);
  if (!p) notFound();

  return (
    <>
      <header className="mb-8 flex items-center gap-4">
        <Logo src={p.imageUrl} size={88} rounded />
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-semibold tracking-tight">{p.handle}</h1>
          <p className="mt-1 text-sm text-muted">{p.fullName ?? "Nome não informado"}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <Country code={p.countryCode} />
            {p.team ? (
              <Link href={`/times/${p.team.slug}`} className="inline-flex items-center gap-1.5 hover:text-accent">
                <Logo src={p.team.logoUrl} size={18} />
                {p.team.name}
              </Link>
            ) : (
              <span className="text-muted">Sem time</span>
            )}
          </p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <section aria-labelledby="partidas" className="min-w-0">
          <h2 id="partidas" className="mb-1 font-semibold">
            {p.team ? `Partidas recentes de ${p.team.name}` : "Partidas recentes"}
          </h2>
          <p className="mb-2 text-xs text-muted">A fonte não informa a escalação de cada partida; estas são as partidas do time atual.</p>
          {p.teamMatches.length ? <MatchList matches={p.teamMatches} showDate /> : <Empty>Nenhuma partida registrada.</Empty>}
        </section>

        <aside aria-labelledby="historico">
          <h2 id="historico" className="mb-2 font-semibold">Histórico de times</h2>
          {p.history.length ? (
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {p.history.map((h) => (
                <li key={`${h.team.slug}-${h.startedAt}`}>
                  <Link href={`/times/${h.team.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <Logo src={h.team.logoUrl} />
                    <span className="min-w-0">
                      <span className="block truncate">{h.team.name}</span>
                      <span className="block text-xs text-muted">{period(h.startedAt, h.startObserved, h.endedAt)}</span>
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
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Suspense fallback={<ListSkeleton />}>
        <PlayerContent params={params} />
      </Suspense>
    </main>
  );
}
