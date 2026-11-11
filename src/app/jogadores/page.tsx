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
  browsePlayers,
  BROWSE_PER_REGION,
  groupByRegion,
  searchPlayers,
  SEARCH_LIMIT,
  type PlayerHit,
} from "@/server/queries/search";

export const metadata: Metadata = {
  title: "Jogadores",
  description: "Jogadores profissionais de VALORANT por região, com time atual e histórico.",
};

function href(params: { regiao?: RegionId | null; pagina?: number }) {
  const p = new URLSearchParams();
  if (params.regiao) p.set("regiao", params.regiao);
  if (params.pagina && params.pagina > 1) p.set("pagina", String(params.pagina));
  const s = p.toString();
  return s ? `/jogadores?${s}` : "/jogadores";
}

function PlayerGrid({ players, query }: { players: PlayerHit[]; query: string }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {players.map((p) => (
        <li key={p.slug}>
          <Link href={`/jogadores/${p.slug}`} className="spot panel-link flex items-center gap-3 px-4 py-3">
            <Morph name={`player-${p.slug}`}>
              <Logo
                src={p.imageUrl}
                name={p.handle}
                size={40}
                rounded
                badge={<Flag code={p.countryCode} height={10} />}
              />
            </Morph>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                <Highlight text={p.handle} query={query} />
              </span>
              <span className="block truncate text-xs text-muted">
                {p.fullName ? <Highlight text={p.fullName} query={query} /> : "Nome não informado"}
              </span>
              <span className="mt-1 flex items-center gap-1.5 truncate text-xs">
                {p.team ? (
                  <>
                    <Logo src={p.team.logoUrl} name={p.team.name} size={14} />
                    <span className="truncate">{p.team.name}</span>
                  </>
                ) : (
                  <span className="text-muted">Sem time</span>
                )}
                {p.countryCode ? (
                  <span className="ml-auto shrink-0 text-muted">
                    <Country code={p.countryCode} />
                  </span>
                ) : null}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Players({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = parseQuery(params.q);
  const regiaoParam = firstParam(params.regiao);
  const region = isRegionId(regiaoParam) ? regiaoParam : null;
  const page = parsePage(params.pagina);

  if (q) {
    const hits = await searchPlayers(q, region);
    if (!hits.length) {
      return <Empty>Nenhum jogador encontrado para “{q}”. Confira a escrita ou tente parte do nick ou do nome.</Empty>;
    }
    return (
      <>
        <p className="mb-4 text-sm text-muted">
          {hits.length === SEARCH_LIMIT ? `Os ${SEARCH_LIMIT} mais relevantes` : `${hits.length} resultado(s)`} para “
          {q}”{region ? ` em ${regionLabel(region)}` : ""}, do mais parecido para o menos.
        </p>
        {!hits.some((p) => highlightRange(p.handle, q) || (p.fullName && highlightRange(p.fullName, q))) ? (
          <p className="mb-4 text-sm">Nenhum nome contém exatamente “{q}”. Estes são os mais parecidos.</p>
        ) : null}
        {groupByRegion(hits).map((g) => (
          <section key={g.region} aria-label={regionLabel(g.region)} className="mb-8">
            <h2 className="mb-3 section-title">{regionLabel(g.region)}</h2>
            <PlayerGrid players={g.items} query={q} />
          </section>
        ))}
      </>
    );
  }

  const { items, hasNext } = await browsePlayers(region, page);
  if (!items.length) return <Empty>Nenhum jogador com time nesta região.</Empty>;

  if (region) {
    return (
      <>
        <PlayerGrid players={items} query="" />
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
          <PlayerGrid players={g.items.slice(0, BROWSE_PER_REGION)} query="" />
        </section>
      ))}
    </>
  );
}

async function Filters({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const regiaoParam = firstParam(params.regiao);
  return (
    <RegionFilter
      base="/jogadores"
      query={parseQuery(params.q)}
      active={isRegionId(regiaoParam) ? regiaoParam : null}
    />
  );
}

export default function JogadoresPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageTitle subtitle="Sem busca, mostra jogadores com time atual. A região é a do país do time; sem time, a da nacionalidade.">
        Jogadores
      </PageTitle>
      <Suspense fallback={<div className="mb-4 h-12 panel" />}>
        <SearchBox label="Buscar jogador" placeholder="Buscar pelo nick ou nome (ex.: aspas, Lukxo, sacy)" />
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
          <Players searchParams={searchParams} />
        </Reveal>
      </Suspense>
    </main>
  );
}
