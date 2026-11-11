import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { DATA_TAG } from "@/server/queries/tags";
import { runAllSyncs } from "@/server/sync/run";

// A primeira carga (catálogo inteiro de times) passa de 1 minuto.
export const maxDuration = 300;

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** Chamado pelo agendador com `Authorization: Bearer CRON_SECRET`. O agendador é configurado no deploy. */
export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const token = process.env.PANDASCORE_TOKEN;
  if (!token) {
    console.error("[sync] PANDASCORE_TOKEN ausente");
    return Response.json({ error: { code: "SYNC_NOT_CONFIGURED" } }, { status: 500 });
  }

  const results = await runAllSyncs(db, token);
  const summary: Record<string, unknown> = {};
  let changed = false;
  let failed = false;

  for (const [name, r] of Object.entries(results)) {
    if (r.status === "ok") {
      changed ||= r.saved > 0;
      for (const f of r.failed) console.warn(`[sync] ${name}: ignorado ${String(f.id)}: ${f.reason}`);
      summary[name] = { status: "ok", fetched: r.fetched, saved: r.saved, failed: r.failed.length };
    } else if (r.status === "skipped") {
      summary[name] = r;
    } else {
      failed = true;
      summary[name] = { status: "error" };
    }
  }

  if (changed) revalidateTag(DATA_TAG, "max");
  return Response.json(summary, { status: failed ? 502 : 200 });
}
