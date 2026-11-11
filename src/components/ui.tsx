import Link from "next/link";
import { ViewTransition } from "react";
import { countryName } from "@/lib/format";
import { Flag } from "./flag";
export { initials, Logo } from "./logo";

export type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export const firstParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Página da URL validada: inteiro entre 1 e 500, senão 1. */
export function parsePage(v: string | string[] | undefined) {
  const page = Number.parseInt(firstParam(v) ?? "1", 10);
  return Number.isSafeInteger(page) && page >= 1 && page <= 500 ? page : 1;
}

/** Texto de busca da URL, aparado e limitado. */
export const parseQuery = (v: string | string[] | undefined) => (firstParam(v) ?? "").trim().slice(0, 60);

export function PageTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="page-title">{children}</h1>
      {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
    </div>
  );
}

export function Pill({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`chamfer-sm px-3 py-1.5 text-sm transition-colors ${
        active ? "bg-text text-bg" : "text-muted hover:bg-surface-2 hover:text-text"
      }`}
    >
      {children}
    </Link>
  );
}

export function Pagination({ prev, next }: { prev: string | null; next: string | null }) {
  if (!prev && !next) return null;
  return (
    <nav aria-label="Paginação" className="mt-6 flex justify-between text-sm">
      {prev ? (
        <Link href={prev} className="text-muted hover:text-text">
          ← Anterior
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next} className="text-muted hover:text-text">
          Próxima →
        </Link>
      ) : null}
    </nav>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="border border-dashed border-line px-4 py-12 text-center text-muted">{children}</p>;
}

export function Country({ code }: { code: string | null }) {
  if (!code) return null;
  const name = countryName(code);
  return (
    <span className="inline-flex items-center gap-1.5">
      <Flag code={code} />
      {name}
    </span>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Carregando" className="panel">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="border-b border-line px-4 py-3 last:border-b-0">
          <div className="h-7 animate-pulse rounded bg-surface-2" />
        </div>
      ))}
    </div>
  );
}

/** Conteúdo que chega depois do carregamento: sobe e aparece (transição do React). */
export function Reveal({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="slide-up" default="none">
      {children}
    </ViewTransition>
  );
}

/** Esqueleto de carregamento que desce e some quando o conteúdo chega. */
export function SkeletonExit({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition exit="slide-down" default="none">
      {children}
    </ViewTransition>
  );
}

/** Elemento que "voa" entre páginas com o mesmo nome (ex.: logo do time da lista para o cabeçalho). */
export function Morph({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <ViewTransition name={name} share="morph" default="none">
      {children}
    </ViewTransition>
  );
}
