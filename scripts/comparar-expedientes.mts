/**
 * Compara dos expedientes para diagnosticar por qué muestran funcionalidad
 * distinta en /expedientes/[id]. Uso:
 *   npx tsx --env-file=.env.local scripts/comparar-expedientes.mts
 */
import { supabaseRest } from "@/lib/supabase-server";

const ID_A = "3c745891-0aba-488b-907e-a25ead2c1c02";
const ID_B = "3c64df43-a515-4d85-ae75-4aea5d04df20";

type Row = Record<string, unknown> & { id: string; hitos?: Record<string, unknown> | null };

const rows = await supabaseRest<Row[]>(
  `procurement_processes?id=in.(${ID_A},${ID_B})&select=*`,
);

const a = rows.find((r) => r.id === ID_A);
const b = rows.find((r) => r.id === ID_B);

if (!a || !b) {
  console.log("No encontré uno de los dos. IDs devueltos:", rows.map((r) => r.id));
  console.log("Filas:", rows.length);
  process.exit(0);
}

const short = (v: unknown) => {
  const s = typeof v === "string" ? v : JSON.stringify(v ?? null);
  return s && s.length > 80 ? s.slice(0, 77) + "…" : s;
};

const campos = [
  "nomenclature",
  "status",
  "procedure_type",
  "object_type",
  "amount",
  "valor_estimado",
  "entity",
  "necesidad_id",
  "year",
  "sistema_contratacion",
  "modalidad_ejecucion",
  "object_type",
  "summary",
  "resumen_ejecutivo",
  "certificacion_presupuestal",
  "created_at",
  "updated_at",
];

console.log("\n══ CAMPOS PRINCIPALES (≠ marca diferencia) ══");
for (const c of campos) {
  const va = JSON.stringify(a[c] ?? null);
  const vb = JSON.stringify(b[c] ?? null);
  const diff = va !== vb ? "≠" : "=";
  console.log(`  ${diff} ${c.padEnd(26)} A=${short(va).padEnd(34)} B=${short(vb)}`);
}

function resumenHitos(h: unknown): string {
  if (!h || typeof h !== "object") return "(sin hitos)";
  const obj = h as Record<string, { status?: string; data?: Record<string, unknown> }>;
  return Object.keys(obj)
    .sort()
    .map((k) => {
      const v = obj[k] ?? {};
      const status = v.status ?? "?";
      const n = v.data ? Object.keys(v.data).length : 0;
      return `${k}:${status}${n ? `(${n})` : ""}`;
    })
    .join("  ");
}

console.log("\n══ HITOS (paso:status(nºCampos con data)) ══");
console.log("  A:", resumenHitos(a.hitos));
console.log("  B:", resumenHitos(b.hitos));

// Diferencias campo a campo dentro de cada hito compartido, para ver si lo que
// el usuario ve distinto viene de datos guardados distintos (no de código).
const ha = (a.hitos ?? {}) as Record<string, { data?: Record<string, unknown> }>;
const hb = (b.hitos ?? {}) as Record<string, { data?: Record<string, unknown> }>;
const pasos = new Set([...Object.keys(ha), ...Object.keys(hb)]);
console.log("\n══ DIFERENCIA DE DATOS POR PASO (solo si ambos existen) ══");
for (const paso of [...pasos].sort()) {
  const da = ha[paso]?.data ?? {};
  const db = hb[paso]?.data ?? {};
  const keys = new Set([...Object.keys(da), ...Object.keys(db)]);
  const diffs: string[] = [];
  for (const k of keys) {
    const va = JSON.stringify(da[k] ?? null);
    const vb = JSON.stringify(db[k] ?? null);
    if (va !== vb) diffs.push(`    ${k}: A=${short(va)} | B=${short(vb)}`);
  }
  if (diffs.length) {
    console.log(`  ▸ ${paso}`);
    diffs.forEach((d) => console.log(d));
  }
}
