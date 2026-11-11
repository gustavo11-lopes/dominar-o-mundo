import type { PrismaClient } from "@/generated/prisma/client";
import { fetchList } from "@/server/pandascore/client";
import { mapStanding, UnsupportedRecordError } from "@/server/pandascore/map";
import { psStandingSchema } from "@/server/pandascore/schemas";
import { eachRecord, runWithLease, type SyncReport } from "./lease";
import { upsertTeam, type IdCache } from "./teams-store";

/** Busca a classificação crua de uma fase pelo id dela no provedor. */
export type StandingsFetcher = (stageExternalId: string) => Promise<unknown[]>;

/** Teto de fases por execução, para caber no limite de requisições do plano gratuito. */
const MAX_STAGES_PER_RUN = 60;

export function pandaScoreStandingsFetcher(token: string): StandingsFetcher {
  return (stageExternalId) => fetchList(`/tournaments/${stageExternalId}/standings`, {}, token);
}

/**
 * Atualiza a classificação das fases que tiveram partida alterada desde a última execução
 * (na primeira, de todas as fases conhecidas). Rodar depois do sync de partidas.
 */
export function syncStandings(
  db: PrismaClient,
  fetchStandings: StandingsFetcher,
  now: Date = new Date(),
): Promise<SyncReport> {
  return runWithLease(db, "STANDINGS", now, async (since) => {
    const stages = await db.stage.findMany({
      where: since ? { matches: { some: { updatedAt: { gte: since } } } } : {},
      orderBy: { beginAt: { sort: "desc", nulls: "last" } },
      take: MAX_STAGES_PER_RUN,
      select: { id: true, externalId: true },
    });
    const cache: IdCache = new Map();

    return eachRecord(
      stages.map((s) => [s.externalId, s] as [unknown, typeof s]),
      async (stage) => {
        const raw = await fetchStandings(stage.externalId);
        const rows = raw.map((item) => {
          const parsed = psStandingSchema.safeParse(item);
          if (!parsed.success) {
            const issue = parsed.error.issues[0];
            throw new UnsupportedRecordError(`classificação da fase ${stage.externalId}: ${issue.path.join(".")} ${issue.message}`);
          }
          return mapStanding(parsed.data);
        });

        const teamIds: string[] = [];
        for (const row of rows) teamIds.push(await upsertTeam(db, row.team, cache));

        await db.$transaction(async (tx) => {
          await tx.stageStanding.deleteMany({ where: { stageId: stage.id, teamId: { notIn: teamIds } } });
          for (const [i, row] of rows.entries()) {
            const data = {
              rank: row.rank,
              wins: row.wins,
              losses: row.losses,
              mapWins: row.mapWins,
              mapLosses: row.mapLosses,
            };
            await tx.stageStanding.upsert({
              where: { stageId_teamId: { stageId: stage.id, teamId: teamIds[i] } },
              create: { stageId: stage.id, teamId: teamIds[i], ...data },
              update: data,
            });
          }
        });
      },
    );
  });
}
