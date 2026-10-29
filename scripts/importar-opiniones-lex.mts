// Importa a ACE las opiniones de la DTN descargadas de LEX Contrataciones que ACE aún
// no tiene: las sube a Storage, las registra como documentos institucionales y las
// indexa (extracción, fragmentos, embeddings, Pinecone) con el mismo pipeline que la
// subida web (processPdfForSearch).
//
//   npx tsx --env-file=../../../.env.local scripts/importar-opiniones-lex.mts --dir <carpeta>
//       Simulación (por defecto): dice qué importaría y qué omite. No escribe nada.
//
//   ... --aplicar [--limite 20]
//       Sube, registra e indexa de uno en uno. Es idempotente: una segunda pasada omite
//       lo ya importado (por número de opinión y por hash del archivo).
//
// Convención de nombres de archivo (la que deja la descarga):
//   ley-32069__opinion-d000092-2026-oece-dtn.pdf   →  Opinión N° D000092-2026-OECE-DTN
//
// El régimen NO se da por bueno: LEX clasifica estas opiniones por régimen, pero ACE
// guarda «no_determinado» + revisión pendiente, como las demás opiniones importadas.
// La clasificación de LEX queda anotada en metadata.lexClasificacion.

import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { supabaseRest, uploadPdfToStorage, type DocumentRecord } from "@/lib/supabase-server";
import { processPdfForSearch } from "@/lib/pdf-processing";
import { assertEmbeddingCredit, creditStopMessage, isEmbeddingCreditExhausted } from "@/lib/embedding-credit";

const args = process.argv.slice(2);
const apply = args.includes("--aplicar");
const dir = args[args.indexOf("--dir") + 1];
const limit = args.includes("--limite") ? Number(args[args.indexOf("--limite") + 1]) : Infinity;
if (!dir || dir.startsWith("--")) {
  console.error("Uso: importar-opiniones-lex.mts --dir <carpeta con los PDF> [--aplicar] [--limite N]");
  process.exit(1);
}

const numberKey = (text: string) => {
  const match = text.match(/(\d{1,6})\s*-\s*(\d{4})/);
  return match ? `${Number(match[1])}-${match[2]}` : null;
};

type Candidate = { file: string; bytes: number; regimeTag: string; number: string; title: string; key: string; sha256: string; entity: string };

// Solo los archivos con el prefijo de la descarga: el resto de la carpeta ni se abre.
const files = readdirSync(dir).filter((name) => /^ley-\d+__opinion-.+\.pdf$/i.test(name)).sort();
const invalid: string[] = [];
const candidates: Candidate[] = [];

for (const file of files) {
  const path = join(dir, file);
  const body = readFileSync(path);
  const parsed = file.match(/^(ley-\d+)__opinion-(.+)\.pdf$/i);
  if (!parsed || body.length < 2000 || body.subarray(0, 5).toString("latin1") !== "%PDF-") {
    invalid.push(file);
    continue;
  }
  const number = parsed[2].toUpperCase();
  const key = numberKey(number);
  if (!key) {
    invalid.push(file);
    continue;
  }
  candidates.push({
    bytes: body.length,
    entity: /OECE/.test(number) ? "OECE - Dirección Técnico Normativa" : "OSCE",
    file,
    key,
    number,
    regimeTag: parsed[1].toLowerCase(),
    sha256: createHash("sha256").update(body).digest("hex"),
    title: `Opinión N° ${number}`,
  });
}

// Lo que ACE ya tiene, por número de opinión y por hash.
const existing = await supabaseRest<Array<{ title: string; metadata: Record<string, unknown> | null }>>(
  "documents?document_type=eq.opinion&select=title,metadata&limit=2000",
);
const haveKeys = new Set<string>();
const haveHashes = new Set<string>();
for (const row of existing) {
  const key = numberKey(String(row.metadata?.documentNumber ?? row.metadata?.number ?? row.title));
  if (key) haveKeys.add(key);
  if (typeof row.metadata?.sha256 === "string") haveHashes.add(row.metadata.sha256);
}

const duplicates: Candidate[] = [];
const toImport: Candidate[] = [];
const seenInBatch = new Set<string>();
for (const candidate of candidates) {
  if (haveKeys.has(candidate.key) || haveHashes.has(candidate.sha256) || seenInBatch.has(candidate.key)) {
    duplicates.push(candidate);
    continue;
  }
  seenInBatch.add(candidate.key);
  toImport.push(candidate);
}
const selected = toImport.slice(0, limit);
const mb = (n: number) => (n / 1048576).toFixed(1);

console.log(`${apply ? "APLICANDO" : "SIMULACIÓN"} · carpeta: ${dir}`);
console.log(`PDF en la carpeta: ${files.length} · no válidos o con nombre irreconocible: ${invalid.length}`);
for (const name of invalid) console.log(`  no válido: ${name}`);
console.log(`ACE ya tiene: ${duplicates.length}${duplicates.length ? " (" + duplicates.map((d) => d.number).join(", ") + ")" : ""}`);
console.log(`A importar: ${toImport.length} (${mb(toImport.reduce((s, c) => s + c.bytes, 0))} MB)${selected.length < toImport.length ? ` · en esta pasada: ${selected.length}` : ""}`);
const byRegime = new Map<string, number>();
for (const c of toImport) byRegime.set(c.regimeTag, (byRegime.get(c.regimeTag) ?? 0) + 1);
console.log("por clasificación de LEX:", [...byRegime].map(([k, v]) => `${k}: ${v}`).join(" · ") || "—");

if (!apply) {
  console.log("\nPrimeras de la lista:", selected.slice(0, 5).map((c) => c.number).join(", "));
  console.log("Simulación terminada. Repite con --aplicar para escribir.");
  process.exit(0);
}

// Sin crédito de embeddings cada PDF quedaría como fila en `error` (ver lib/embedding-credit.ts).
await assertEmbeddingCredit();
const batch = `lex-opiniones-${new Date().toISOString().slice(0, 10)}`;
let imported = 0;
let failed = 0;
let sinCredito = false;
for (const [index, candidate] of selected.entries()) {
  if (sinCredito) break;
  const label = `[${index + 1}/${selected.length}] ${candidate.number}`;
  try {
    const body = readFileSync(join(dir, candidate.file));
    const file = new File([body], `${candidate.number}.pdf`, { type: "application/pdf" });
    const storagePath = `official/${batch}/${randomUUID()}.pdf`;
    await uploadPdfToStorage(storagePath, file);
    const [document] = await supabaseRest<DocumentRecord[]>("documents", {
      body: JSON.stringify({
        document_type: "opinion",
        es_institucional: true,
        file_name: file.name,
        file_size: body.length,
        metadata: {
          documentNumber: candidate.number,
          importBatch: batch,
          legalReviewStatus: "pendiente",
          lexClasificacion: candidate.regimeTag.replace("ley-", "Ley "),
          number: candidate.number,
          regime: "no_determinado",
          selectionNote:
            "Opinión descargada de LEX Contrataciones (listado «Opiniones de la DTN»); el régimen y su aplicación quedan pendientes de revisión.",
          sha256: candidate.sha256,
          uploadSource: "lex-import",
          year: Number(candidate.key.split("-")[1]),
        },
        mime_type: "application/pdf",
        oficina_id: null,
        process_type: null,
        source_entity: candidate.entity,
        status: "uploaded",
        storage_bucket: "documents",
        storage_path: storagePath,
        title: candidate.title,
      }),
      method: "POST",
    });
    await processPdfForSearch(document, file);
    imported += 1;
    console.log(`${label} · importada e indexada`);
  } catch (error) {
    failed += 1;
    console.error(`${label} · ERROR: ${error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 200) : String(error)}`);
    if (isEmbeddingCreditExhausted(error)) sinCredito = true;
  }
}
console.log(`\nTerminado: ${imported} importadas, ${failed} con error.`);
if (sinCredito) {
  console.error(creditStopMessage(Math.max(0, selected.length - imported - failed), `Tras recargar: reindexar-importados-en-error.mts --lote ${batch} --aplicar para las que quedaron en error, y repite este mismo comando para el resto (lo ya importado se omite).`));
  process.exit(2);
}
process.exit(failed > 0 ? 1 : 0);
