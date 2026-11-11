import "server-only";
import { cacheLife } from "next/cache";
import { connection } from "next/server";
import { z } from "zod";
import { fetchList } from "@/server/pandascore/client";
import type { MatchView } from "./matches";

/*
  Placar ao vivo direto da PandaScore, fora do banco. A sincronização roda a cada 15 minutos
  (limite do plano da Vercel); para partidas em andamento isso é lento demais. Aqui a lista
  de partidas ao vivo é buscada com cache de 20 s: no máximo ~180 requisições por hora,
  dentro do limite de 1.000 do plano gratuito.
*/

const runningSchema = z.object({
  id: z.number(),
  name: z.string(),
  tournament: z.object({ tier: z.string().nullable() }).nullable().optional(),
  opponents: z.array(
    z.object({
      opponent: z.object({
        id: z.number(),
        slug: z.string().nullable(),
        name: z.string(),
        acronym: z.string().nullable(),
      }),
    }),
  ),
  results: z.array(z.object({ team_id: z.number(), score: z.number() })),
});

export type LiveScore = {
  externalId: string;
  /** Placar por slug do time (o slug do banco é o mesmo do provedor). */
  scores: Record<string, number>;
  teams: { slug: string | null; name: string; acronym: string | null; score: number }[];
  /** Tier do campeonato (s, a, b, c, d), em minúsculas como vem do provedor. */
  tier: string | null;
};

/** Sempre na hora do acesso (nunca na pré-renderização), com cache curto entre visitas. */
export async function getLiveScores(): Promise<LiveScore[]> {
  await connection();
  return fetchLiveScores();
}

async function fetchLiveScores(): Promise<LiveScore[]> {
  "use cache";
  cacheLife({ stale: 15, revalidate: 20, expire: 60 });

  const token = process.env.PANDASCORE_TOKEN;
  if (!token) return [];
  try {
    const raw = await fetchList("/valorant/matches/running", {}, token);
    return raw.flatMap((item) => {
      const m = runningSchema.safeParse(item);
      if (!m.success) return [];
      const teams = m.data.opponents.map(({ opponent: o }) => ({
        slug: o.slug,
        name: o.name.trim(),
        acronym: o.acronym,
        score: m.data.results.find((r) => r.team_id === o.id)?.score ?? 0,
      }));
      return [
        {
          externalId: String(m.data.id),
          scores: Object.fromEntries(teams.flatMap((t) => (t.slug ? [[t.slug, t.score]] : []))),
          teams,
          tier: m.data.tournament?.tier?.toLowerCase() ?? null,
        },
      ];
    });
  } catch (err) {
    // Placar ao vivo é um bônus: se o provedor falhar, a página segue com os dados do banco.
    console.warn("[live] falha ao buscar partidas ao vivo", err);
    return [];
  }
}

/** Aplica o placar ao vivo sobre a partida vinda do banco, quando ela está rolando agora. */
export function withLiveScore(match: MatchView, live: LiveScore[]): MatchView {
  const hit = live.find((l) => l.externalId === match.externalId);
  if (!hit) return match;
  const a = match.teamA ? hit.scores[match.teamA.slug] : undefined;
  const b = match.teamB ? hit.scores[match.teamB.slug] : undefined;
  return {
    ...match,
    status: "LIVE",
    scoreA: a ?? match.scoreA,
    scoreB: b ?? match.scoreB,
  };
}
