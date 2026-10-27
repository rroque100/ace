// Indexa las disposiciones complementarias (finales, transitorias, modificatorias
// y derogatorias) que faltan en la Ley 32069 y su Reglamento ya indexados.
//
//   npx tsx --env-file=../../../.env.local scripts/indexar-disposiciones.mts
//       Simulacion (por defecto): descarga cada PDF, detecta las disposiciones y
//       dice que anadiria. No escribe nada.
//
//   ... --aplicar [--doc <id>]...
//       Inserta fragmentos, filas de norma_articulos y vectores NUEVOS. No
//       reindexa ni modifica lo existente; es idempotente (una segunda pasada no
//       anade nada).
//
// Sin --doc procesa los cuatro documentos de la Ley 32069 y su Reglamento (copias
// oficial y SPIJ). Para otra norma, pasa su id con --doc.
//
// Por que existe: el ultimo articulo de cada norma absorbia las disposiciones y se
// truncaba a 24 000 caracteres, de modo que la derogatoria (la que deroga la Ley
// 30225) nunca llego al indice. Ver lib/disposiciones-normativas.ts.

import { downloadStorageObject, supabaseRest, type DocumentRecord } from "@/lib/supabase-server";
import { extractPdfText, indexMissingDispositions } from "@/lib/pdf-processing";

const args = process.argv.slice(2);
const apply = args.includes("--aplicar");
const explicitIds = args.flatMap((arg, i) => (arg === "--doc" && args[i + 1] ? [args[i + 1]] : []));

type Row = DocumentRecord & { file_name: string; storage_bucket: string; storage_path: string };

const baseTitles =
  /^(Ley general de contrataciones publicas|Reglamento de la ley general de contrataciones publi|Ley N\.° 32069|Reglamento de la Ley N\.° 32069)/i;

const all = await supabaseRest<Row[]>(
  "documents?es_institucional=eq.true&status=eq.indexed&document_type=in.(ley,reglamento)&order=title.asc",
);
const selected = explicitIds.length > 0 ? all.filter((doc) => explicitIds.includes(doc.id)) : all.filter((doc) => baseTitles.test(doc.title));

if (selected.length === 0) {
  console.error("Ningun documento seleccionado. Revisa --doc o el filtro por titulo.");
  process.exit(1);
}

console.log(`${apply ? "APLICANDO" : "SIMULACION"} sobre ${selected.length} documento(s)\n`);

let failures = 0;

for (const doc of selected) {
  console.log(`• ${doc.title.slice(0, 70)}  [${doc.id}]`);
  try {
    const blob = await downloadStorageObject(doc.storage_bucket, doc.storage_path);
    const extracted = await extractPdfText(new File([blob], doc.file_name, { type: "application/pdf" }));

    // Una copia escaneada con OCR parcial no tiene la cola del documento: no hay
    // nada fiable que indexar y se prefiere avisar a insertar texto a medias.
    if (extracted.ocrPartial) {
      console.log(`  OMITIDO: OCR parcial (${extracted.pages.length} de ${extracted.pageCount} paginas); no contiene la cola de la norma.\n`);
      continue;
    }

    const report = await indexMissingDispositions(doc, extracted.pages, { apply });
    console.log(`  detectadas ${report.detected.length}: ${report.detected.join(" ")}`);
    console.log(`  ya indexadas ${report.alreadyIndexed.length}`);
    console.log(`  ${apply ? "anadidas" : "se anadirian"} ${report.missing.length} disposiciones en ${report.chunksToAdd} fragmentos`);
    for (const warning of report.warnings) console.log(`  AVISO: ${warning}`);
    console.log("");
  } catch (error) {
    failures += 1;
    console.error(`  ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
  }
}

if (!apply) {
  console.log("Simulacion terminada. Repite con --aplicar para escribir.");
}
process.exit(failures > 0 ? 1 : 0);
