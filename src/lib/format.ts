// Datas do site sempre no horário de Brasília: renderização no servidor, sem divergência com o navegador.
export const SITE_TIME_ZONE = "America/Sao_Paulo";

const dayFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: SITE_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const timeFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: SITE_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: SITE_TIME_ZONE });

export const formatDay = (iso: string) => {
  const text = dayFormat.format(new Date(iso));
  return text.charAt(0).toUpperCase() + text.slice(1);
};
export const formatTime = (iso: string) => timeFormat.format(new Date(iso));
/** Chave AAAA-MM-DD no fuso do site, para agrupar partidas por dia. */
export const dayKey = (iso: string) => dayKeyFormat.format(new Date(iso));

/** Agrupa preservando a ordem de entrada. Partidas sem data ficam no grupo "sem-data". */
export function groupByDay<T extends { scheduledAt: string | null }>(items: T[]) {
  const groups = new Map<string, { label: string; items: T[] }>();
  for (const item of items) {
    const key = item.scheduledAt ? dayKey(item.scheduledAt) : "sem-data";
    const label = item.scheduledAt ? formatDay(item.scheduledAt) : "Data a definir";
    const group = groups.get(key) ?? { label, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
}
