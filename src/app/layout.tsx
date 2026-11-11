import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "esports-hub", template: "%s · esports-hub" },
  description: "Partidas, resultados e campeonatos de VALORANT.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-line">
          <nav aria-label="Principal" className="mx-auto flex h-14 max-w-5xl items-center gap-8 px-4">
            <Link href="/partidas" className="font-semibold tracking-tight">
              esports<span className="text-accent">hub</span>
            </Link>
            <Link href="/partidas" className="text-sm text-muted hover:text-text">
              Partidas
            </Link>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-line">
          <p className="mx-auto max-w-5xl px-4 py-6 text-xs text-muted">
            Dados de partidas: PandaScore. Projeto de fã, sem vínculo com a Riot Games. VALORANT é marca da Riot Games, Inc.
          </p>
        </footer>
      </body>
    </html>
  );
}
