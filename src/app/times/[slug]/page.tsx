import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MatchList } from "@/components/match-row";
import { Country, Empty, ListSkeleton, Logo } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { getTeam, type RosterEntry } from "@/server/queries/teams";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const team = await getTeam((await params).slug);
  return team ? { title: team.name, description: `Elenco, partidas e resultados de ${team.name}.` } : {};
}

function PlayerItem({ p }: { p: RosterEntry }) {
  return (
    <li>
      <Link href={`/jogadores/${p.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
        <Logo src={p.imageUrl} size={36} rounded />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{p.handle}</span>
          <span className="block truncate text-xs text-muted">{p.fullName ?? "Nome não informado"}</span>
        </span>
        <span className="shrink-0 text-xs text-muted">
          <Country code={p.countryCode} />
        </span>
      </Link>
    </li>
  );
}

async function TeamContent({ params }: { params: Params }) {
  const team = await getTeam((await params).slug);
  if (!team) notFound();
  const played = team.record.wins + team.record.losses;

  return (
    <>
      <header className="mb-8 flex items-center gap-4">
        <Logo src={team.logoUrl} size={72} />
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-semibold tracking-tight">{team.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {team.acronym ? `${team.acronym} · ` : ""}
            <Country code={team.countryCode} />
          </p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="proximas">
            <h2 id="proximas" className="mb-2 font-semibold">Próximas partidas</h2>
            {team.upcoming.length ? <MatchList matches={team.upcoming} showDate /> : <Empty>Nenhuma partida marcada.</Empty>}
          </section>
          <section aria-labelledby="resultados">
            <h2 id="resultados" className="mb-2 font-semibold">Resultados recentes</h2>
            {team.recent.length ? <MatchList matches={team.recent} showDate /> : <Empty>Nenhum resultado registrado.</Empty>}
          </section>
        </div>

        <aside className="space-y-8">
          <section aria-labelledby="elenco">
            <h2 id="elenco" className="mb-2 font-semibold">Elenco atual</h2>
            {team.roster.length ? (
              <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                {team.roster.map((p) => (
                  <PlayerItem key={p.slug} p={p} />
                ))}
              </ul>
            ) : (
              <Empty>Elenco não informado pela fonte.</Empty>
            )}
          </section>

          {played > 0 && team.record.since ? (
            <section aria-labelledby="campanha" className="rounded-lg border border-line bg-surface p-4">
              <h2 id="campanha" className="mb-1 font-semibold">Campanha registrada</h2>
              <p className="text-2xl font-semibold tabular-nums">
                {team.record.wins}V <span className="text-muted">·</span> {team.record.losses}D
              </p>
              <p className="mt-1 text-xs text-muted">
                Séries encerradas registradas pelo site desde {formatDate(team.record.since)}.
              </p>
            </section>
          ) : null}

          {team.standings.length ? (
            <section aria-labelledby="colocacoes">
              <h2 id="colocacoes" className="mb-2 font-semibold">Colocações</h2>
              <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
                {team.standings.map((s) => (
                  <li key={`${s.tournamentSlug}-${s.stage}`}>
                    <Link href={`/campeonatos/${s.tournamentSlug}`} className="flex gap-3 px-4 py-2.5 hover:bg-surface-2">
                      <span className="w-8 shrink-0 font-mono tabular-nums">{s.rank}º</span>
                      <span className="min-w-0 truncate">
                        {s.tournament} <span className="text-muted">· {s.stage}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {team.formerPlayers.length ? (
            <section aria-labelledby="ex">
              <h2 id="ex" className="mb-2 font-semibold">Saíram do elenco</h2>
              <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                {team.formerPlayers.map((p) => (
                  <PlayerItem key={`${p.slug}-${p.startedAt}`} p={p} />
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}

export default function TeamPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Suspense fallback={<ListSkeleton />}>
        <TeamContent params={params} />
      </Suspense>
    </main>
  );
}
