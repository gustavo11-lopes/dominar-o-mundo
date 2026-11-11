import Image from "next/image";

/**
 * Cabeçalho iluminado das páginas de time, jogador e campeonato:
 * arte de mapa ao fundo, luz vermelha por trás do emblema e o título grande.
 */
export function HeroHeader({
  backdrop,
  emblem,
  title,
  children,
  aside,
}: {
  backdrop: string | null;
  emblem: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <header className="relative mb-10 overflow-hidden border border-line chamfer">
      {backdrop ? (
        <Image
          src={backdrop}
          alt=""
          fill
          priority
          sizes="(min-width: 1152px) 1152px, 100vw"
          className="backdrop-drift object-cover opacity-40"
        />
      ) : null}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,12,16,0.92)_0%,rgba(11,12,16,0.7)_55%,rgba(11,12,16,0.35)_100%)]"
      />
      <div
        aria-hidden
        className="absolute -left-20 top-1/2 size-80 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--accent)_45%,transparent),transparent_70%)] blur-2xl"
      />
      <div className="relative flex flex-col gap-6 px-5 py-8 sm:flex-row sm:items-center sm:px-8 sm:py-10">
        <div className="enter-left shrink-0 drop-shadow-[0_0_30px_rgba(255,255,255,0.18)]">{emblem}</div>
        <div className="enter-left min-w-0 flex-1">
          <h1 className="page-title text-shadow-[0_0_40px_rgba(255,51,71,0.35)]">{title}</h1>
          {children ? <div className="mt-2 text-sm text-text/85">{children}</div> : null}
        </div>
        {aside ? <div className="enter-right shrink-0">{aside}</div> : null}
      </div>
    </header>
  );
}

/** Número em destaque com rótulo, para o lado direito do cabeçalho. */
export function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="text-left sm:text-right">
      <div className="display text-5xl tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  );
}
