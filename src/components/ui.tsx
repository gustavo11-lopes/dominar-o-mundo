import Image from "next/image";
import Link from "next/link";
import { ViewTransition } from "react";
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
        className="min-w-0 flex-1 panel px-3 py-2 text-sm placeholder:text-muted focus:border-muted focus:outline-none"
      />
      <button type="submit" className="chamfer-sm bg-text px-4 py-2 text-sm text-bg hover:opacity-90">
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

/** Iniciais para quando a fonte não tem imagem: "KeepBest Gaming" vira "KG", "sibeastw0w" vira "SI". */
function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const raw = words.length > 1 ? words[0][0] + words[1][0] : name.trim().slice(0, 2);
  return raw.toUpperCase();
}

/**
 * Logo de time/liga ou foto de jogador. Sem imagem, mostra as iniciais num emblema
 * iluminado em vez de um quadrado vazio.
 */
export function Logo({
  src,
  name,
  size = 28,
  rounded = false,
}: {
  src: string | null;
  name?: string;
  size?: number;
  rounded?: boolean;
}) {
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
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.4) }}
      className={`display grid shrink-0 place-items-center border border-line bg-[radial-gradient(circle_at_30%_25%,var(--surface-2),var(--surface))] text-muted ${shape}`}
    >
      {name ? initials(name) : null}
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
