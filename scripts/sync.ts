// Sincronização manual: `npm run sync`. Útil na primeira carga e para depurar.
import "dotenv/config";
import { db } from "@/lib/db";
import { runAllSyncs } from "@/server/sync/run";

async function main() {
  const token = process.env.PANDASCORE_TOKEN;
  if (!token) throw new Error("PANDASCORE_TOKEN não está definido.");

  const started = Date.now();
  const results = await runAllSyncs(db, token);

  for (const [name, r] of Object.entries(results)) {
    if (r.status === "ok") {
      const window = r.since ? `desde ${r.since.toISOString()}` : "primeira carga";
      console.log(`${name}: ${r.saved}/${r.fetched} salvos (${window})`);
      for (const f of r.failed) console.warn(`  ignorado ${String(f.id)}: ${f.reason}`);
    } else if (r.status === "skipped") {
      console.log(`${name}: pulado, ${r.reason}`);
    } else {
      console.error(`${name}: ERRO ${r.message}`);
      process.exitCode = 1;
    }
  }
  console.log(`Total: ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
