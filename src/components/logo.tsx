"use client";

import Image from "next/image";
import { useState } from "react";
import { initials } from "@/lib/initials";

/** Cor própria e estável para cada nome (o mesmo time tem sempre a mesma cor). */
function hueOf(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.codePointAt(0)!) >>> 0;
  return h % 360;
}

/**
 * Logo de time/liga ou foto de jogador. Sem imagem, ou se a imagem falhar ao carregar,
 * mostra um avatar com as iniciais numa cor própria do nome. `badge` (ex.: bandeira)
 * aparece no canto do avatar.
 */
export function Logo({
  src,
  name,
  size = 28,
  rounded = false,
  badge,
}: {
  src: string | null;
  name?: string;
  size?: number;
  rounded?: boolean;
  badge?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const shape = rounded ? "rounded-full" : "rounded-[22%]";

  if (src && !failed) {
    return (
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        style={{ width: size, height: size }}
        className={`shrink-0 ${rounded ? "rounded-full object-cover" : "object-contain"}`}
      />
    );
  }

  const hue = hueOf(name ?? "");
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.4),
        background: `repeating-linear-gradient(135deg, rgb(255 255 255 / 0.05) 0 2px, transparent 2px 7px),
          linear-gradient(135deg, hsl(${hue} 60% 38%), hsl(${(hue + 40) % 360} 65% 16%))`,
        borderColor: `hsl(${hue} 60% 55% / 0.55)`,
      }}
      className={`display relative grid shrink-0 place-items-center border text-white/95 [text-shadow:0_1px_2px_rgb(0_0_0/0.5)] ${shape}`}
    >
      {name ? initials(name) : null}
      {badge && size >= 32 ? (
        <span className="absolute -right-1 -bottom-1 overflow-hidden rounded-[3px] shadow-[0_0_0_2px_var(--bg)]">
          {badge}
        </span>
      ) : null}
    </span>
  );
}
