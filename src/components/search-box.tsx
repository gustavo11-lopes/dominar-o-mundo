"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/**
 * Campo de busca que atualiza os resultados enquanto a pessoa digita (espera 250 ms de pausa).
 * Continua funcionando como formulário comum sem JavaScript. Mantém o filtro de região.
 */
export function SearchBox({ label, placeholder }: { label: string; placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushed = useRef<string | null>(params.get("q") ?? "");

  // Voltar/avançar no navegador: o campo acompanha a URL (mas não apaga o que está sendo digitado).
  const urlQuery = params.get("q") ?? "";
  useEffect(() => {
    if (urlQuery !== lastPushed.current) {
      lastPushed.current = urlQuery;
      setValue(urlQuery);
    }
  }, [urlQuery]);

  function push(next: string) {
    const q = new URLSearchParams(params.toString());
    lastPushed.current = next.trim();
    if (next.trim()) q.set("q", next.trim());
    else q.delete("q");
    q.delete("pagina");
    const s = q.toString();
    startTransition(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  }

  function onChange(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push(next), 250);
  }

  const region = params.get("regiao");
  return (
    <form
      role="search"
      action={pathname}
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        push(value);
      }}
      className="relative mb-4"
    >
      <label htmlFor="q" className="sr-only">
        {label}
      </label>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        id="q"
        name="q"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={60}
        autoComplete="off"
        spellCheck={false}
        className="panel w-full py-3 pr-24 pl-11 text-base placeholder:text-muted focus:border-accent focus:outline-none"
      />
      {region ? <input type="hidden" name="regiao" value={region} /> : null}
      <span aria-live="polite" className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">
        {pending ? "Buscando…" : ""}
      </span>
    </form>
  );
}
