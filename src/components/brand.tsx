import Link from "next/link";

/**
 * Marca VALOHUB: emblema próprio (placa chanfrada com uma mira)
 * ao lado do nome na tipografia de estádio. Desenho original, sem usar a marca da Riot.
 */
export function Brand() {
  return (
    <Link href="/" aria-label="VALOHUB, página inicial" className="group flex items-center gap-2.5">
      <svg
        viewBox="0 0 32 32"
        aria-hidden
        className="size-8 drop-shadow-[0_0_12px_rgba(255,51,71,0.55)] transition-transform duration-300 group-hover:rotate-45 group-hover:scale-110"
      >
        {/* Placa chanfrada com mira: o mesmo canto cortado usado nos painéis do site. */}
        <path d="M2 2h22l6 6v22H8l-6-6z" fill="var(--accent)" />
        <circle cx="16" cy="16" r="6.5" fill="none" stroke="var(--text)" strokeWidth="2.5" />
        <path d="M16 6v5M16 21v5M6 16h5M21 16h5" stroke="var(--text)" strokeWidth="2.5" />
      </svg>
      <span className="display text-[1.75rem] leading-none tracking-wide uppercase">
        Valo<span className="text-accent">hub</span>
      </span>
    </Link>
  );
}
