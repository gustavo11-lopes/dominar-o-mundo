"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Player da transmissão dentro do site, em modo cinema (sobreposto à página).
 * Só carrega o iframe quando a pessoa pede, para a página abrir rápido.
 * A Twitch exige o domínio do site no parâmetro `parent`.
 */
export function StreamEmbed({
  embedUrl,
  title,
  compact = false,
}: {
  embedUrl: string;
  title: string;
  compact?: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!src) return;
    const opener = openerRef.current;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSrc(null);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      opener?.focus();
    };
  }, [src]);

  function open() {
    const url = new URL(embedUrl);
    if (url.hostname.endsWith("twitch.tv")) {
      url.searchParams.set("parent", window.location.hostname);
      url.searchParams.set("autoplay", "true");
    }
    setSrc(url.toString());
  }

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={open}
        className={
          compact
            ? "inline-flex items-center gap-1.5 text-xs font-semibold text-text hover:text-accent"
            : "inline-flex items-center gap-2 bg-text px-5 py-2.5 font-semibold text-bg chamfer-sm transition hover:brightness-90"
        }
      >
        <span aria-hidden>▶</span> Assistir aqui
      </button>

      {src
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
              onClick={(e) => e.target === e.currentTarget && setSrc(null)}
            >
              <div className="w-full max-w-5xl">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <p className="truncate text-sm text-text/85">{title}</p>
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={() => setSrc(null)}
                    className="shrink-0 bg-surface-2 px-3 py-1.5 text-sm chamfer-sm hover:bg-line"
                  >
                    Fechar
                  </button>
                </div>
                <div className="relative aspect-video w-full overflow-hidden border border-line bg-black shadow-[0_30px_100px_-20px_rgba(255,51,71,0.55)]">
                  <iframe
                    src={src}
                    title={title}
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 size-full"
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
