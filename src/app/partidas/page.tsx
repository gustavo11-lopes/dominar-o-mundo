import type { Metadata } from "next";
import { Suspense } from "react";
import { MatchList } from "@/components/match-row";
import {
  Empty,
  firstParam,
  ListSkeleton,
  PageTitle,
  Pagination,
  parsePage,
  Pill,
  type SearchParams,
  Reveal,
  SkeletonExit,
} from "@/components/ui";
import { formatDay, formatTime, groupByDay } from "@/lib/format";
import { getLastSync, getMatchList, type MatchTab } from "@/server/queries/matches";

export const metadata: Metadata = {
  title: "Partidas",
  description: "Partidas ao vivo, próximos jogos e resultados de VALORANT.",
};

type Filters = { tab: MatchTab; major: boolean; page: number };

function href({ tab, major, page }: Filters) {
  const q = new URLSearchParams();
  if (tab === "resultados") q.set("aba", "resultados");
  if (major) q.set("nivel", "principais");
  if (page > 1) q.set("pagina", String(page));
  const s = q.toString();
  return s ? `/partidas?${s}` : "/partidas";
}

async function Matches({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters: Filters = {
    tab: firstParam(params.aba) === "resultados" ? "resultados" : "proximas",
    major: firstParam(params.nivel) === "principais",
    page: parsePage(params.pagina),
  };
  const [list, lastSync] = await Promise.all([getMatchList(filters.tab, filters.major, filters.page), getLastSync()]);
  const groups = groupByDay(list.items);

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
          <MatchList matches={list.live} />
        </section>
      ) : null}

      {groups.length === 0 ? (
        <Empty>
          {filters.tab === "resultados" ? "Nenhum resultado encontrado." : "Nenhuma partida agendada no momento."}
          {filters.major ? " Experimente o filtro “Todos”." : ""}
        </Empty>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="mb-8">
            <h2 className="mb-2 text-sm font-semibold text-muted">{group.label}</h2>
            <MatchList matches={group.items} />
          </section>
        ))
      )}

      <Pagination
        prev={filters.page > 1 ? href({ ...filters, page: filters.page - 1 }) : null}
        next={list.hasNext ? href({ ...filters, page: filters.page + 1 }) : null}
      />

      <p className="mt-8 text-xs text-muted">
        Horários de Brasília.{" "}
        {lastSync
          ? `Dados atualizados em ${formatDay(lastSync).toLowerCase()}, às ${formatTime(lastSync)}.`
          : "Dados ainda não sincronizados."}
      </p>
    </>
  );
}

export default function PartidasPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageTitle>Partidas</PageTitle>
      <Suspense
        fallback={
          <SkeletonExit>
            <ListSkeleton rows={8} />
          </SkeletonExit>
        }
      >
        <Reveal>
          <Matches searchParams={searchParams} />
        </Reveal>
      </Suspense>
    </main>
  );
}
