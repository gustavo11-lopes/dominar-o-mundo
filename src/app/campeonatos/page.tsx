import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Empty, firstParam, ListSkeleton, Logo, PageTitle, Pagination, parsePage, Pill, type SearchParams } from "@/components/ui";
import { formatRange } from "@/lib/format";
import { getTournamentList, type TournamentTab } from "@/server/queries/tournaments";

export const metadata: Metadata = {
  title: "Campeonatos",
  description: "Campeonatos de VALORANT em andamento, próximos e encerrados.",
};

const TABS: { id: TournamentTab; label: string }[] = [
  { id: "atuais", label: "Em andamento" },
  { id: "proximos", label: "Próximos" },
  { id: "encerrados", label: "Encerrados" },
];

function href(tab: TournamentTab, page: number) {
  const p = new URLSearchParams();
  if (tab !== "atuais") p.set("aba", tab);
  if (page > 1) p.set("pagina", String(page));
  const s = p.toString();
  return s ? `/campeonatos?${s}` : "/campeonatos";
}

async function Tournaments({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const tab = TABS.find((t) => t.id === firstParam(params.aba))?.id ?? "atuais";
  const page = parsePage(params.pagina);
  const { items, hasNext } = await getTournamentList(tab, page);

  return (
    <>
      <div role="group" aria-label="Situação" className="mb-6 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <Pill key={t.id} active={t.id === tab} href={href(t.id, 1)}>
            {t.label}
          </Pill>
        ))}
      </div>
      {items.length === 0 ? (
        <Empty>Nenhum campeonato nesta lista.</Empty>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/campeonatos/${t.slug}`}
                className="flex h-full gap-3 rounded-lg border border-line bg-surface p-4 hover:border-muted"
              >
                <Logo src={t.leagueImageUrl} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.name}</span>
                  <span className="block truncate text-xs text-muted">{t.league}</span>
                  <span className="mt-2 block text-xs text-muted">{formatRange(t.beginAt, t.endAt)}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5 text-xs">
                    {t.tier !== "UNRANKED" ? <span className="rounded bg-surface-2 px-1.5 py-0.5">Tier {t.tier}</span> : null}
                    {t.regions.map((r) => (
                      <span key={r} className="rounded bg-surface-2 px-1.5 py-0.5">{r}</span>
                    ))}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination prev={page > 1 ? href(tab, page - 1) : null} next={hasNext ? href(tab, page + 1) : null} />
    </>
  );
}

export default function CampeonatosPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <PageTitle subtitle="Campeonatos com partidas acompanhadas pelo site.">Campeonatos</PageTitle>
      <Suspense fallback={<ListSkeleton />}>
        <Tournaments searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
