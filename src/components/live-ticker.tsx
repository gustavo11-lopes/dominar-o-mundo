import Link from "next/link";
import { getLiveScores } from "@/server/queries/live";
import { AutoRefresh } from "./live-client";

/** Faixa no topo com as partidas ao vivo agora. Some quando não há nenhuma. */
export async function LiveTicker() {
  const live = await getLiveScores();
  if (!live.length) return null;

  const items = (copy: boolean) =>
    live.map((m) => (
      <Link
        key={m.externalId}
        href="/partidas"
        tabIndex={copy ? -1 : undefined}
        className="inline-flex shrink-0 items-center gap-2 px-5 text-sm hover:text-white"
      >
        {m.teams.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-2">
            {i > 0 ? <span className="text-white/50">x</span> : null}
            <span className="font-medium">{t.acronym ?? t.name}</span>
            <span className="display text-lg tabular-nums">{t.score}</span>
          </span>
        ))}
      </Link>
    ));

  return (
    <div className="flex items-center overflow-hidden border-b border-white/10 bg-accent text-white">
      <span className="z-10 inline-flex shrink-0 items-center gap-2 bg-black/25 px-4 py-1.5 text-xs font-semibold">
        <span aria-hidden className="live-dot size-1.5 rounded-full bg-white text-white" />
        Ao vivo
      </span>
      <div className="min-w-0 flex-1 overflow-hidden py-1.5">
        {/* Lista duplicada para o letreiro dar a volta sem emenda. */}
        <div className="marquee">
          <div className="flex">{items(false)}</div>
          <div className="flex" aria-hidden>
            {items(true)}
          </div>
        </div>
      </div>
      <AutoRefresh seconds={30} />
    </div>
  );
}
