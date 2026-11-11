"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  ["/partidas", "Partidas"],
  ["/campeonatos", "Campeonatos"],
  ["/times", "Times"],
  ["/jogadores", "Jogadores"],
] as const;

/** Links do menu; a seção atual fica acesa, com um traço vermelho embaixo. */
export function NavLinks() {
  return <NavList pathname={usePathname()} />;
}

/** Mesmo menu sem a seção acesa: aparece enquanto o endereço da página ainda não é conhecido. */
export function NavLinksFallback() {
  return <NavList pathname={null} />;
}

function NavList({ pathname }: { pathname: string | null }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
      {NAV.map(([href, label]) => {
        const active = pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative block px-3 py-2 font-medium transition-colors after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:origin-left after:bg-accent after:transition-transform after:duration-300 ${
                active
                  ? "text-text after:scale-x-100 after:shadow-[0_0_12px_var(--accent)]"
                  : "text-muted after:scale-x-0 hover:text-text hover:after:scale-x-100"
              }`}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
