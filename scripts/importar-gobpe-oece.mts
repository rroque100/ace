// Importa a ACE, desde la página oficial del OECE en gob.pe, las resoluciones del Tribunal de
// Contrataciones Públicas (TCP) y los Acuerdos de Sala Plena que ACE aún no tiene: baja el PDF
// original del CDN oficial, lo guarda en Storage, lo registra como documento institucional y lo
// indexa con el pipeline normal (processPdfForSearch). La URL oficial queda en los metadatos.
//
//   npx tsx --env-file=../../../.env.local scripts/importar-gobpe-oece.mts --tipo resolucion-tcp \
//       --desde 2026-01-01 --hasta 2026-12-31
//       Simulación (por defecto): lee el listado, dice cuántas faltan, cuánto pesarían (muestra
//       por HEAD al CDN) y cuántas ya están en ACE. No descarga PDF ni escribe nada.
//
//   ... --aplicar [--limite 500] [--concurrencia 3] [--orden desc|asc]
//       Descarga, sube e indexa. Idempotente: se puede interrumpir y repetir; omite lo que ya está
//       en ACE (por número de documento, URL oficial y hash). Por defecto, lo más reciente primero.
//
// Tipos: resolucion-tcp (filtro «Resolución» + texto TCP) y sala-plena (Acuerdo de Sala Plena).
//
// Por qué de aquí y no de LEX: es la fuente oficial, pública, sin sesión que caduque ni términos
// de suscripción por medio. Cada tarjeta del listado ya trae número, fecha, sumilla y el enlace
// directo al PDF, así que basta una petición por cada 100 documentos y luego el PDF.
//
// El régimen NO se da por bueno: queda «no_determinado» + revisión pendiente, como el resto de
// documentos importados.

import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import pdfParse from "pdf-parse/lib/pdf-parse";
import { downloadOfficialPdf, validateOfficialUrl } from "@/lib/official-import/download";
import { processPdfForSearch } from "@/lib/pdf-processing";
import { supabaseRest, uploadPdfToStorage, type DocumentRecord } from "@/lib/supabase-server";

const args = process.argv.slice(2);
const flag = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const apply = args.includes("--aplicar");
const tipo = flag("--tipo") as keyof typeof TIPOS | undefined;
const only = (flag("--solo") ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
const detail = args.includes("--detalle");
const regimeFilter = flag("--regimen"); // 32069 | 30225: solo importa los que citan esa ley y no la otra
const classifyOnly = args.includes("--clasificar"); // simulación que además lee las primeras páginas de cada PDF
const sampleSize = flag("--muestra") ? Number(flag("--muestra")) : Infinity;
const cachePath = flag("--cache");
const since = flag("--desde");
const until = flag("--hasta");
const limit = flag("--limite") ? Number(flag("--limite")) : Infinity;
const concurrency = Math.max(1, Number(flag("--concurrencia") ?? 3));
const order = flag("--orden") === "asc" ? "asc" : "desc";

const SITE = "https://www.gob.pe/institucion/oece";
const TIPOS = {
  "resolucion-tcp": {
    documentType: "resolucion",
    filterType: "10",
    label: (n: string) => `Resolución N.° ${n}`,
    terms: "TCP",
    titleRe: /^Resoluci[oó]n\s+N.*-\s*TCP/i,
  },
  ley: {
    documentType: "ley",
    filterType: "7",
    label: (n: string) => `Ley N.° ${n}`,
    terms: undefined,
    titleRe: /^Ley\s+N/i,
  },
  "decreto-legislativo": {
    documentType: "ley",
    filterType: "8",
    label: (n: string) => `Decreto Legislativo N.° ${n}`,
    terms: undefined,
    titleRe: /^Decreto Legislativo\s+N/i,
  },
  "decreto-supremo": {
    documentType: "reglamento",
    filterType: "9",
    label: (n: string) => `Decreto Supremo N.° ${n}`,
    terms: undefined,
    titleRe: /^Decreto Supremo\s+N/i,
  },
  // Se publican en «informes-publicaciones», no en «normas-legales». Esa sección no filtra por
  // fechas: se lee de lo más reciente hacia atrás y se corta al pasar de --desde.
  pronunciamiento: {
    documentType: "pronunciamiento",
    filterType: "64",
    label: (n: string) => `Pronunciamiento N° ${n}`,
    section: "informes-publicaciones",
    terms: undefined,
    titleRe: /^Pronunciamiento\s+N/i,
  },
  "sala-plena": {
    documentType: "acuerdo_sala_plena",
    filterType: "73",
    label: (n: string) => `Acuerdo de Sala Plena N.° ${n}`,
    terms: undefined,
    titleRe: /^Acuerdo de Sala Plena/i,
  },
} as const;

if (!tipo || !(tipo in TIPOS)) {
  console.error("Uso: importar-gobpe-oece.mts --tipo resolucion-tcp|sala-plena|ley|decreto-legislativo|decreto-supremo|pronunciamiento [--regimen 32069|30225] [--clasificar] [--muestra N] [--cache archivo.json] [--solo 1341,082-2019-EF] [--detalle] [--desde AAAA-MM-DD] [--hasta AAAA-MM-DD] [--aplicar] [--limite N] [--concurrencia N] [--orden desc|asc]");
  process.exit(1);
}
const kind = TIPOS[tipo] as (typeof TIPOS)[keyof typeof TIPOS] & { section?: string };
const section = kind.section ?? "normas-legales";
const noDateFilter = section !== "normas-legales";
const BASE = `${SITE}/${section}`;
const dmy = (iso: string) => iso.split("-").reverse().join("/");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const decode = (text: string) =>
  text
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

async function getText(url: string, attempts = 4): Promise<string> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "ACE-importacion-oficial/1.0" }, signal: AbortSignal.timeout(45000) });
      if (response.ok) return await response.text();
      if (attempt >= attempts || ![429, 500, 502, 503, 504].includes(response.status)) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt >= attempts) throw error;
    }
    await sleep(2000 * attempt * attempt);
  }
}

const unrecognized: string[] = [];
type Item = { number: string; key: string; title: string; date: string; summary: string; publicationUrl: string; pdfUrl: string };
const numberKey = (text: string) => {
  // Leyes y decretos legislativos: «30225», «1444» (sin año en el número).
  if (/^\d{3,6}$/.test(text)) return String(Number(text));
  // Acuerdos antiguos (2003-2009): «011/006», «04/03» = número/año abreviado.
  const legacy = text.match(/^(\d{1,3})\s*\/\s*(\d{2,4})$/);
  if (legacy) return `${Number(legacy[1])}-${Number(legacy[2]) >= 1000 ? Number(legacy[2]) : 2000 + Number(legacy[2])}`;
  const match = text.match(/(\d{1,6})\s*[-\s]\s*(\d{4})(.*)$/);
  if (!match) return null;
  const tail = match[3].replace(/[^a-z0-9]/gi, "").toLowerCase();
  return `${Number(match[1])}-${match[2]}${tail ? "-" + tail : ""}`;
};

function parseListing(html: string): Item[] {
  const items: Item[] = [];
  for (const card of html.split('<li class="hover:bg-gray-70 relative">').slice(1)) {
    const anchor = card.match(/<a[^>]*card__mock[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/);
    const pdf = card.match(/href="(https:\/\/cdn\.www\.gob\.pe\/uploads\/document\/file\/[^"]+?\.pdf)[^"]*"/);
    const time = card.match(/<time[^>]*datetime="(\d{4}-\d{2}-\d{2})/);
    if (!anchor || !pdf) continue;
    const title = decode(anchor[2]);
    if (!kind.titleRe.test(title)) continue; // la cabecera trae normas destacadas que no son del resultado
    const raw = title.match(/N\s*\.?\s*[°º]\s*(.+)$/i);
    const number = (raw ? raw[1] : title).replace(/\s+/g, "").toUpperCase();
    const key = numberKey(number);
    if (!key) {
      unrecognized.push(title);
      continue;
    }
    const summary = decode(card.match(/<div class="relative z-10"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "");
    items.push({
      date: time?.[1] ?? "",
      key,
      number,
      pdfUrl: validateOfficialUrl(pdf[1]).href,
      publicationUrl: validateOfficialUrl(new URL(anchor[1], "https://www.gob.pe").href).href,
      summary: summary.slice(0, 400),
      title,
    });
  }
  return items;
}

function listingUrl(sheet: number) {
  const url = new URL(BASE);
  url.searchParams.set("filter[type]", kind.filterType);
  if (kind.terms) url.searchParams.set("filter[terms]", kind.terms);
  if (!noDateFilter && since) url.searchParams.set("filter[start_date]", dmy(since));
  if (!noDateFilter && until) url.searchParams.set("filter[end_date]", dmy(until));
  url.searchParams.set("filter[per_page]", "100");
  // asc = orden estable mientras se pagina; en la sección sin filtro de fechas, desc para poder cortar.
  url.searchParams.set("filter[order]", noDateFilter && since ? "publication_desc" : "publication_asc");
  if (sheet > 1) url.searchParams.set("sheet", String(sheet));
  return url.href;
}

// 1. Listado completo (una petición por cada 100 documentos).
const firstPage = await getText(listingUrl(1));
const total = Number(firstPage.match(/([\d.,]+)\s*resultados/)?.[1].replace(/[.,]/g, "") ?? 0);
const pages = Math.max(1, Math.ceil(total / 100));
const listed = new Map<string, Item>();
for (const item of parseListing(firstPage)) listed.set(item.key, item);
const pageIsOlderThanSince = (items: Item[]) => noDateFilter && Boolean(since) && items.length > 0 && items.every((item) => item.date && item.date < since!);
for (let sheet = 2; sheet <= pages; sheet += 1) {
  if (pageIsOlderThanSince([...listed.values()].slice(-100))) break;
  await sleep(1200);
  for (const item of parseListing(await getText(listingUrl(sheet)))) if (!listed.has(item.key)) listed.set(item.key, item);
  if (sheet % 10 === 0) console.log(`  listado: hoja ${sheet}/${pages}, ${listed.size} documentos`);
}

// 2. Lo que ACE ya tiene.
type Existing = { id: string; title: string; metadata: Record<string, unknown> | null };
const existing: Existing[] = [];
for (let offset = 0; ; offset += 1000) {
  const rows = await supabaseRest<Existing[]>(
    `documents?document_type=eq.${kind.documentType}&select=id,title,metadata&order=created_at.asc&limit=1000&offset=${offset}`,
  );
  existing.push(...rows);
  if (rows.length < 1000) break;
}
const haveKey = new Map<string, Existing>();
const haveUrl = new Set<string>();
const haveHash = new Set<string>();
for (const row of existing) {
  const key = numberKey(String(row.metadata?.documentNumber ?? row.metadata?.number ?? row.title));
  if (key) haveKey.set(key, row);
  if (typeof row.metadata?.officialPublicationUrl === "string") haveUrl.add(row.metadata.officialPublicationUrl);
  if (typeof row.metadata?.sha256 === "string") haveHash.add(row.metadata.sha256);
}

const inRange = (item: Item) => (!since || item.date >= since) && (!until || item.date <= until);
const all = [...listed.values()].filter(inRange).sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
if (order === "desc") all.reverse();
const already = all.filter((item) => haveKey.has(item.key) || haveUrl.has(item.publicationUrl));
const missing = all.filter((item) => !haveKey.has(item.key) && !haveUrl.has(item.publicationUrl));
const toEnrich = already.filter((item) => {
  const row = haveKey.get(item.key);
  return row && !row.metadata?.officialPublicationUrl;
});
const regimeOf = (item: Item) => {
  const text = `${item.title} ${item.summary}`;
  if (/\b32069\b|Ley General de Contrataciones P[uú]blicas/i.test(text)) return "Ley 32069";
  if (/\b30225\b|Ley de Contrataciones del Estado/i.test(text)) return "Ley 30225";
  return "otro / sin relación explícita";
};
const wanted = (item: Item) => only.length === 0 || only.some((token) => item.number.toLowerCase().includes(token));
const selected = missing.filter(wanted).slice(0, limit);
if (detail) {
  console.log("\nDetalle de lo publicado:");
  for (const item of all) {
    const inAce = haveKey.has(item.key) || haveUrl.has(item.publicationUrl);
    console.log(`  ${inAce ? "EN ACE " : "FALTA  "} ${regimeOf(item).padEnd(28)} ${item.title.padEnd(34)} ${item.date}  ${item.summary.slice(0, 70)}`);
  }
}

const byMonth = new Map<string, number>();
for (const item of missing) byMonth.set(item.date.slice(0, 7), (byMonth.get(item.date.slice(0, 7)) ?? 0) + 1);
console.log(`${apply ? "APLICANDO" : "SIMULACIÓN"} · ${tipo}${since ? ` desde ${since}` : ""}${until ? ` hasta ${until}` : ""} · orden ${order}`);
console.log(`Resultados según gob.pe: ${total} · leídos y reconocidos: ${listed.size}`);
console.log(`Ya en ACE: ${already.length} (a ${toEnrich.length} de ellos se les añadirá la URL oficial)`);
console.log(`Faltan: ${missing.length}${Number.isFinite(limit) ? ` · en esta pasada: ${selected.length}` : ""}`);
if (unrecognized.length) console.log(`Sin número reconocible (${unrecognized.length}), p. ej.: ${[...new Set(unrecognized)].slice(0, 6).join(" | ")}`);
console.log("Faltan por mes:", [...byMonth].sort().map(([month, n]) => `${month}: ${n}`).join(" · ") || "—");

// Régimen según la norma que cita el propio documento (primeras páginas, sin OCR). Lo decisivo es
// la fecha de convocatoria del procedimiento (Ley 32069, DCT Cuarta), que el texto del
// pronunciamiento refleja al citar la ley y el reglamento que aplica.
type Regime = "32069" | "30225" | "mixto" | "sin-indicio";
const classifyCache: Record<string, { regimen: Regime; n32069: number; n30225: number }> = cachePath && existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};
async function classify(item: Item, bytes: Buffer): Promise<Regime> {
  const cached = classifyCache[item.key];
  if (cached) return cached.regimen;
  const text = (await pdfParse(bytes, { max: 4 })).text;
  const n32069 = (text.match(/\b32069\b|Ley General de Contrataciones P[uú]blicas|009\s*-?\s*2025\s*-?\s*EF/gi) ?? []).length;
  const n30225 = (text.match(/\b30225\b|Ley de Contrataciones del Estado|082\s*-?\s*2019\s*-?\s*EF|344\s*-?\s*2018\s*-?\s*EF/gi) ?? []).length;
  const regimen: Regime = n32069 && !n30225 ? "32069" : n30225 && !n32069 ? "30225" : n32069 && n30225 ? "mixto" : "sin-indicio";
  classifyCache[item.key] = { regimen, n32069, n30225 };
  if (cachePath) writeFileSync(cachePath, JSON.stringify(classifyCache));
  return regimen;
}
if (!apply && classifyOnly) {
  const sample = missing.slice(0, Math.min(sampleSize, missing.length));
  const counts = new Map<Regime, number>();
  let done = 0;
  let cursor = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (cursor < sample.length) {
      const item = sample[cursor++];
      try {
        const regimen = await classify(item, await downloadOfficialPdf(item.pdfUrl));
        counts.set(regimen, (counts.get(regimen) ?? 0) + 1);
      } catch (error) { console.error(`  ${item.number}: ${error instanceof Error ? error.message : error}`); }
      done += 1;
      if (done % 50 === 0) console.log(`  clasificados ${done}/${sample.length}`);
      await sleep(250);
    }
  }));
  console.log(`Clasificación por régimen (${sample.length} documentos leídos, sin guardar nada):`, [...counts].map(([k, v]) => `${k}: ${v}`).join(" · "));
}

// 3. Peso estimado: HEAD a una muestra repartida de lo que falta.
async function estimateSize() {
  const sample = missing.filter((_, index) => index % Math.max(1, Math.floor(missing.length / 20)) === 0).slice(0, 20);
  const sizes: number[] = [];
  for (const item of sample) {
    try {
      const head = await fetch(item.pdfUrl, { method: "HEAD", signal: AbortSignal.timeout(20000) });
      const bytes = Number(head.headers.get("content-length"));
      if (bytes > 0) sizes.push(bytes);
    } catch { /* una muestra fallida no cambia la estimación */ }
    await sleep(300);
  }
  if (sizes.length === 0) return null;
  const mean = sizes.reduce((s, b) => s + b, 0) / sizes.length;
  return { mean, max: Math.max(...sizes), n: sizes.length };
}
if (!apply) {
  const size = missing.length ? await estimateSize() : null;
  if (size) {
    const gb = (size.mean * missing.length) / 1073741824;
    console.log(`Peso medio (muestra de ${size.n}): ${(size.mean / 1048576).toFixed(2)} MB, máx. ${(size.max / 1048576).toFixed(1)} MB → total estimado ${gb.toFixed(1)} GB`);
    console.log(`Fragmentos estimados: ~${(missing.length * 23).toLocaleString("es-PE")} (a ~23 por documento, lo medido en las resoluciones ya importadas)`);
  }
  console.log("Primeras:", selected.slice(0, 4).map((item) => `${item.number} (${item.date})`).join(", ") || "—");
  console.log("Simulación terminada. Repite con --aplicar para escribir.");
  process.exit(0);
}

// 4. Aplicar.
const batch = `gobpe-oece-${new Date().toISOString().slice(0, 10)}`;
let imported = 0;
let failed = 0;
let enriched = 0;
let skippedByRegime = 0;
let next = 0;

for (const item of toEnrich) {
  const row = haveKey.get(item.key)!;
  await supabaseRest(`documents?id=eq.${row.id}`, {
    body: JSON.stringify({ metadata: { ...row.metadata, officialPublicationUrl: item.publicationUrl, publicationDate: item.date, sourceUrl: item.pdfUrl } }),
    method: "PATCH",
  }).then(() => { enriched += 1; }).catch((error) => console.error(`enriquecer ${item.number}: ${error instanceof Error ? error.message : error}`));
}
if (toEnrich.length) console.log(`Procedencia oficial añadida a ${enriched} documentos que ya estaban.`);

async function importOne(item: Item, label: string) {
  let bytes: Buffer | undefined;
  for (let attempt = 1; !bytes; attempt += 1) {
    try { bytes = await downloadOfficialPdf(item.pdfUrl); } catch (error) { if (attempt >= 3) throw error; await sleep(1500 * attempt); }
  }
  if (regimeFilter) {
    const regimen = await classify(item, bytes);
    if (regimen !== regimeFilter) { console.log(`${label} · omitida: régimen según el texto = ${regimen}`); skippedByRegime += 1; return; }
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (haveHash.has(sha256)) { console.log(`${label} · omitida: mismo archivo que otro ya importado`); return; }
  haveHash.add(sha256);
  const fileName = `${item.number.replace(/[^A-Z0-9.-]/g, "-")}.pdf`;
  const file = new File([new Uint8Array(bytes)], fileName, { type: "application/pdf" });
  const storagePath = `official/${batch}/${randomUUID()}.pdf`;
  await uploadPdfToStorage(storagePath, file);
  // Un Texto Único Ordenado es el texto consolidado de una ley: se guarda con su rango.
  const documentType = /Texto [ÚU]nico Ordenado/i.test(item.summary) ? "ley" : kind.documentType;
  const [document] = await supabaseRest<DocumentRecord[]>("documents", {
    body: JSON.stringify({
      document_type: documentType,
      es_institucional: true,
      file_name: fileName,
      file_size: bytes.length,
      metadata: {
        documentNumber: item.number,
        importBatch: batch,
        legalReviewStatus: "pendiente",
        number: item.number,
        officialPublicationUrl: item.publicationUrl,
        publicationDate: item.date,
        regime: "no_determinado",
        regimenSegunTexto: regimeOf(item),
        selectionNote: "Documento de la página oficial del OECE (gob.pe); el régimen y su aplicación quedan pendientes de revisión.",
        sha256,
        sourceUrl: item.pdfUrl,
        sumillaOficial: item.summary,
        uploadSource: "official-import",
        year: Number(item.key.split("-")[1] ?? item.date.slice(0, 4)),
      },
      mime_type: "application/pdf",
      oficina_id: null,
      process_type: null,
      source_entity: "OECE",
      status: "uploaded",
      storage_bucket: "documents",
      storage_path: storagePath,
      title: kind.label(item.number),
    }),
    method: "POST",
  });
  await processPdfForSearch(document, file);
  console.log(`${label} · importada e indexada`);
}

await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (next < selected.length) {
      const index = next++;
      const item = selected[index];
      const label = `[${index + 1}/${selected.length}] ${item.number}`;
      try {
        await importOne(item, label);
        imported += 1;
      } catch (error) {
        failed += 1;
        console.error(`${label} · ERROR: ${error instanceof Error ? error.message : String(error)}`);
      }
      await sleep(250);
    }
  }),
);
console.log(`\nTerminado: ${imported} importadas, ${failed} con error${regimeFilter ? `, ${skippedByRegime} omitidas por régimen` : ""}.`);
process.exit(failed > 0 ? 1 : 0);
