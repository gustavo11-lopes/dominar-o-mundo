import { Flag } from "./flag";
import { Logo } from "./logo";

/** Bandeira para regiões que têm uma (Europa). As demais recebem um emblema com o código. */
const REGION_FLAG: Record<string, string> = { WEU: "EU", EEU: "EU" };

/** Ícone de troféu: competição sem imagem oficial e sem país ou região única. */
function Trophy({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size * 0.5}
      height={size * 0.5}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path d="M16 6h3v1a3 3 0 0 1-3 3M8 6H5v1a3 3 0 0 0 3 3M12 13v4M8 20h8M9.5 17h5" />
    </svg>
  );
}

/**
 * Emblema de campeonato, em ordem de preferência:
 * imagem oficial da liga > bandeira do país-sede > bandeira/código da região > troféu (internacional).
 * Só usa país e região que o provedor informou.
 */
export function TournamentEmblem({
  name,
  imageUrl,
  countryCodes,
  regionCodes,
  size = 40,
}: {
  name: string;
  imageUrl: string | null;
  countryCodes: string[];
  regionCodes: string[];
  size?: number;
}) {
  // Logos de liga costumam ser escuros (ex.: VCT em preto): um contorno claro os separa do fundo.
  if (imageUrl) {
    return (
      <span className="shrink-0 [filter:drop-shadow(0_0_1px_rgb(255_255_255/0.9))_drop-shadow(0_0_6px_rgb(255_255_255/0.3))]">
        <Logo src={imageUrl} name={name} size={size} />
      </span>
    );
  }

  const box = "grid shrink-0 place-items-center overflow-hidden rounded-[22%] border border-line";
  const style = { width: size, height: size };

  if (countryCodes.length === 1) {
    return (
      <span className={`${box} bg-surface-2`} style={style} title={countryCodes[0]}>
        <Flag code={countryCodes[0]} height={Math.round(size * 0.5)} />
      </span>
    );
  }

  if (regionCodes.length === 1) {
    const regionFlag = REGION_FLAG[regionCodes[0]];
    return (
      <span
        className={`${box} display bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklab,var(--accent)_35%,var(--surface-2)),var(--surface))] text-text`}
        style={{ ...style, fontSize: Math.max(9, size * 0.28) }}
      >
        {regionFlag ? <Flag code={regionFlag} height={Math.round(size * 0.45)} /> : regionCodes[0]}
      </span>
    );
  }

  return (
    <span
      className={`${box} bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklab,var(--accent)_45%,var(--surface-2)),var(--surface))] text-white`}
      style={style}
      aria-hidden
    >
      <Trophy size={size} />
    </span>
  );
}
