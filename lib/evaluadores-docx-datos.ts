// Reúne los datos de los tres documentos de designación de evaluadores (A6) y
// genera el .docx pedido.
//
// Vive aparte porque lo usan DOS endpoints: el que descarga y el de la vista
// previa. Si cada uno reuniera los datos por su cuenta, la previa podría enseñar
// una cosa y el documento otra —y la previa existe justo para comprobar qué se
// va a firmar—. Los dos llaman aquí y obtienen el MISMO buffer.

import { todosLosIntegrantes } from "./designacion-evaluadores";
import { labelProcedimiento } from "./estrategia-formato";
import { OPCIONES_TIPO_EVALUADOR } from "./actuaciones-preparatorias";
import {
  buildEvaluadorDoc,
  type EvaluadorDocKind,
  type IntegranteDoc,
} from "./evaluadores-docx";
import type { HitosMap } from "./procurement-fases";
import { supabaseRest, supabaseUserRest } from "./supabase-server";

type ProcesoRow = { id: string; nomenclature: string; entity: string | null; hitos: HitosMap | null };

function str(data: Record<string, unknown> | undefined, key: string): string {
  const v = data?.[key];
  return typeof v === "string" ? v.trim() : "";
}

/** Mensaje de "guarda el paso antes de exportar" por documento. */
export const GUARDA_A6: Record<EvaluadorDocKind, string> = {
  memo: "Guarda el paso A6 (Designación de evaluadores) antes de exportar.",
  jurada: "Guarda el paso A6 con los integrantes antes de exportar.",
  consentimiento: "Guarda el paso A6 con los integrantes antes de exportar.",
};

/** Un miembro del panel, para el selector "por miembro" de la vista previa. */
export type MiembroDoc = { index: number; nombre: string };

export type ResultadoEvaluadorDoc =
  | { buffer: Buffer; nomenclatura: string; miembros: MiembroDoc[] }
  | { error: string; status: number };

/**
 * Genera el documento de A6 (`memo` | `jurada` | `consentimiento`) para un
 * expediente, o el motivo por el que no se puede.
 *
 * `usuario` aporta el token para leer el expediente (RLS) y la entidad de
 * respaldo cuando el expediente no la trae.
 */
export async function generarEvaluadorDoc(
  usuario: { accessToken: string; entity: string | null },
  id: string,
  kind: EvaluadorDocKind,
  // Índice del miembro del panel para el que se genera el documento. Sin él (o
  // fuera de rango), se generan TODOS —una página por miembro (el grupo)—; la
  // jurada y el consentimiento se firman uno por integrante.
  miembroIndex?: number,
  /** Nombre completo del usuario en sesión que genera el documento. */
  elaboradoPor?: string | null,
): Promise<ResultadoEvaluadorDoc> {
  const rows = await supabaseUserRest<ProcesoRow[]>(
    usuario.accessToken,
    `procurement_processes?id=eq.${id}&select=id,nomenclature,entity,hitos`,
  );
  const proceso = rows[0];
  if (!proceso) return { error: "Expediente no encontrado", status: 404 };

  const hitos = proceso.hitos ?? {};
  const a4 = hitos.A4?.data ?? {};
  const a6 = hitos.A6?.data ?? {};
  if (!hitos.A6) return { error: GUARDA_A6[kind], status: 409 };

  const tipoEvaluador = str(a6, "tipo_evaluador") || str(a4, "var_e_tipo_evaluador");
  const tipoLabel = OPCIONES_TIPO_EVALUADOR.find((o) => o.value === tipoEvaluador)?.label ?? "Evaluador";
  const procedimiento = str(a4, "var_a_procedimiento");

  const todos: IntegranteDoc[] = todosLosIntegrantes(a6).map((i) => ({
    nombre: (i.nombre ?? "").trim() || (i.correo ?? "").trim(),
    dni: (i.dni ?? "").trim(),
    grado: (i.grado ?? "").trim(),
    cargo: (i.cargo ?? "").trim(),
    rol: (i.rol ?? "").trim(),
    condicion: i.condicion === "suplente" ? "suplente" : "titular",
  }));
  const miembros: MiembroDoc[] = todos.map((m, index) => ({
    index,
    nombre: (m.nombre ?? "").trim() || "(sin nombre)",
  }));
  // Un miembro concreto (índice válido) o todos (el grupo).
  const integrantes =
    typeof miembroIndex === "number" && miembroIndex >= 0 && miembroIndex < todos.length
      ? [todos[miembroIndex]]
      : todos;

  // Ciudad de la fecha y quien emite el memorándum. Service-role: lo genera quien
  // instruye el expediente, no un admin, y estas tablas están cerradas por RLS.
  const [inst, jefe] = await Promise.all([
    supabaseRest<{ city: string | null }[]>("entity_settings?id=eq.default&select=city&limit=1").catch(
      () => [],
    ),
    // "DE:" del memorándum: el jefe de la DEC (Art. 58.1: la designación del
    // oficial de compra la hace la DEC). Se prefiere el marcado como jefe.
    supabaseRest<{ nombre_completo: string | null; grado_academico: string | null }[]>(
      "profiles?role=eq.dec&select=nombre_completo,grado_academico&order=es_jefe.desc&limit=1",
    ).catch(() => []),
  ]);

  const buffer = await buildEvaluadorDoc(kind, {
    entidad: proceso.entity ?? usuario.entity ?? "Entidad contratante",
    lugar: inst[0]?.city ?? "",
    fecha: str(a6, "fecha_designacion"),
    tipoEvaluadorLabel: tipoLabel,
    tipoEvaluador,
    procedimientoLabel: labelProcedimiento(procedimiento) ?? "Procedimiento de selección",
    nomenclatura: str(a4, "var_a_nomenclatura"),
    integrantes,
    memoNumero: str(a6, "documento_designacion"),
    emisor: {
      grado: (jefe[0]?.grado_academico ?? "").trim(),
      nombre: (jefe[0]?.nombre_completo ?? "").trim(),
    },
    elaboradoPor,
  });

  return { buffer, nomenclatura: proceso.nomenclature, miembros };
}
