import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Flag } from "@/components/flag";
import { Highlight } from "@/components/highlight";
import { RegionFilter } from "@/components/region-filter";
import { SearchBox } from "@/components/search-box";
import {
  Country,
  Empty,
  firstParam,
  ListSkeleton,
  Logo,
  Morph,
  PageTitle,
  Pagination,
  parsePage,
  parseQuery,
  Reveal,
  SkeletonExit,
  type SearchParams,
} from "@/components/ui";
import { isRegionId, regionLabel, type RegionId } from "@/lib/regions";
import { highlightRange } from "@/lib/search";
import {
  browseTeams,
  BROWSE_PER_REGION,
  groupByRegion,
  searchTeams,
  SEARCH_LIMIT,
  type TeamHit,
} from "@/server/queries/search";

export const metadata: Metadata = {
  title: "Times",
  description: "Times de VALORANT por região: elencos, partidas e resultados.",
};

function href(params: { q?: string; regiao?: RegionId | null; pagina?: number }) {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.regiao) p.set("regiao", params.regiao);
  if (params.pagina && params.pagina > 1) p.set("pagina", String(params.pagina));
  const s = p.toString();
  return s ? `/times?${s}` : "/times";
}

function TeamGrid({ teams, query }: { teams: TeamHit[]; query: string }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map((t) => (
        <li key={t.slug}>
          <Link href={`/times/${t.slug}`} className="spot panel-link flex items-center gap-3 px-4 py-3">
            <Morph name={`team-${t.slug}`}>
              <Logo src={t.logoUrl} name={t.name} size={40} badge={<Flag code={t.countryCode} height={10} />} />
            </Morph>
            <span className="min-w-0">
              <span className="block truncate font-medium">
                <Highlight text={t.name} query={query} />
              </span>
              <span className="flex items-center gap-1.5 truncate text-xs text-muted">
                {t.acronym ? (
                  <>
                    <Highlight text={t.acronym} query={query} />
                    {t.countryCode ? <span aria-hidden>·</span> : null}
                  </>
                ) : null}
                <Country code={t.countryCode} />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Teams({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = parseQuery(params.q);
  const regiaoParam = firstParam(params.regiao);
  const region = isRegionId(regiaoParam) ? regiaoParam : null;
  const page = parsePage(params.pagina);

  if (q) {
    const hits = await searchTeams(q, region);
    if (!hits.length) {
      return <Empty>Nenhum time encontrado para “{q}”. Confira a escrita ou tente parte do nome.</Empty>;
    }
    return (
      <>
        <p className="mb-4 text-sm text-muted">
          {hits.length === SEARCH_LIMIT ? `Os ${SEARCH_LIMIT} mais relevantes` : `${hits.length} resultado(s)`} para “
          {q}”{region ? ` em ${regionLabel(region)}` : ""}, do mais parecido para o menos.
        </p>
        {!hits.some((t) => highlightRange(t.name, q) || (t.acronym && highlightRange(t.acronym, q))) ? (
          <p className="mb-4 text-sm">Nenhum nome contém exatamente “{q}”. Estes são os mais parecidos.</p>
        ) : null}
        {groupByRegion(hits).map((g) => (
          <section key={g.region} aria-label={regionLabel(g.region)} className="mb-8">
            <h2 className="mb-3 section-title">{regionLabel(g.region)}</h2>
            <TeamGrid teams={g.items} query={q} />
          </section>
        ))}
      </>
    );
  }

  const { items, hasNext } = await browseTeams(region, page);
  if (!items.length) return <Empty>Nenhum time em atividade nesta região agora.</Empty>;

  if (region) {
    return (
      <>
        <TeamGrid teams={items} query="" />
        <Pagination
          prev={page > 1 ? href({ regiao: region, pagina: page - 1 }) : null}
          next={hasNext ? href({ regiao: region, pagina: page + 1 }) : null}
        />
      </>
    );
  }

  return (
    <>
      {groupByRegion(items).map((g) => (
        <section key={g.region} aria-label={regionLabel(g.region)} className="reveal mb-10">
          <div className="mb-3 flex items-end justify-between gap-4">
            <h2 className="section-title">{regionLabel(g.region)}</h2>
            {g.items.length > BROWSE_PER_REGION ? (
              <Link href={href({ regiao: g.region })} className="text-sm text-muted hover:text-text">
                Ver todos ({g.items.length})
              </Link>
            ) : null}
          </div>
          <TeamGrid teams={g.items.slice(0, BROWSE_PER_REGION)} query="" />
        </section>
      ))}
    </>
  );
}

async function Filters({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const regiaoParam = firstParam(params.regiao);
  return (
    <RegionFilter base="/times" query={parseQuery(params.q)} active={isRegionId(regiaoParam) ? regiaoParam : null} />
  );
}

export default function TimesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageTitle subtitle="Sem busca, mostra os times que jogaram ou jogam nos últimos e próximos 30 dias. A região vem do país informado pela fonte; sem país, o time fica em “Outras regiões”.">
        Times
      </PageTitle>
      <Suspense fallback={<div className="mb-4 h-12 panel" />}>
        <SearchBox label="Buscar time" placeholder="Buscar time pelo nome ou sigla (ex.: loud, 100t, kru)" />
      </Suspense>
      <Suspense fallback={<div className="mb-6 h-9" />}>
        <Filters searchParams={searchParams} />
      </Suspense>
      <Suspense
        fallback={
          <SkeletonExit>
            <ListSkeleton />
          </SkeletonExit>
        }
      >
        <Reveal>
          <Teams searchParams={searchParams} />
        </Reveal>
      </Suspense>
    </main>
  );
}
