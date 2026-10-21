/**
 * Compara el campo "o) Cronograma estimado" (cronograma_items, A4) entre dos
 * expedientes y corre la misma revisión que la app (validarCronograma +
 * cronogramaCoincideConProcedimiento). Uso:
 *   npx tsx --env-file=.env.local scripts/comparar-cronograma.mts
 */
import { supabaseRest } from "@/lib/supabase-server";
import { validarCronograma, type ActividadCronograma } from "@/lib/cronograma-fechas";
import { cronogramaCoincideConProcedimiento } from "@/lib/estrategia-formato";

const ID_A = "3c745891-0aba-488b-907e-a25ead2c1c02";
const ID_B = "3c64df43-a515-4d85-ae75-4aea5d04df20";

type Hito = { status?: string; data?: Record<string, unknown> } | undefined;
type Row = { id: string; hitos?: Record<string, Hito> | null };

const rows = await supabaseRest<Row[]>(
  `procurement_processes?id=in.(${ID_A},${ID_B})&select=id,hitos`,
);
const a = rows.find((r) => r.id === ID_A)?.hitos?.A4?.data ?? {};
const b = rows.find((r) => r.id === ID_B)?.hitos?.A4?.data ?? {};

const describir = (titulo: string, d: Record<string, unknown>) => {
  console.log(`\n══ ${titulo} ══`);
  console.log("  a) Procedimiento específico (var_a_proceso):", short(d.var_a_proceso));
  console.log("  a) Procedimiento genérico  (var_a_procedimiento):", short(d.var_a_procedimiento));
  const filas = (d.cronograma_items as ActividadCronograma[] | undefined) ?? [];
  console.log(`  cronograma_items: ${filas.length} actividad(es)`);
  const porFase: Record<string, ActividadCronograma[]> = {};
  for (const f of filas) (porFase[f.fase ?? "?"] ??=[]).push(f);
  for (const fase of ["preparatorias", "seleccion", "ejecucion"]) {
    const lista = porFase[fase] ?? [];
    if (!lista.length) continue;
    console.log(`    · ${fase.toUpperCase()} (${lista.length}):`);
    for (const f of lista) {
      console.log(`        - ${(f.actividad ?? "?").padEnd(40)} ${f.inicio ?? "—"} → ${f.fin ?? "—"}`);
    }
  }
  if (!filas.length) {
    console.log("    (campo vacío — el paso o) es opcional)");
    return;
  }
  const procGenerico = String(d.var_a_procedimiento ?? "").trim();
  // feriados vacío: el conteo de hábiles es aproximado (sin feriados).
  const avisos = validarCronograma(filas, new Set(), procGenerico || undefined);
  const coincide = cronogramaCoincideConProcedimiento(filas, procGenerico);
  console.log("  REVISIÓN:");
  console.log("    coincide con procedimiento:", coincide === true ? "sí" : coincide === false ? "NO (son de otro procedimiento)" : "sin poder determinar");
  if (avisos.length) for (const x of avisos) console.log("    ⚠", x);
  else console.log("    ✓ sin avisos de plazos mínimos (Arts. 64.1/66.1/68.1)");
};

function short(v: unknown): string {
  const s = typeof v === "string" ? v : JSON.stringify(v ?? null);
  return s && s.length > 90 ? s.slice(0, 87) + "…" : s;
}

describir("A · 3c7458… (licitacion_publica_abreviada)", a);
describir("B · 3c64df… (subasta_inversa_electronica)", b);
