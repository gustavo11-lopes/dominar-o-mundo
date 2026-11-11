import Image from "next/image";
import Link from "next/link";
import { countryName, flag } from "@/lib/format";

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
      <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>
      {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
    </div>
  );
}

export function Pill({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
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
  return (
    <p className="rounded-lg border border-dashed border-line px-4 py-12 text-center text-muted">{children}</p>
  );
}

/** Busca por GET: funciona sem JavaScript e mantém a URL compartilhável. */
export function SearchForm({ action, defaultValue, label }: { action: string; defaultValue: string; label: string }) {
  return (
    <form action={action} role="search" className="mb-6 flex gap-2">
      <label htmlFor="q" className="sr-only">
        {label}
      </label>
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={label}
        maxLength={60}
        className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted focus:border-muted focus:outline-none"
      />
      <button type="submit" className="rounded-lg bg-text px-4 py-2 text-sm text-bg hover:opacity-90">
        Buscar
      </button>
    </form>
  );
}

export function Country({ code }: { code: string | null }) {
  if (!code) return null;
  const name = countryName(code);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden>{flag(code)}</span>
      {name}
    </span>
  );
}

export function Logo({ src, size = 28, rounded = false }: { src: string | null; size?: number; rounded?: boolean }) {
  const shape = rounded ? "rounded-full" : "rounded";
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`shrink-0 object-contain ${rounded ? "rounded-full object-cover" : ""}`}
      />
    );
  }
  return <span aria-hidden style={{ width: size, height: size }} className={`shrink-0 bg-surface-2 ${shape}`} />;
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Carregando" className="rounded-lg border border-line bg-surface">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="border-b border-line px-4 py-3 last:border-b-0">
          <div className="h-7 animate-pulse rounded bg-surface-2" />
        </div>
      ))}
    </div>
  );
}
