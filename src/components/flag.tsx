import * as flags from "country-flag-icons/string/3x2";

/**
 * Bandeira em SVG (as bandeiras em emoji não aparecem no Windows).
 * Código desconhecido não renderiza nada: nunca inventa uma bandeira.
 */
export function Flag({
  code,
  height = 12,
  className = "",
}: {
  code: string | null;
  height?: number;
  className?: string;
}) {
  const svg = code ? (flags as Record<string, string>)[code] : undefined;
  if (!svg) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG inline em data URI, sem otimização a fazer.
    <img
      src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
      alt=""
      width={Math.round(height * 1.5)}
      height={height}
      className={`inline-block shrink-0 rounded-[2px] ${className}`}
    />
  );
}
