// Reúne los datos del Informe de Segmentación (A2) y genera el .docx pedido.
//
// Vive aparte porque lo usan DOS endpoints: el que descarga y el de la vista
// previa. Si cada uno reuniera los datos por su cuenta, la previa podría
// enseñar una cosa y el documento otra —y la previa existe justo para
// comprobar qué se va a exportar—. Los dos llaman aquí y obtienen el MISMO
// buffer. Mismo patrón que `evaluadores-docx-datos.ts` para A6.

import {
  documentoModificacionCmnTexto,
  esProgramada,
  valorEstimadoDeA1,
  type SegmentacionInput,
} from "./actuaciones-preparatorias";
import { buildSegmentacionInformeDocx } from "./segmentacion-informe";
import { objectTypeLabel } from "./legal-taxonomy";
import type { HitosMap } from "./procurement-fases";
import { supabaseRest, supabaseUserRest } from "./supabase-server";

type ProcesoRow = {
  id: string;
  nomenclature: string;
  object_type: string;
  valor_estimado: number | null;
  amount: number | null;
  entity: string | null;
  necesidad_id: string | null;
  hitos: HitosMap | null;
};

type NecesidadRow = {
  nombre: string | null;
  codigo: string | null;
  entidad: string | null;
  area_usuaria: string | null;
  descripcion_detallada: string | null;
  monto_estimado: number | null;
  plazo_ejecucion: number | null;
  summary: string | null;
};

type EntitySettingsRow = {
  city: string | null;
  pac_anio: number | null;
  pac_monto_bienes_servicios: number | string | null;
  pac_monto_obras: number | string | null;
  pac_monto_total: number | string | null;
  pac_resolucion_fecha: string | null;
  pac_resolucion_numero: string | null;
  pia_resolucion_fecha: string | null;
  pia_resolucion_numero: string | null;
};

function str(data: Record<string, unknown> | undefined, key: string): string | null {
  const v = data?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

const SELECT_NECESIDAD =
  "nombre,codigo,entidad,area_usuaria,descripcion_detallada,monto_estimado,plazo_ejecucion,summary";

/**
 * Busca la necesidad del expediente por cualquiera de los dos extremos del
 * vínculo: `procurement_processes.necesidad_id` o `necesidades.process_id`.
 *
 * Existen filas con el vínculo cojo —solo un lado apunta al otro—, y mirar un
 * único extremo dejaba el informe sin la denominación. Se prueba primero el
 * puntero del expediente, que es el que usa el resto de la Fase 1.
 */
async function buscarNecesidad(
  token: string,
  procesoId: string,
  necesidadId: string | null,
): Promise<NecesidadRow | null> {
  if (necesidadId) {
    const porId = await supabaseUserRest<NecesidadRow[]>(
      token,
      `necesidades?id=eq.${necesidadId}&select=${SELECT_NECESIDAD}`,
    ).catch(() => []);
    if (porId[0]) return porId[0];
  }
  const porProceso = await supabaseUserRest<NecesidadRow[]>(
    token,
    `necesidades?process_id=eq.${procesoId}&select=${SELECT_NECESIDAD}&limit=1`,
  ).catch(() => []);
  return porProceso[0] ?? null;
}

// PostgREST devuelve numeric como string.
function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * PIA y PAC del ejercicio (Configuración → Municipalidad).
 * Se lee con service-role a propósito: entity_settings solo es visible para
 * admins por RLS, pero el informe lo genera cualquier usuario con acceso al
 * expediente (p. ej. logística). Son datos institucionales que de todos modos
 * se imprimen en el documento. Si el SQL de estas columnas aún no se ejecutó,
 * devuelve null y el informe se genera sin los antecedentes de PIA/PAC.
 */
async function getInstitucional(): Promise<EntitySettingsRow | null> {
  const columnas =
    "city,pia_resolucion_numero,pia_resolucion_fecha,pac_resolucion_numero,pac_resolucion_fecha,pac_anio,pac_monto_total,pac_monto_bienes_servicios,pac_monto_obras";
  const rows = await supabaseRest<EntitySettingsRow[]>(
    `entity_settings?id=eq.default&select=${columnas}&limit=1`,
  ).catch(() =>
    // Sin las columnas del PAC (SQL pendiente) aún se puede citar la ciudad.
    supabaseRest<EntitySettingsRow[]>(
      "entity_settings?id=eq.default&select=city&limit=1",
    ).catch(() => []),
  );
  return rows[0] ?? null;
}

export type ResultadoSegmentacionInforme =
  | { buffer: Buffer; nomenclatura: string }
  | { error: string; status: number };

/**
 * Genera el Informe de Segmentación (A2) para un expediente, o el motivo por
 * el que no se puede.
 *
 * `usuario` aporta el token para leer el expediente (RLS), la entidad de
 * respaldo cuando el expediente no la trae, y los datos de quien lo elabora.
 */
export async function generarSegmentacionInformeDoc(
  usuario: {
    accessToken: string;
    entity: string | null;
    nombreCompleto?: string | null;
    cargo?: string | null;
    email?: string | null;
  },
  id: string,
): Promise<ResultadoSegmentacionInforme> {
  const rows = await supabaseUserRest<ProcesoRow[]>(
    usuario.accessToken,
    `procurement_processes?id=eq.${id}&select=id,nomenclature,object_type,valor_estimado,amount,entity,necesidad_id,hitos`,
  );
  const proceso = rows[0];
  if (!proceso) {
    return { error: "Expediente no encontrado", status: 404 };
  }

  const hitos = proceso.hitos ?? {};
  const a1 = hitos.A1?.data ?? {};
  const a2 = hitos.A2?.data ?? {};
  const a3 = hitos.A3?.data ?? {};

  // El paso A2 debe haberse guardado. El objeto por defecto es
  // "bienes_servicios" (igual que el formulario), así que no exigimos que la
  // clave `objeto` esté presente para poder generar el informe.
  if (!hitos.A2) {
    return { error: "Guarda el paso A2 (Segmentación) antes de generar el informe.", status: 409 };
  }

  const institucionalRow = await getInstitucional();

  // La necesidad se busca por LOS DOS extremos del vínculo.
  //
  // El expediente puede haber perdido su `necesidad_id` (filas anteriores a
  // la migración del flujo, o un reabrir que se quedó a medias) mientras la
  // necesidad sigue apuntándolo con `process_id`. Mirando solo un lado, el
  // informe se quedaba sin denominación y caía a la nomenclatura, que imprime
  // el código interno ("REQ-2026-0004 — …") en la Descripción del ítem.
  const necesidad = await buscarNecesidad(usuario.accessToken, id, proceso.necesidad_id);

  const seg: SegmentacionInput = {
    objeto: a2.objeto === "obras_consultoria_obras" ? "obras_consultoria_obras" : "bienes_servicios",
    cuantiaAlta: Boolean(a2.cuantiaAlta),
    condicionesRiesgo: Array.isArray(a2.condicionesRiesgo) ? (a2.condicionesRiesgo as string[]) : [],
    criteriosBasica: Array.isArray(a2.criteriosBasica) ? (a2.criteriosBasica as string[]) : [],
    centralizada: Boolean(a2.centralizada),
  };

  // La DENOMINACIÓN de la contratación, no su alcance.
  //
  // El informe usa esto en el ASUNTO del memorando, en la columna
  // "Descripción del ítem" de la matriz y en la conclusión 3.1: los tres
  // piden un nombre, no un texto técnico. `necesidad.nombre` es la
  // denominación; `A3.descripcion` es el alcance y las condiciones de
  // ejecución (Art. 44.2.a), que puede ocupar párrafos.
  //
  // El orden estaba invertido y ganaba A3.descripcion, así que el ASUNTO
  // salía con lo que hubiera ahí ("SERVIDOR") por muy bien compuesto que
  // estuviera el nombre. Se lee de la necesidad en vivo: mientras está
  // derivada, la ficha está congelada y no puede desfasarse.
  const objeto =
    (necesidad?.nombre?.trim() ? necesidad.nombre.trim() : null) ??
    // Expedientes sin necesidad vinculada: la nomenclatura ya es "código — nombre".
    (proceso.nomenclature?.trim() ? proceso.nomenclature.trim() : null) ??
    str(a3, "descripcion") ??
    necesidad?.descripcion_detallada ??
    "la contratación";

  const programada = esProgramada(a1);

  // Valor estimado de la fila "+ Esta contratación" (base de la cuantía). En
  // una NO programada lo declara A1 (campo obligatorio); si no lo trae, se cae
  // al del expediente/necesidad. Misma preferencia que la pantalla
  // (segParametros en fase-panel), con el helper compartido.
  const valorA1 = valorEstimadoDeA1(a1);

  const buffer = await buildSegmentacionInformeDocx({
    entidad: proceso.entity ?? necesidad?.entidad ?? usuario.entity ?? "Entidad contratante",
    elaboradoPor: [usuario.nombreCompleto, usuario.cargo].filter(Boolean).join(" — ") || usuario.email || "",
    areaUsuaria: necesidad?.area_usuaria ?? null,
    objeto,
    tipoObjetoLabel: objectTypeLabel(proceso.object_type),
    valorEstimado: valorA1 ?? proceso.valor_estimado ?? proceso.amount ?? necesidad?.monto_estimado ?? null,
    plazoDias: necesidad?.plazo_ejecucion ?? null,
    programada,
    referenciaPac: str(a1, "referencia_pac"),
    // Precondición del Art. 42.3 verificada en A1.
    enCmn: a1.en_cmn === true,
    versionCmn: str(a1, "version_cmn"),
    // Documento con que el área usuaria solicita la modificación del CMN
    // (A1). Constancia de la precondición del 42.3 en las no programadas.
    // A1 guarda solo el número; el helper lo deja como "documento N.° 45"
    // (y respeta la referencia completa de expedientes antiguos). `str()` no
    // sirve aquí: ignoraría el número y lo dejaría caer del informe.
    documentoModificacionCmn: documentoModificacionCmnTexto(a1) || null,
    // Documento con el que el área usuaria remitió el requerimiento (Art. 44.2).
    //
    // Manda el Resumen de la necesidad: ahí consta el documento REAL de
    // origen ("pedido de compra SIGA N° 001838-1"), que es lo que cita un
    // antecedente. El código REQ-2026-0004 es el identificador interno de
    // ACE, no un documento de la entidad.
    //
    // Se le quita el punto final: va incrustado a mitad de frase
    // ("Que, mediante {esto} de {área usuaria}, se solicita…").
    documentoRequerimiento:
      necesidad?.summary?.trim()
        ? necesidad.summary.trim().replace(/\.+$/, "")
        : necesidad?.codigo
          ? `el requerimiento ${necesidad.codigo}`
          : null,
    seg,
    // Sumandos de la base del 10% capturados en A2 (Guía).
    noProgramadasConvocadas: Number(a2.montoNoProgramadasConvocadas) || null,
    otrasNoProgramadasASegmentar: Number(a2.montoOtrasNoProgramadas) || null,
    // Si A1 declaró el valor estimado (no programada), la entidad lo registra
    // dentro de "otras no programadas": no se imprime "Nueva Contratación"
    // aparte, para que cuente una sola vez. Coincide con la pantalla.
    contratacionEnOtras: valorA1 != null,
    // "Lugar" de la fecha del memorando (Configuración → Municipalidad).
    lugar: institucionalRow?.city ?? null,
    // Texto del informe capturado en A2.
    narrativa: {
      atencion: str(a2, "atencion"),
      continuidad: str(a2, "continuidad"),
      destinatario: str(a2, "destinatario"),
      estrategiaMitigacion: str(a2, "estrategiaMitigacion"),
      justificacion: str(a2, "justificacion"),
      puntoControl: str(a2, "puntoControl"),
      remitente: str(a2, "remitente"),
      riesgoMercado: str(a2, "riesgoMercado"),
    },
    institucional: institucionalRow
      ? {
          pacAnio: institucionalRow.pac_anio ?? null,
          pacMontoBienesServicios: num(institucionalRow.pac_monto_bienes_servicios),
          pacMontoObras: num(institucionalRow.pac_monto_obras),
          pacMontoTotal: num(institucionalRow.pac_monto_total),
          pacResolucionFecha: institucionalRow.pac_resolucion_fecha ?? null,
          pacResolucionNumero: institucionalRow.pac_resolucion_numero ?? null,
          piaResolucionFecha: institucionalRow.pia_resolucion_fecha ?? null,
          piaResolucionNumero: institucionalRow.pia_resolucion_numero ?? null,
        }
      : null,
    // Cronograma de presentación de requerimientos capturado en A2.
    cronograma: Array.isArray(a2.cronogramaItems)
      ? (a2.cronogramaItems as Array<{ area?: string; fecha?: string }>).map((c) => ({
          area: String(c?.area ?? ""),
          fecha: String(c?.fecha ?? ""),
        }))
      : [],
  });

  return { buffer, nomenclatura: proceso.nomenclature || "expediente" };
}
