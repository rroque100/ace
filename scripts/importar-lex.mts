// Importa a ACE los documentos (opiniones de la DTN, resoluciones del TCP) descargados de
// LEX Contrataciones que ACE aún no tiene: los sube a Storage, los registra como
// documentos institucionales y los indexa (extracción, fragmentos, embeddings, Pinecone)
// con el mismo pipeline que la subida web (processPdfForSearch).
//
//   npx tsx --env-file=../../../.env.local scripts/importar-lex.mts --dir <carpeta>
//       Simulación (por defecto): dice qué importaría y qué omite. No escribe nada.
//
//   ... --aplicar [--limite 100] [--concurrencia 3]
//       Sube, registra e indexa. Es idempotente: una segunda pasada omite lo ya importado
//       (por número de documento, y por hash del archivo).
//
// Convención de nombres de archivo (la que deja la descarga):
//   ley-32069__opinion-d000092-2026-oece-dtn.pdf   →  Opinión N° D000092-2026-OECE-DTN
//   ley-32069__resolucion-05748-2026-tcp-s6.pdf    →  Resolución N.° 05748-2026-TCP-S6
//
// El régimen NO se da por bueno: LEX clasifica estos documentos por régimen, pero ACE guarda
// «no_determinado» + revisión pendiente, como los demás documentos importados. La
// clasificación de LEX queda anotada en metadata.lexClasificacion.
//
// Para una carpeta que crece mientras se importa (descarga automática), solo se abren los
// archivos que pasan el filtro por nombre y todavía no están en ACE: los ya importados no se
// vuelven a leer.

import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { supabaseRest, uploadPdfToStorage, type DocumentRecord } from "@/lib/supabase-server";
import { processPdfForSearch } from "@/lib/pdf-processing";

const args = process.argv.slice(2);
const apply = args.includes("--aplicar");
const flag = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const dir = flag("--dir");
const limit = flag("--limite") ? Number(flag("--limite")) : Infinity;
const concurrency = Math.max(1, Number(flag("--concurrencia") ?? 1));
if (!dir || dir.startsWith("--")) {
  console.error("Uso: importar-lex.mts --dir <carpeta con los PDF> [--aplicar] [--limite N] [--concurrencia N]");
  process.exit(1);
}

type Kind = "opinion" | "resolucion";
const KINDS: Record<Kind, { documentType: string; label: (n: string) => string; entity: (n: string) => string; note: string }> = {
  opinion: {
    documentType: "opinion",
    entity: (n) => (/OECE/.test(n) ? "OECE - Dirección Técnico Normativa" : "OSCE"),
    label: (n) => `Opinión N° ${n}`,
    note: "Opinión descargada de LEX Contrataciones (listado «Opiniones de la DTN»); el régimen y su aplicación quedan pendientes de revisión.",
  },
  resolucion: {
    documentType: "resolucion",
    entity: () => "OECE",
    label: (n) => `Resolución N.° ${n}`,
    note: "Resolución del Tribunal de Contrataciones descargada de LEX Contrataciones (listado «Resoluciones del TCP»); el régimen y su aplicación quedan pendientes de revisión.",
  },
};

/** Clave de deduplicación: número sin ceros a la izquierda + año + sufijo (sala, órgano). */
const numberKey = (text: string) => {
  const match = text.match(/(\d{1,6})\s*-\s*(\d{4})(.*)$/);
  if (!match) return null;
  const tail = match[3].replace(/[^a-z0-9]/gi, "").toLowerCase();
  return `${Number(match[1])}-${match[2]}${tail ? "-" + tail : ""}`;
};

type Candidate = { file: string; kind: Kind; regimeTag: string; number: string; key: string };

const files = readdirSync(dir).filter((name) => /^ley-\d+__(opinion|resolucion)-.+\.pdf$/i.test(name)).sort();
const unrecognized: string[] = [];
const candidates: Candidate[] = [];
for (const file of files) {
  const parsed = file.match(/^(ley-\d+)__(opinion|resolucion)-(.+)\.pdf$/i)!;
  const number = parsed[3].toUpperCase();
  const key = numberKey(number);
  if (!key) {
    unrecognized.push(file);
    continue;
  }
  candidates.push({ file, key, kind: parsed[2].toLowerCase() as Kind, number, regimeTag: parsed[1].toLowerCase() });
}

// Lo que ACE ya tiene, por tipo y número.
const kindsPresent = [...new Set(candidates.map((c) => c.kind))];
const haveKeys = new Map<Kind, Set<string>>();
const haveHashes = new Set<string>();
for (const kind of kindsPresent) {
  const keys = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const rows = await supabaseRest<Array<{ title: string; metadata: Record<string, unknown> | null }>>(
      `documents?document_type=eq.${KINDS[kind].documentType}&select=title,metadata&order=created_at.asc&limit=1000&offset=${offset}`,
    );
    for (const row of rows) {
      const key = numberKey(String(row.metadata?.documentNumber ?? row.metadata?.number ?? row.title));
      if (key) keys.add(key);
      if (typeof row.metadata?.sha256 === "string") haveHashes.add(row.metadata.sha256);
    }
    if (rows.length < 1000) break;
  }
  haveKeys.set(kind, keys);
}

const duplicates: Candidate[] = [];
let toImport: Candidate[] = [];
const seenInBatch = new Set<string>();
for (const candidate of candidates) {
  const id = `${candidate.kind}|${candidate.key}`;
  if (haveKeys.get(candidate.kind)!.has(candidate.key) || seenInBatch.has(id)) {
    duplicates.push(candidate);
    continue;
  }
  seenInBatch.add(id);
  toImport.push(candidate);
}

// Solo ahora se abren archivos: los pendientes. Validación de PDF y hash.
type Ready = Candidate & { bytes: Buffer; sha256: string };
const invalid: string[] = [];
const ready: Ready[] = [];
for (const candidate of toImport) {
  if (ready.length >= limit) break;
  const bytes = readFileSync(join(dir, candidate.file));
  if (bytes.length < 2000 || bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    invalid.push(candidate.file);
    continue;
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (haveHashes.has(sha256)) {
    duplicates.push(candidate);
    continue;
  }
  ready.push({ ...candidate, bytes, sha256 });
}
const mb = (n: number) => (n / 1048576).toFixed(1);
toImport = ready;

console.log(`${apply ? "APLICANDO" : "SIMULACIÓN"} · carpeta: ${dir}`);
console.log(`PDF con nombre reconocido: ${files.length} · irreconocibles: ${unrecognized.length} · no válidos: ${invalid.length}`);
for (const name of [...unrecognized, ...invalid]) console.log(`  omitido: ${name}`);
console.log(`ACE ya tiene: ${duplicates.length}`);
console.log(`A importar${Number.isFinite(limit) ? ` (límite ${limit})` : ""}: ${ready.length} (${mb(ready.reduce((s, c) => s + c.bytes.length, 0))} MB)`);
if (!apply) {
  console.log("Primeras:", ready.slice(0, 5).map((c) => c.number).join(", "));
  console.log("Simulación terminada. Repite con --aplicar para escribir.");
  process.exit(0);
}

const batch = `lex-${new Date().toISOString().slice(0, 10)}`;
let imported = 0;
let failed = 0;
let next = 0;

async function importOne(candidate: Ready, label: string) {
  const kind = KINDS[candidate.kind];
  const file = new File([new Uint8Array(candidate.bytes)], `${candidate.number}.pdf`, { type: "application/pdf" });
  const storagePath = `official/${batch}/${randomUUID()}.pdf`;
  await uploadPdfToStorage(storagePath, file);
  const [document] = await supabaseRest<DocumentRecord[]>("documents", {
    body: JSON.stringify({
      document_type: kind.documentType,
      es_institucional: true,
      file_name: file.name,
      file_size: candidate.bytes.length,
      metadata: {
        documentNumber: candidate.number,
        importBatch: batch,
        legalReviewStatus: "pendiente",
        lexClasificacion: candidate.regimeTag.replace("ley-", "Ley "),
        number: candidate.number,
        regime: "no_determinado",
        selectionNote: kind.note,
        sha256: candidate.sha256,
        uploadSource: "lex-import",
        year: Number(candidate.key.split("-")[1]),
      },
      mime_type: "application/pdf",
      oficina_id: null,
      process_type: null,
      source_entity: kind.entity(candidate.number),
      status: "uploaded",
      storage_bucket: "documents",
      storage_path: storagePath,
      title: kind.label(candidate.number),
    }),
    method: "POST",
  });
  await processPdfForSearch(document, file);
  console.log(`${label} · importada e indexada`);
}

await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (next < ready.length) {
      const index = next++;
      const candidate = ready[index];
      const label = `[${index + 1}/${ready.length}] ${candidate.number}`;
      try {
        await importOne(candidate, label);
        imported += 1;
      } catch (error) {
        failed += 1;
        console.error(`${label} · ERROR: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }),
);
console.log(`\nTerminado: ${imported} importadas, ${failed} con error.`);
process.exit(failed > 0 ? 1 : 0);
