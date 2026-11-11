import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MatchList } from "@/components/match-row";
import { Country, Empty, ListSkeleton, Logo } from "@/components/ui";
import { HeroHeader, Stat } from "@/components/hero-header";
import { getBackdrops, pickBackdrop } from "@/server/queries/maps";
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
        <Logo src={p.imageUrl} name={p.handle} size={36} rounded />
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
  const [team, backdrops] = await Promise.all([getTeam((await params).slug), getBackdrops()]);
  if (!team) notFound();
  const played = team.record.wins + team.record.losses;

  return (
    <>
      <HeroHeader
        backdrop={pickBackdrop(team.slug, backdrops)}
        emblem={<Logo src={team.logoUrl} name={team.name} size={112} />}
        title={team.name}
        aside={
          played > 0 ? (
            <Stat
              value={
                <>
                  {team.record.wins}
                  <span className="text-muted">–</span>
                  {team.record.losses}
                </>
              }
              label="Vitórias e derrotas registradas"
            />
          ) : null
        }
      >
        {team.acronym ? `${team.acronym} · ` : ""}
        <Country code={team.countryCode} />
      </HeroHeader>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="proximas">
            <h2 id="proximas" className="mb-3 section-title">
              Próximas partidas
            </h2>
            {team.upcoming.length ? (
              <MatchList matches={team.upcoming} showDate />
            ) : (
              <Empty>Nenhuma partida marcada.</Empty>
            )}
          </section>
          <section aria-labelledby="resultados">
            <h2 id="resultados" className="mb-3 section-title">
              Resultados recentes
            </h2>
            {team.recent.length ? (
              <MatchList matches={team.recent} showDate />
            ) : (
              <Empty>Nenhum resultado registrado.</Empty>
            )}
          </section>
        </div>

        <aside className="space-y-8">
          <section aria-labelledby="elenco">
            <h2 id="elenco" className="mb-3 section-title">
              Elenco atual
            </h2>
            {team.roster.length ? (
              <ul className="divide-y divide-line panel">
                {team.roster.map((p) => (
                  <PlayerItem key={p.slug} p={p} />
                ))}
              </ul>
            ) : (
              <Empty>Elenco não informado pela fonte.</Empty>
            )}
          </section>

          {team.standings.length ? (
            <section aria-labelledby="colocacoes">
              <h2 id="colocacoes" className="mb-3 section-title">
                Colocações
              </h2>
              <ul className="divide-y divide-line panel text-sm">
                {team.standings.map((s) => (
                  <li key={`${s.tournamentSlug}-${s.stage}`}>
                    <Link
                      href={`/campeonatos/${s.tournamentSlug}`}
                      className="flex gap-3 px-4 py-2.5 hover:bg-surface-2"
                    >
                      <span className="w-8 shrink-0 display text-lg tabular-nums">{s.rank}º</span>
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
              <h2 id="ex" className="mb-3 section-title">
                Saíram do elenco
              </h2>
              <ul className="divide-y divide-line panel">
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
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<ListSkeleton />}>
        <TeamContent params={params} />
      </Suspense>
    </main>
  );
}
