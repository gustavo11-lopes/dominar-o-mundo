import type { Metadata } from "next";
import { Big_Shoulders, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { LiveTicker } from "@/components/live-ticker";
import { SpotlightCursor } from "@/components/spotlight-cursor";
import "./globals.css";

const shoulders = Big_Shoulders({ variable: "--font-shoulders", subsets: ["latin"], weight: "variable" });
const plex = IBM_Plex_Sans({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: { default: "esports-hub · VALORANT competitivo", template: "%s · esports-hub" },
  description: "Partidas ao vivo, resultados, campeonatos, times e jogadores de VALORANT.",
};

const NAV = [
  ["/partidas", "Partidas"],
  ["/campeonatos", "Campeonatos"],
  ["/times", "Times"],
  ["/jogadores", "Jogadores"],
] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${shoulders.variable} ${plex.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-text focus:px-3 focus:py-2 focus:text-bg"
        >
          Pular para o conteúdo
        </a>
        <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/70 backdrop-blur-xl">
          <Suspense fallback={null}>
            <LiveTicker />
          </Suspense>
          <nav
            aria-label="Principal"
            className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3"
          >
            <Link href="/" className="display text-2xl uppercase">
              esports<span className="text-accent">hub</span>
            </Link>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {NAV.map(([href, label]) => (
                <Link key={href} href={href} className="text-muted transition-colors hover:text-text">
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        <SpotlightCursor />
        <div id="conteudo" className="flex-1">
          {children}
        </div>
        <footer className="border-t border-line">
          <p className="mx-auto max-w-6xl px-4 py-8 text-xs text-muted">
            Dados: PandaScore. Projeto de fã, sem vínculo com a Riot Games. VALORANT é marca da Riot Games, Inc.
          </p>
        </footer>
      </body>
    </html>
  );
}
