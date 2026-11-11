// Sincronização manual: `npm run sync`. Útil na primeira carga e para depurar.
import "dotenv/config";
import { db } from "@/lib/db";
import { pandaScoreFetcher, syncMatches } from "@/server/sync/matches";

async function main() {
  const token = process.env.PANDASCORE_TOKEN;
  if (!token) throw new Error("PANDASCORE_TOKEN não está definido.");

  const started = Date.now();
  const report = await syncMatches(db, pandaScoreFetcher(token));
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  if (report.status === "skipped") {
    console.log(`Nada feito: ${report.reason}.`);
    return;
  }
  console.log(
    `${report.saved}/${report.fetched} partidas salvas em ${seconds}s ` +
      `(janela: ${report.since ? `desde ${report.since.toISOString()}` : "primeira carga"}).`,
  );
  for (const f of report.failed) console.warn(`  ignorada ${String(f.id)}: ${f.reason}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
