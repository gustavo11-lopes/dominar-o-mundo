import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { MATCHES_TAG } from "@/server/queries/matches";
import { pandaScoreFetcher, syncMatches } from "@/server/sync/matches";

export const maxDuration = 60;

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

  try {
    const report = await syncMatches(db, pandaScoreFetcher(token));
    if (report.status === "ok") {
      if (report.saved > 0) revalidateTag(MATCHES_TAG, "max");
      for (const f of report.failed) console.warn(`[sync] partida ignorada ${String(f.id)}: ${f.reason}`);
      return Response.json({ status: "ok", fetched: report.fetched, saved: report.saved, failed: report.failed.length });
    }
    return Response.json(report);
  } catch (err) {
    console.error("[sync] falhou", err);
    return Response.json({ error: { code: "SYNC_FAILED" } }, { status: 502 });
  }
}
