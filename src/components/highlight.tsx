import { highlightRange } from "@/lib/search";

/** Texto com o trecho buscado destacado (ignora acentos, espaços e símbolos). */
export function Highlight({ text, query }: { text: string; query: string }) {
  const range = query ? highlightRange(text, query) : null;
  if (!range) return <>{text}</>;
  const [a, b] = range;
  return (
    <>
      {text.slice(0, a)}
      <mark className="rounded-[2px] bg-accent/25 px-0.5 text-text">{text.slice(a, b)}</mark>
      {text.slice(b)}
    </>
  );
}
