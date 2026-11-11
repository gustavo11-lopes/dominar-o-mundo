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
} from "@/components/ui";
import { getTeamList } from "@/server/queries/teams";

export const metadata: Metadata = {
  title: "Times",
  description: "Times de VALORANT: elencos, partidas e resultados.",
};

function href(q: string, page: number) {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (page > 1) p.set("pagina", String(page));
  const s = p.toString();
  return s ? `/times?${s}` : "/times";
}

async function Teams({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = parseQuery(params.q);
  const page = parsePage(params.pagina);
  const { items, hasNext } = await getTeamList(q, page);

  return (
    <>
      <SearchForm action="/times" defaultValue={q} label="Buscar time pelo nome ou sigla" />
      <p className="mb-4 text-sm text-muted">
        {q
          ? `Resultados para “${q}” em todo o catálogo.`
          : "Times que jogaram ou têm jogo marcado nos últimos 30 dias ou nos próximos 30."}
      </p>
      {items.length === 0 ? (
        <Empty>Nenhum time encontrado.</Empty>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <li key={t.slug}>
              <Link href={`/times/${t.slug}`} className="flex items-center gap-3 panel-link px-4 py-3">
                <Logo src={t.logoUrl} size={36} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{t.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {t.acronym ? `${t.acronym} · ` : ""}
                    <Country code={t.countryCode} />
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

export default function TimesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageTitle>Times</PageTitle>
      <Suspense fallback={<ListSkeleton />}>
        <Teams searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
