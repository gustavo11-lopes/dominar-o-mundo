/** Iniciais para avatar: "KeepBest Gaming" -> "KG", "sibeastw0w" -> "SI". Usado no servidor e no navegador. */
export function initials(name: string) {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const raw = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2);
  return raw.toUpperCase();
}
