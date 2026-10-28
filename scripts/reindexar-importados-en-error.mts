// Reindexa los documentos de un lote de importación que quedaron en estado «error» (o atascados) (p. ej. porque
// el proveedor de embeddings se quedó sin crédito a mitad de la importación). El PDF ya está en
// Storage: se descarga de ahí y se vuelve a pasar por processPdfForSearch.
//
//   npx tsx --env-file=../../../.env.local scripts/reindexar-importados-en-error.mts --lote gobpe-oece
//       Simulación (por defecto): lista qué reindexaría y con qué error cayó cada uno.
//
//   ... --aplicar [--concurrencia 2]
//
// Con --incluir-atascados también toma los que quedaron en «processing» o «uploaded» (una
// importación interrumpida a mitad). Úsese solo con ninguna importación en marcha.
//
// El importador omite lo que ya figura en ACE (aunque esté en error), así que sin este script
// esos documentos no se reintentan nunca.

import { downloadStorageObject, supabaseRest, type DocumentRecord } from "@/lib/supabase-server";
import { processPdfForSearch } from "@/lib/pdf-processing";

const args = process.argv.slice(2);
const flag = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const apply = args.includes("--aplicar");
const batch = flag("--lote");
const concurrency = Math.max(1, Number(flag("--concurrencia") ?? 2));
const stuck = args.includes("--incluir-atascados");
if (!batch || batch.startsWith("--")) {
  console.error("Uso: reindexar-importados-en-error.mts --lote <prefijo del importBatch> [--aplicar] [--concurrencia N]");
  process.exit(1);
}

const rows = await supabaseRest<DocumentRecord[]>(
  `documents?status=in.(${stuck ? "error,processing,uploaded" : "error"})&metadata->>importBatch=like.${encodeURIComponent(batch)}*&select=*&order=created_at.asc&limit=1000`,
);
console.log(`${apply ? "APLICANDO" : "SIMULACIÓN"} · lote «${batch}*» · en error: ${rows.length}`);
for (const row of rows) console.log(`  ${row.title} — ${String(row.error_message ?? "").replace(/\s+/g, " ").slice(0, 90)}`);
if (!apply || rows.length === 0) {
  if (!apply) console.log("Simulación terminada. Repite con --aplicar para reindexar.");
  process.exit(0);
}

let ok = 0;
let failed = 0;
let next = 0;
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (next < rows.length) {
      const document = rows[next++];
      try {
        const blob = await downloadStorageObject(document.storage_bucket, document.storage_path);
        const file = new File([blob], document.file_name, { type: document.mime_type || "application/pdf" });
        await processPdfForSearch(document, file);
        ok += 1;
        console.log(`${document.title} · reindexado`);
      } catch (error) {
        failed += 1;
        console.error(`${document.title} · ERROR: ${error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 160) : String(error)}`);
      }
    }
  }),
);
console.log(`\nTerminado: ${ok} reindexados, ${failed} con error.`);
process.exit(failed > 0 ? 1 : 0);
