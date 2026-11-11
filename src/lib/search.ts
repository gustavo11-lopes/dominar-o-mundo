/*
  Normalização da busca no lado da aplicação. Precisa produzir o mesmo resultado que a função
  search_norm do banco (sem acento, minúsculas, só letras e números) para o destaque bater.
*/

/** "Luk Xo" -> "lukxo"; "São-Paulo" -> "saopaulo". Mantém letras de outros alfabetos. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * Onde a busca aparece dentro do texto original, ignorando acentos, espaços e símbolos.
 * Ex.: highlightRange("luk xo", "Lukxo") -> [0, 6]. Nulo quando não há trecho igual
 * (o resultado veio por semelhança, não por trecho exato).
 */
export function highlightRange(text: string, query: string): [number, number] | null {
  const q = normalize(query);
  if (!q) return null;

  // Normaliza caractere a caractere, guardando de qual posição do original cada letra veio.
  let norm = "";
  const origin: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const n = normalize(text[i]);
    for (const ch of n) {
      norm += ch;
      origin.push(i);
    }
  }
  const at = norm.indexOf(q);
  if (at < 0) return null;
  return [origin[at], origin[at + q.length - 1] + 1];
}
