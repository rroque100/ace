import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-server";
import { TOPES_2026, type TopesProcedimiento } from "@/lib/topes-procedimiento";
import { parseDiasPorProcedimiento, type DiasCronogramaPorProcedimiento } from "@/lib/cronograma-dias";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = {
  pac_anio: number | null;
  pac_monto_bienes_servicios: number | string | null;
  uit_anio: number | null;
  uit_valor: number | string | null;
  lp_abreviada_bienes_min: number | string | null;
  lp_abreviada_bienes_max: number | string | null;
  lp_abreviada_bienes_anio: number | null;
  tope_anio: number | null;
  tope_piso: number | string | null;
  tope_licitacion_concurso: number | string | null;
  tope_licitacion_obras: number | string | null;
  tope_comparacion_precios: number | string | null;
  cronograma_dias: unknown;
};

/** Número o `null`; nunca `NaN` ni un 0 que se confunda con "sin registrar". */
function aNumero(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

// GET /api/configuracion/parametros-segmentacion
// Expone los parámetros institucionales que el resto de la aplicación necesita
// para razonar sobre cuantías:
//
//   * PAC de bienes y servicios → línea de corte de A2 (10%, Art. 125).
//   * UIT del ejercicio → tope del contrato menor (Ley 32069, Art. 34.1), del
//     que depende si un requerimiento puede ir por ítems (Art. 52.1.b).
//   * Topes de procedimiento por cuantía → qué procedimiento corresponde según
//     la cuantía (tabla DSEACE-OECE, Arts. 93-95). Se devuelven ya resueltos con
//     el defecto 2026, listos para `procedimientosElegibles`.
//
// Se lee con service-role a propósito: entity_settings solo es visible para
// admins por RLS, pero quien segmenta / instruye el expediente es la DEC. Solo
// se devuelven cifras que ya son públicas (el PAC se publica en el SEACE; los
// topes son la tabla pública de la OECE), no el resto de la configuración.
const SELECT_BASE = "pac_anio,pac_monto_bienes_servicios,uit_anio,uit_valor";
const SELECT_LP = "lp_abreviada_bienes_min,lp_abreviada_bienes_max,lp_abreviada_bienes_anio";
const SELECT_TOPES = "tope_anio,tope_piso,tope_licitacion_concurso,tope_licitacion_obras,tope_comparacion_precios";
const SELECT_CRONOGRAMA = "cronograma_dias";

function leer(select: string) {
  return supabaseRest<Row[]>(`entity_settings?id=eq.default&select=${select}&limit=1`);
}

/** Topes configurados, cayendo al defecto 2026 en cada importe ausente. */
function topesDeFila(row: Row | undefined): TopesProcedimiento {
  return {
    anio: aNumero(row?.tope_anio) ?? TOPES_2026.anio,
    piso: aNumero(row?.tope_piso) ?? TOPES_2026.piso,
    licitacionConcurso: aNumero(row?.tope_licitacion_concurso) ?? TOPES_2026.licitacionConcurso,
    licitacionObras: aNumero(row?.tope_licitacion_obras) ?? TOPES_2026.licitacionObras,
    comparacionPrecios: aNumero(row?.tope_comparacion_precios) ?? TOPES_2026.comparacionPrecios,
  };
}

/** Días estimados por procedimiento, saneados (cada procedimiento con defectos si falta). */
function diasDeFila(row: Row | undefined): DiasCronogramaPorProcedimiento {
  return parseDiasPorProcedimiento(row?.cronograma_dias);
}

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  // Fallback progresivo: si el SQL de los topes o de la LP abreviada aún no se
  // corrió, se leen los parámetros de siempre en vez de fallar entero. Lo no
  // leído queda con el defecto (topes) o en `null` (LP), sin dejar sin UIT/PAC a
  // la segmentación.
  let rows: Row[];
  try {
    rows = await leer(`${SELECT_BASE},${SELECT_LP},${SELECT_TOPES},${SELECT_CRONOGRAMA}`);
  } catch {
    rows = await leer(`${SELECT_BASE},${SELECT_LP},${SELECT_TOPES}`).catch(() =>
      leer(`${SELECT_BASE},${SELECT_LP}`).catch(() =>
        leer(SELECT_BASE).catch((err) => {
          console.error("[parametros-segmentacion] no se pudieron leer:", err);
          return [] as Row[];
        }),
      ),
    );
  }

  const row = rows[0];

  return NextResponse.json({
    pacAnio: row?.pac_anio ?? null,
    pacMontoBienesServicios: aNumero(row?.pac_monto_bienes_servicios),
    // `null` cuando no está registrada, para que quien consuma pueda decir "no
    // se sabe" en vez de dar por incumplido el umbral del contrato menor.
    uitAnio: row?.uit_anio ?? null,
    uitValor: aNumero(row?.uit_valor),
    // Rango de la LP abreviada para bienes (Configuración anual). `null` si no
    // está registrado: quien consume decide "no se sabe" en vez de filtrar mal.
    lpAbreviadaBienesMin: aNumero(row?.lp_abreviada_bienes_min),
    lpAbreviadaBienesMax: aNumero(row?.lp_abreviada_bienes_max),
    lpAbreviadaBienesAnio: row?.lp_abreviada_bienes_anio ?? null,
    // Topes de procedimiento por cuantía, ya resueltos (defecto 2026). Listos
    // para pasarlos a `procedimientosElegibles(objeto, cuantía, ficha, topes)`.
    topes: topesDeFila(row),
    // Días estimados del cronograma (o) POR PROCEDIMIENTO, ya saneados (cada
    // procedimiento con defectos si falta). Los consume A4 según el procedimiento de
    // a); los mínimos legales siguen en código como piso duro.
    diasCronogramaPorProcedimiento: diasDeFila(row),
  });
}
