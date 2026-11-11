import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  Country,
  Empty,
  ListSkeleton,
  Logo,
  PageTitle,
  Pagination,
  parsePage,
  parseQuery,
  SearchForm,
  type SearchParams,
  Reveal,
  SkeletonExit,
  Morph,
} from "@/components/ui";
import { getPlayerList } from "@/server/queries/players";

export const metadata: Metadata = {
  title: "Jogadores",
  description: "Jogadores profissionais de VALORANT e seus times.",
};

function href(q: string, page: number) {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (page > 1) p.set("pagina", String(page));
  const s = p.toString();
  return s ? `/jogadores?${s}` : "/jogadores";
}

async function Players({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = parseQuery(params.q);
  const page = parsePage(params.pagina);
  const { items, hasNext } = await getPlayerList(q, page);

  return (
    <>
      <SearchForm action="/jogadores" defaultValue={q} label="Buscar jogador pelo nick ou nome" />
      {items.length === 0 ? (
        <Empty>Nenhum jogador encontrado.</Empty>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <li key={p.slug}>
              <Link href={`/jogadores/${p.slug}`} className="flex items-center gap-3 spot panel-link px-4 py-3">
                <Morph name={`player-${p.slug}`}>
                  <Logo src={p.imageUrl} name={p.handle} size={36} rounded />
                </Morph>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.handle}</span>
                  <span className="block truncate text-xs text-muted">
                    {p.team?.name ?? "Sem time"}
                    {p.countryCode ? " · " : ""}
                    <Country code={p.countryCode} />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination prev={page > 1 ? href(q, page - 1) : null} next={hasNext ? href(q, page + 1) : null} />
    </>
  );
}

export default function JogadoresPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageTitle subtitle="Jogadores com time atual.">Jogadores</PageTitle>
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
