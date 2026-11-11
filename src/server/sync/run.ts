import type { PrismaClient } from "@/generated/prisma/client";
import { describeError, type SyncReport } from "./lease";
import { pandaScoreMapFetcher, syncMaps } from "./maps";
import { pandaScoreFetcher, syncMatches } from "./matches";
import { pandaScoreStandingsFetcher, syncStandings } from "./standings";
import { pandaScoreTeamFetcher, syncTeams } from "./teams";

export type SyncOutcome = SyncReport | { status: "error"; message: string };

/**
 * Roda as sincronizações em ordem: partidas, times (com elencos) e classificação.
 * A falha de uma não impede as outras; cada uma tem seu próprio relatório.
 */
export async function runAllSyncs(db: PrismaClient, token: string): Promise<Record<string, SyncOutcome>> {
  const steps = {
    partidas: () => syncMatches(db, pandaScoreFetcher(token)),
    times: () => syncTeams(db, pandaScoreTeamFetcher(token)),
    classificacao: () => syncStandings(db, pandaScoreStandingsFetcher(token)),
    mapas: () => syncMaps(db, pandaScoreMapFetcher(token)),
  };
  const out: Record<string, SyncOutcome> = {};
  for (const [name, step] of Object.entries(steps)) {
    try {
      out[name] = await step();
    } catch (err) {
      console.error(`[sync] ${name} falhou`, err);
      out[name] = { status: "error", message: describeError(err) };
    }
  }
  return out;
}
