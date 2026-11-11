import type { PrismaClient } from "@/generated/prisma/client";
import type { SyncResource } from "@/generated/prisma/enums";
import { UnsupportedRecordError } from "@/server/pandascore/map";

export const SOURCE = "PANDASCORE" as const;
/** Sobreposição entre janelas, para não perder registros alterados durante a execução anterior. */
const OVERLAP_MS = 5 * 60_000;
/** Execução travada há mais tempo que isso é considerada morta e pode ser assumida. */
const LEASE_MS = 10 * 60_000;

export type Failure = { id: unknown; reason: string };
export type RunResult = { fetched: number; saved: number; failed: Failure[] };
export type SyncReport = { status: "skipped"; reason: string } | ({ status: "ok"; since: Date | null } & RunResult);

export function describeError(err: unknown): string {
  if (err instanceof UnsupportedRecordError) return err.message;
  if (err instanceof Error) return `${err.name}: ${err.message.split("\n").at(-1)?.slice(0, 300)}`;
  return String(err);
}

/** Processa cada item isoladamente: um registro ruim vai para `failed` e não derruba os demais. */
export async function eachRecord<T>(
  items: Iterable<[unknown, T]>,
  save: (item: T) => Promise<void>,
): Promise<RunResult> {
  const failed: Failure[] = [];
  let fetched = 0;
  let saved = 0;
  for (const [id, item] of items) {
    fetched++;
    try {
      await save(item);
      saved++;
    } catch (err) {
      failed.push({ id, reason: describeError(err) });
    }
  }
  return { fetched, saved, failed };
}

/**
 * Executa `work` com exclusividade para o recurso. `since` é o início da janela incremental
 * (nulo na primeira execução). Tudo usa o relógio `now`, inclusive o fim da execução.
 */
export async function runWithLease(
  db: PrismaClient,
  resource: SyncResource,
  now: Date,
  work: (since: Date | null) => Promise<RunResult>,
): Promise<SyncReport> {
  const t0 = Date.now();
  const finishedAt = () => new Date(now.getTime() + (Date.now() - t0));
  const where = { source_resource: { source: SOURCE, resource } };

  await db.syncState.upsert({ where, create: { source: SOURCE, resource }, update: {} });
  const staleBefore = new Date(now.getTime() - LEASE_MS);
  const rows = await db.$queryRaw<{ last_success_at: Date | null }[]>`
    UPDATE "sync_state" SET "last_started_at" = ${now}
    WHERE "source" = 'PANDASCORE' AND "resource" = ${resource}::"SyncResource"
      AND (
        "last_started_at" IS NULL
        OR ("last_finished_at" IS NOT NULL AND "last_finished_at" >= "last_started_at")
        OR "last_started_at" < ${staleBefore}
      )
    RETURNING "last_success_at"`;
  if (rows.length !== 1) return { status: "skipped", reason: "outra sincronização em andamento" };

  const last = rows[0].last_success_at;
  const since = last ? new Date(last.getTime() - OVERLAP_MS) : null;

  try {
    const result = await work(since);
    await db.syncState.update({
      where,
      data: {
        lastSuccessAt: now,
        lastFinishedAt: finishedAt(),
        lastError: result.failed.length
          ? `${result.failed.length} registro(s) ignorado(s). Primeiro: ${result.failed[0].reason}`
          : null,
      },
    });
    return { status: "ok", since, ...result };
  } catch (err) {
    await db.syncState.update({ where, data: { lastFinishedAt: finishedAt(), lastError: describeError(err) } });
    throw err;
  }
}

/** Indexa por id; a última ocorrência de um id repetido prevalece. */
export function dedupeById(raw: unknown[]): Map<unknown, unknown> {
  const byId = new Map<unknown, unknown>();
  for (const item of raw) byId.set((item as { id?: unknown })?.id, item);
  return byId;
}
