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

const shortDate = new Intl.DateTimeFormat("pt-BR", {
  timeZone: SITE_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});
export const formatDate = (iso: string) => shortDate.format(new Date(iso)).replace(/ de /g, " ").replace(".", "");

export function formatRange(begin: string | null, end: string | null) {
  if (begin && end) return `${formatDate(begin)} – ${formatDate(end)}`;
  if (begin) return `A partir de ${formatDate(begin)}`;
  if (end) return `Até ${formatDate(end)}`;
  return "Datas a definir";
}

const countryNames = new Intl.DisplayNames(["pt-BR"], { type: "region" });

/** Nome do país em português a partir do código ISO de 2 letras. */
export function countryName(code: string) {
  try {
    return countryNames.of(code) ?? code;
  } catch {
    return code;
  }
}

const dayMonth = new Intl.DateTimeFormat("pt-BR", { timeZone: SITE_TIME_ZONE, day: "2-digit", month: "2-digit" });
export const formatDayMonth = (iso: string) => dayMonth.format(new Date(iso));
