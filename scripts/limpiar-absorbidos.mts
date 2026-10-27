// Borra los fragmentos antiguos que dejo el defecto de las disposiciones: el ultimo
// articulo (100 de la Ley, 389 del Reglamento) absorbia las disposiciones, y su
// texto truncado quedo en fragmentos con ese numero y paginas que no son suyas
// (29-36, 94-196). Una vez indexadas las disposiciones con
// scripts/indexar-disposiciones.mts, ese contenido esta duplicado y mal etiquetado.
//
//   npx tsx --env-file=../../../.env.local scripts/limpiar-absorbidos.mts
//       Simulacion (por defecto): dice que borraria y que porcentaje de ese texto
//       esta cubierto por lo que se queda. No escribe nada.
//
//   ... --aplicar [--doc <id>]... [--respaldo <carpeta>]
//       Inserta el articulo real como fragmento nuevo, borra los obsoletos (BD y
//       Pinecone) y corrige norma_articulos. Antes guarda en --respaldo (por
//       defecto, la carpeta temporal del sistema) las filas que va a borrar.
//
// Se niega a borrar si menos del 98 % del texto esta cubierto por lo que queda o si
// las disposiciones aun no estan indexadas.
//
// Los chat_sources que citaban un fragmento borrado quedan con chunk_id nulo (FK
// ON DELETE SET NULL): conservan su texto, pierden el enlace al fragmento.

import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadStorageObject, supabaseRest, type DocumentRecord } from "@/lib/supabase-server";
import { cleanAbsorbedArticleChunks, extractPdfText } from "@/lib/pdf-processing";

const args = process.argv.slice(2);
const apply = args.includes("--aplicar");
const explicitIds = args.flatMap((arg, i) => (arg === "--doc" && args[i + 1] ? [args[i + 1]] : []));
const backupDir = args.includes("--respaldo") ? args[args.indexOf("--respaldo") + 1] : join(tmpdir(), "ace-respaldo-absorbidos");

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

if (apply) mkdirSync(backupDir, { recursive: true });
console.log(`${apply ? "APLICANDO" : "SIMULACION"} sobre ${selected.length} documento(s)${apply ? ` · respaldo en ${backupDir}` : ""}\n`);

let failures = 0;

for (const doc of selected) {
  console.log(`• ${doc.title.slice(0, 70)}  [${doc.id}]`);
  try {
    const blob = await downloadStorageObject(doc.storage_bucket, doc.storage_path);
    const extracted = await extractPdfText(new File([blob], doc.file_name, { type: "application/pdf" }));
    if (extracted.ocrPartial) {
      console.log("  OMITIDO: OCR parcial; no hay texto fiable contra el que comparar.\n");
      continue;
    }

    const report = await cleanAbsorbedArticleChunks(doc, extracted.pages, {
      apply,
      backup: (payload) => {
        const file = join(backupDir, `${doc.id}.json`);
        writeFileSync(file, JSON.stringify(payload, null, 2));
        console.log(`  respaldo: ${file}`);
      },
    });
    console.log(`  ultimo articulo: ${report.lastArticle}`);
    console.log(
      `  fragmentos obsoletos: ${report.obsolete.length}` +
        (report.obsolete.length ? ` (#${report.obsolete.map((c) => c.chunk_index).join(", #")}; p.${report.obsolete[0].page_start}-${report.obsolete[0].page_end})` : ""),
    );
    if (report.obsolete.length) {
      console.log(`  texto cubierto por lo que se queda: ${(report.coverage * 100).toFixed(1)} %`);
      console.log(`  ${apply ? "insertado" : "se insertaria"} el articulo real en ${report.chunksToAdd} fragmento(s)`);
    }
    for (const warning of report.warnings) console.log(`  AVISO: ${warning}`);
    if (apply && report.applied) console.log(`  borrados ${report.obsolete.length} fragmentos obsoletos`);
    console.log("");
  } catch (error) {
    failures += 1;
    console.error(`  ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
  }
}

if (!apply) console.log("Simulacion terminada. Repite con --aplicar para escribir.");
process.exit(failures > 0 ? 1 : 0);
