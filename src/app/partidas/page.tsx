import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MatchRow } from "@/components/match-row";
import { formatDay, formatTime, groupByDay } from "@/lib/format";
import { getLastSync, getMatchList, type MatchTab } from "@/server/queries/matches";

export const metadata: Metadata = {
  title: "Partidas",
  description: "Partidas ao vivo, próximos jogos e resultados de VALORANT.",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

type Filters = { tab: MatchTab; major: boolean; page: number };

function parseFilters(params: Awaited<SearchParams>): Filters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const page = Number.parseInt(one(params.pagina) ?? "1", 10);
  return {
    tab: one(params.aba) === "resultados" ? "resultados" : "proximas",
    major: one(params.nivel) === "principais",
    page: Number.isSafeInteger(page) && page >= 1 && page <= 500 ? page : 1,
  };
}

function href({ tab, major, page }: Filters) {
  const q = new URLSearchParams();
  if (tab === "resultados") q.set("aba", "resultados");
  if (major) q.set("nivel", "principais");
  if (page > 1) q.set("pagina", String(page));
  const s = q.toString();
  return s ? `/partidas?${s}` : "/partidas";
}

function Pill({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
        active ? "bg-text text-bg" : "text-muted hover:bg-surface-2 hover:text-text"
      }`}
    >
      {children}
    </Link>
  );
}

async function Matches({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseFilters(await searchParams);
  const [list, lastSync] = await Promise.all([
    getMatchList(filters.tab, filters.major, filters.page),
    getLastSync(),
  ]);
  const groups = groupByDay(list.items);
  const emptyText =
    filters.tab === "resultados"
      ? "Nenhum resultado encontrado."
      : "Nenhuma partida agendada no momento.";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Período" className="flex gap-1">
          <Pill active={filters.tab === "proximas"} href={href({ ...filters, tab: "proximas", page: 1 })}>
            Próximas
          </Pill>
          <Pill active={filters.tab === "resultados"} href={href({ ...filters, tab: "resultados", page: 1 })}>
            Resultados
          </Pill>
        </div>
        <div role="group" aria-label="Nível dos campeonatos" className="flex gap-1 sm:ml-auto">
          <Pill active={!filters.major} href={href({ ...filters, major: false, page: 1 })}>
            Todos
          </Pill>
          <Pill active={filters.major} href={href({ ...filters, major: true, page: 1 })}>
            Principais (Tier S e A)
          </Pill>
        </div>
      </div>

      {list.live.length > 0 ? (
        <section aria-labelledby="ao-vivo" className="mb-8">
          <h2 id="ao-vivo" className="mb-2 text-sm font-semibold text-live">
            Ao vivo
          </h2>
          <ul className="rounded-lg border border-line bg-surface">
            {list.live.map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </ul>
        </section>
      ) : null}

      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-12 text-center text-muted">
          {emptyText}
          {filters.major ? " Experimente o filtro “Todos”." : ""}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="mb-8">
            <h2 className="mb-2 text-sm font-semibold text-muted">{group.label}</h2>
            <ul className="rounded-lg border border-line bg-surface">
              {group.items.map((m) => (
                <MatchRow key={m.id} match={m} />
              ))}
            </ul>
          </section>
        ))
      )}

      {filters.page > 1 || list.hasNext ? (
        <nav aria-label="Paginação" className="flex justify-between text-sm">
          {filters.page > 1 ? (
            <Link href={href({ ...filters, page: filters.page - 1 })} className="text-muted hover:text-text">
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          {list.hasNext ? (
            <Link href={href({ ...filters, page: filters.page + 1 })} className="text-muted hover:text-text">
              Próxima →
            </Link>
          ) : null}
        </nav>
      ) : null}

      <p className="mt-8 text-xs text-muted">
        Horários de Brasília.{" "}
        {lastSync
          ? `Dados atualizados em ${formatDay(lastSync).toLowerCase()}, às ${formatTime(lastSync)}.`
          : "Dados ainda não sincronizados."}
      </p>
    </>
  );
}

function MatchesSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando partidas">
      <div className="mb-6 h-8 w-64 animate-pulse rounded-full bg-surface-2" />
      {Array.from({ length: 2 }, (_, g) => (
        <div key={g} className="mb-8">
          <div className="mb-2 h-4 w-40 animate-pulse rounded bg-surface-2" />
          <div className="rounded-lg border border-line bg-surface">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="border-b border-line px-4 py-3 last:border-b-0">
                <div className="mb-2 h-3 w-1/3 animate-pulse rounded bg-surface-2" />
                <div className="h-7 animate-pulse rounded bg-surface-2" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PartidasPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Partidas</h1>
      <Suspense fallback={<MatchesSkeleton />}>
        <Matches searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
