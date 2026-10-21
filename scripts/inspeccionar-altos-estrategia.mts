/**
 * Vuelca el contenido y el ALTO de cada fila del Formato de Estrategia (A4)
 * generado para un expediente real, sin abrir Excel. Sirve para saber qué hay
 * exactamente en cada número de fila del .xlsx exportado (los índices se desplazan
 * por las inserciones de f/g/o/p, así que "la fila 156" depende de los datos).
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/inspeccionar-altos-estrategia.mts <processId> [desde] [hasta]
 */
import ExcelJS from "exceljs";
import { generarExcelF1, type NecesidadExport } from "@/lib/fase1-export";
import type { HitosMap } from "@/lib/procurement-fases";
import { supabaseRest } from "@/lib/supabase-server";

const id = process.argv[2];
const desde = Number(process.argv[3] ?? 130);
const hasta = Number(process.argv[4] ?? 180);
if (!id) {
  console.error("Falta el processId. Ej: scripts/inspeccionar-altos-estrategia.mts 3c64df43-...");
  process.exit(1);
}

const [proc] = await supabaseRest<
  {
    nomenclature: string;
    object_type: string;
    procedure_type: string | null;
    amount: number | null;
    valor_estimado: number | null;
    entity: string | null;
    necesidad_id: string | null;
    hitos: HitosMap | null;
  }[]
>(
  `procurement_processes?id=eq.${id}&select=nomenclature,object_type,procedure_type,amount,valor_estimado,entity,necesidad_id,hitos`,
);
if (!proc) {
  console.error("Expediente no encontrado:", id);
  process.exit(1);
}

let necesidad: NecesidadExport | null = null;
if (proc.necesidad_id) {
  const [n] = await supabaseRest<NecesidadExport[]>(
    `necesidades?id=eq.${proc.necesidad_id}&select=nombre,area_usuaria,monto_estimado,tipo_objeto`,
  ).catch(() => []);
  necesidad = n ?? null;
}

const { buffer } = await generarExcelF1("estrategia", {
  necesidad,
  proceso: {
    nomenclature: proc.nomenclature,
    object_type: proc.object_type,
    procedure_type: proc.procedure_type,
    amount: proc.amount,
    valor_estimado: proc.valor_estimado,
    entity: proc.entity,
  },
  hitos: proc.hitos ?? {},
});

const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buffer as unknown as ArrayBuffer);
const ws = wb.worksheets[0];

const textoDe = (cell: ExcelJS.Cell): string => {
  const v = cell.value as unknown;
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "richText" in (v as object)) {
    return ((v as { richText: { text?: string }[] }).richText ?? []).map((t) => t.text ?? "").join("");
  }
  return v == null ? "" : String(v);
};

const merges: string[] = (ws as unknown as { model?: { merges?: string[] } }).model?.merges ?? [];
const mergeDe = (r: number): string => {
  const hits = merges.filter((m) => {
    const mm = m.match(/[A-Z]+(\d+):[A-Z]+(\d+)/);
    return mm && r >= Number(mm[1]) && r <= Number(mm[2]);
  });
  return hits.join(" ");
};

let anchoBJ = 0;
const porCol: string[] = [];
for (let c = 2; c <= 10; c += 1) {
  const w = ws.getColumn(c).width ?? 8.43;
  anchoBJ += w;
  porCol.push(`${String.fromCharCode(64 + c)}=${w.toFixed(1)}`);
}
console.log(`anchoDe(B:J) = ${anchoBJ.toFixed(2)} [${porCol.join(" ")}] · chars/línea@16pt(×0.9) = ${(anchoBJ * 0.9 * (11 / 16)).toFixed(1)}\n`);

console.log(`Expediente ${proc.nomenclature} · procedimiento ${proc.procedure_type} · filas ${desde}-${hasta}\n`);
for (let r = desde; r <= hasta; r += 1) {
  const row = ws.getRow(r);
  let txt = "";
  let cuerpo = 11;
  for (let c = 1; c <= 12; c += 1) {
    const t = textoDe(ws.getCell(r, c)).replace(/\s+/g, " ").trim();
    if (t && !txt) { txt = t; cuerpo = (ws.getCell(r, c).font?.size ?? 11); }
  }
  const h = row.height;
  const oculta = row.hidden ? " [OCULTA]" : "";
  console.log(
    `fila ${String(r).padStart(3)} · alto ${h == null ? "—" : h.toFixed(2).padStart(7)}${oculta} · ${String(txt.length).padStart(4)}ch · ${cuerpo}pt · merges[${mergeDe(r)}]  ${txt.slice(0, 55)}`,
  );
}
