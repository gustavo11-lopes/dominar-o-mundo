import { REGIONS, type RegionId } from "@/lib/regions";
import { Pill } from "./ui";

/** Filtro de região competitiva; mantém o texto buscado. */
export function RegionFilter({ base, query, active }: { base: string; query: string; active: RegionId | null }) {
  const href = (region: RegionId | null) => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (region) p.set("regiao", region);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  return (
    <div role="group" aria-label="Região" className="mb-6 flex gap-1 overflow-x-auto pb-1">
      <Pill active={active === null} href={href(null)}>
        Todas
      </Pill>
      {REGIONS.map((r) => (
        <Pill key={r.id} active={active === r.id} href={href(r.id)}>
          <span className="whitespace-nowrap">{r.label}</span>
        </Pill>
      ))}
    </div>
  );
}
