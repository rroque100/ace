"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calculator, Info, Plus, Trash2 } from "lucide-react";
import {
  CONDICIONES_RIESGO_BS,
  CRITERIOS_OBRA_BASICA,
  type ObjetoSegmentacion,
  clasificarSegmentacion,
} from "@/lib/actuaciones-preparatorias";
import { calcularParametrosSegmentacion, cuantiaSegmentacionSinDeterminar, soles } from "@/lib/segmentacion-parametros";
import type { TopesProcedimiento } from "@/lib/topes-procedimiento";
import type { DiasCronogramaPorProcedimiento } from "@/lib/cronograma-dias";
import { mismaPersona, nombreParaFirma, type Persona } from "@/lib/nombres";
import { OficinaCombobox, type OficinaOpcion } from "../oficina-combobox";

// ── Estilos migrados de styles.css (clases .seg*) ────────────────────────────
// Los <input>/<select>/<textarea> nativos llevan `!` en tamaño/radio: la regla
// global sin capa (`input,…{font:inherit}` + `{border-radius:10px}`) ganaría a
// las utilidades. Todo vive dentro del `.tw` de process-detail.
const SEG_FORM = "grid gap-3";
const SEG_FIELD =
  "grid gap-1 text-[12.5px] text-muted [&_select]:!rounded-[8px] [&_select]:border [&_select]:border-line [&_select]:px-[9px] [&_select]:py-[7px] [&_select]:!text-[13px] [&_select]:text-ink";
const SEG_FIELDSET =
  "m-0 grid gap-[7px] rounded-[9px] border border-line px-3 py-2.5 [&>legend]:px-1 [&>legend]:text-[12px] [&>legend]:font-semibold [&>legend]:text-ink";
const SEG_OPCION =
  "grid cursor-pointer grid-cols-[auto_1fr] items-start gap-2 text-[12.5px] leading-[1.4] text-ink [&_input]:mt-0.5";
const SEG_RESULT_BASE = "grid gap-2 rounded-[10px] border p-3";
const SEG_RESULT_TONO = {
  normal: "border-[color-mix(in_srgb,var(--brand)_30%,var(--line))] bg-brand-soft",
  avanzado: "border-[color-mix(in_srgb,var(--accent)_45%,var(--line))] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]",
};
const SEG_RESULT_HEAD =
  "flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.03em] text-brand-dark";
const SEG_RESULT_GRID = "grid grid-cols-2 gap-3";
const SEG_RESULT_LABEL = "block text-[11px] text-muted";
const SEG_RESULT_CATEGORIA = "text-[16px] text-brand-dark";
const SEG_RESULT_REQ = "m-0 flex items-center gap-[5px] text-[12px] text-muted";
const SEG_REFTABLE =
  "mt-2 text-[12px] text-muted [&_summary]:cursor-pointer [&_summary]:py-1 [&_summary]:font-medium " +
  "[&_table]:mt-1.5 [&_table]:w-full [&_table]:border-collapse " +
  "[&_th]:border [&_th]:border-line [&_th]:bg-canvas [&_th]:px-1.5 [&_th]:py-1 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-semibold " +
  "[&_td]:border [&_td]:border-line [&_td]:px-1.5 [&_td]:py-1 [&_td]:text-left [&_td]:text-[11px]";
const SEG_REF_ACTIVE = "bg-[#dbeafe] font-semibold text-[#1e40af]";
const SEG_NOTE = "mt-1 text-[11px] leading-[1.4] text-muted";
const SEG_NARRATIVA =
  "mt-2 flex flex-col gap-2.5 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:px-[9px] [&_textarea]:py-[7px] [&_textarea]:!text-[12px] [&_textarea]:!leading-[1.45]";
const SEG_CALCULO = "flex flex-col gap-2";
const SEG_CALCULO_INTRO = "m-0 text-[11px] leading-[1.4] text-muted";
const SEG_AVISO =
  "mb-3 rounded-[8px] border border-[color-mix(in_srgb,var(--warning)_35%,transparent)] border-l-[3px] border-l-warning bg-[color-mix(in_srgb,var(--warning)_7%,transparent)] px-3 py-2.5 [&_p]:mt-[5px] [&_p]:text-[12px] [&_p]:leading-[1.5] [&_p]:text-muted";
const SEG_EXCLUIDO =
  "rounded-[8px] border-l-[3px] border-l-warning bg-[color-mix(in_srgb,var(--warning)_6%,transparent)] px-3.5 py-3 [&_p]:mt-1.5 [&_p]:text-[12px] [&_p]:leading-[1.5] [&_p]:text-muted";
const SEG_CALCULO_INPUTS =
  "grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2 [&_label]:flex [&_label]:flex-col [&_label]:gap-[3px] [&_label]:text-[11px] [&_label]:text-muted [&_input]:w-full [&_input]:px-2 [&_input]:py-[5px] [&_input]:!text-[12px] [&_input]:[font-variant-numeric:tabular-nums]";
const SEG_CALCULO_LISTA =
  "m-0 flex flex-col gap-0.5 text-[12px] [&>div]:flex [&>div]:justify-between [&>div]:gap-3 [&>div]:py-[3px] [&_dt]:text-muted [&_dd]:m-0 [&_dd]:whitespace-nowrap [&_dd]:[font-variant-numeric:tabular-nums]";
const SEG_CALCULO_RES_BASE = "m-0 rounded-[8px] border px-2.5 py-2 text-[12px] leading-[1.5]";
const SEG_CALCULO_RES_TONO = {
  ok: "bg-[color-mix(in_srgb,var(--success)_10%,transparent)] border-[color-mix(in_srgb,var(--success)_30%,transparent)]",
  alta: "bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] border-[color-mix(in_srgb,var(--warning)_30%,transparent)]",
};
const SEG_CRONO_LIST = "mt-1.5 flex flex-col gap-1";
const SEG_CRONO_ROW =
  "flex items-center gap-1.5 [&_input]:flex-1 [&_input]:border [&_input]:border-line [&_input]:!rounded-[6px] [&_input]:px-[7px] [&_input]:py-[5px] [&_input]:!text-[12px]";
// El color del borde-izq lo pone cada variante (o `border-l-transparent` en el
// <em> desnudo): dejarlo en la base ganaba a las variantes por orden de cascada.
const SEG_FUENTE_BASE =
  "mt-2 rounded-[8px] border-l-[3px] bg-[#f1f5f9] px-2.5 py-2 text-[12px] leading-[1.45]";
const SEG_FUENTE_REGL = "border-l-brand bg-[color-mix(in_srgb,var(--brand)_8%,transparent)]";
const SEG_FUENTE_GUIA = "border-l-muted bg-surface text-muted";
const SEG_FUENTETAG_BASE =
  "ml-1.5 whitespace-nowrap rounded-full px-1.5 py-px align-middle text-[10px] font-semibold";
const SEG_FUENTETAG_GUIA = "border border-line bg-surface text-muted";

type CronoItem = { area: string; fecha: string };

// Insumos para calcular la cuantía: PAC de bienes y servicios (Configuración),
// valor estimado del expediente y si la contratación está programada (A1).
export type SegParametros = {
  pacBienesServicios: number | null;
  valorEstimado: number | null;
  /** Topes de procedimiento por cuantía (Configuración anual; defecto 2026). */
  topes?: TopesProcedimiento;
  /** Días estimados del cronograma POR PROCEDIMIENTO (Configuración anual). */
  diasCronogramaPorProcedimiento?: DiasCronogramaPorProcedimiento;
  programada: boolean;
  /** `programada` es una PRESUNCIÓN (A1 no lo confirmó): A2 lo advierte en el copy. */
  programadaPresumida?: boolean;
  // El Art. 42.1 excluye los contratos menores de la segmentación.
  contratoMenor?: boolean;
  // La Guía también excluye las contrataciones por CEAM de la segmentación.
  acuerdoMarco?: boolean;
  // Art. 42.3: en las no programadas, la segmentación procede una vez que la
  // necesidad consta en el CMN (se toma de A1).
  enCmn?: boolean;
  versionCmn?: string;
  /**
   * El requerimiento es una IOARR (viene de la ficha de necesidad).
   *
   * Art. 153.2: "Los requerimientos de IOARR se consideran básicos". Se pasa
   * como parámetro y no como casilla del formulario porque es un hecho del
   * proyecto, no una valoración de la DEC.
   */
  esIoarr?: boolean;
  /**
   * Valor estimado (S/) que el área usuaria declaró en A1 (rama NO programada).
   * Se muestra en el campo "Otras no programadas a segmentar" (fill-if-empty) por
   * pedido expreso de la entidad. AVISO: esta contratación TAMBIÉN entra en la
   * base como "Esta contratación" (`nuevaContratacion`), así que su monto pesa
   * DOS VECES en el cálculo del Art. 125.2. Es una decisión consciente.
   */
  valorEstimadoA1?: number | null;
};

type SegData = {
  objeto?: ObjetoSegmentacion;
  cuantiaAlta?: boolean;
  condicionesRiesgo?: string[];
  criteriosBasica?: string[];
  cronogramaItems?: CronoItem[];
  centralizada?: boolean;
  // Sumandos de la base del 10% que no salen del PAC inicial (ver la Guía).
  montoNoProgramadasConvocadas?: number | string;
  montoOtrasNoProgramadas?: number | string;
  // Cabecera (PARA/DE/ATENCIÓN) que A2 propone y A6 HEREDA para el memorando de
  // designación de evaluadores. El Informe de Segmentación (.docx de A2) ya NO
  // imprime esta cabecera, pero estos tres campos siembran la de A6 (ver la
  // siembra en fase-panel.tsx): NO son residuo aunque no salgan en el .docx de A2.
  // El correlativo del informe se retiró: A8 lleva su propia numeración.
  destinatario?: string;
  /**
   * ATENCIÓN: responsable del área usuaria y su área, de la ficha de necesidad.
   * El PARA (destinatario) va a la autoridad que aprueba; el Art. 42.2 manda a la
   * DEC informar la clasificación a las áreas usuarias, y esa es la del ATENCIÓN.
   */
  atencion?: string;
  remitente?: string;
  justificacion?: string;
  continuidad?: string;
  riesgoMercado?: string;
  estrategiaMitigacion?: string;
  puntoControl?: string;
};

function normalizarNombre(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * "QUISPE CHIPANA SAUL — Jefe de la OFICINA GENERAL DE ADMINISTRACION".
 * El memorando se dirige a un cargo, no a una oficina. Solo 1 de 67 oficinas
 * tiene `responsable_cargo`, así que sin cargo se cae al nombre de la oficina
 * en lugar de inventarse uno.
 */
/**
 * Firmante de una oficina, en DOS líneas: nombre arriba y oficina debajo.
 *
 * Antes se componía en una sola con un guion ("ROJAS MAYTAN JUAN — OFICINA DE
 * LOGISTICA"). En la cabecera de un memorando el nombre y el cargo van en
 * líneas distintas, igual que el PARA, y así se lee en el .docx tal como se
 * firma.
 */
export function responsableDeOficina(
  oficina: OficinaOpcion | undefined,
  // Padrón de personas para elevar el nombre a como se firma. El catálogo de
  // oficinas guarda "QUISPE CHIPANA SAUL" —apellidos primero, sin grado—, que
  // es como se lista en un organigrama pero no como se encabeza un documento.
  // Con el padrón sale "CPC. SAUL QUISPE CHIPANA"; sin él, al menos en orden
  // natural. Opcional para no romper a quien no lo tenga cargado.
  personas: Persona[] = [],
): string {
  if (!oficina) return "";
  const nombre = nombreParaFirma(oficina.responsable_nombre, personas);
  const cargo = (oficina.responsable_cargo ?? "").trim();
  // "Jefe de la OFICINA … JEFATURA" repite el cargo dos veces. Cuando el nombre
  // de la oficina YA denota el rol —lleva "JEFATURA" o es una "… ENCARGADA/
  // ENCARGADO DE …" (p. ej. "DEPENDENCIA ENCARGADA DE CONTRATACIONES")—, se
  // imprime el nombre a secas.
  const nombreYaEsRol = /\b(JEFATURA|ENCARGAD[AO])\b/i.test(oficina.nombre);
  const rol = cargo && !nombreYaEsRol ? `${cargo} de la ${oficina.nombre}` : oficina.nombre;
  return [nombre, rol].filter(Boolean).join(String.fromCharCode(10));
}

/**
 * Oficina que hace de DEC: la marcada en Configuración › Áreas como "gestiona
 * contrataciones".
 *
 * Es preferible al nombre fijo: cada entidad la llama de un modo (Unidad de
 * Abastecimiento, Oficina de Logística, Subgerencia de Abastecimiento…) y con un
 * literal en el código el DE salía vacío en cuanto la suya se llamaba distinto.
 * El nombre fijo queda solo como respaldo.
 */
export function oficinaDec(oficinas: OficinaOpcion[]): OficinaOpcion | undefined {
  return oficinas.find((o) => o.gestiona_contrataciones === true);
}

/**
 * Oficina que el informe de A8 propone como DE (remitente) por defecto.
 *
 * La Ley llama a la DEC "dependencia encargada de las contrataciones" (Art. 42).
 * Algunas entidades registran una oficina con ese nombre literal y quieren que el
 * DE lo use, en vez del de su unidad concreta. Así que se prefiere esa; si no
 * existe, la que está marcada como que gestiona contrataciones.
 */
export function oficinaEncargadaDeContrataciones(oficinas: OficinaOpcion[]): OficinaOpcion | undefined {
  return buscarOficina(oficinas, OFICINA_ENCARGADA_CONTRATACIONES) ?? oficinaDec(oficinas);
}

/**
 * Oficina de presupuesto: a la que la DEC solicita la certificación (Art. 14.2.j).
 * Es el ATENCIÓN por defecto de la solicitud de A7. Coincidencia flexible —primero
 * la "… PLANEAMIENTO … JEFATURA", luego cualquiera de planeamiento o presupuesto—
 * por si la entidad la nombra distinto; si no hay, el campo se elige a mano.
 */
export function oficinaPresupuesto(oficinas: OficinaOpcion[]): OficinaOpcion | undefined {
  return (
    oficinas.find((o) => /planeamiento/i.test(o.nombre) && /jefatura/i.test(o.nombre)) ??
    oficinas.find((o) => /(planeamiento|presupuesto)/i.test(o.nombre))
  );
}

/** Coincidencia exacta por nombre: evita cazar las variantes "… JEFATURA". */
function buscarOficina(oficinas: OficinaOpcion[], nombreExacto: string): OficinaOpcion | undefined {
  const objetivo = normalizarNombre(nombreExacto);
  return oficinas.find((o) => normalizarNombre(o.nombre) === objetivo);
}

/**
 * Oficina inmediata superior de la que gestiona contrataciones.
 *
 * Es a quien se dirigen los documentos que la DEC eleva: el informe de
 * segmentación (A2) y la solicitud de aprobación del expediente (A8). En la
 * práctica es la Oficina General de Administración, que es donde reside la
 * autoridad de la gestión administrativa.
 *
 * Se resuelve por NOMBRE y no por una jerarquía en la base porque el catálogo de
 * oficinas no tiene columna de dependencia: no hay de dónde deducir el superior.
 * Añadirla sería una migración y una pantalla de configuración para un dato que
 * hoy solo hace falta aquí; el día que se necesite el organigrama completo, esta
 * función es el único sitio que hay que cambiar.
 */
export function oficinaSuperiorDeLaDec(oficinas: OficinaOpcion[]): OficinaOpcion | undefined {
  return buscarOficina(oficinas, OFICINA_DESTINO) ?? buscarOficina(oficinas, OFICINA_DESTINO_ALT);
}

// Destinatario y remitente por defecto del informe (Art. 42.2: la DEC informa a
// la autoridad de la gestión administrativa). Si la entidad no tiene estas
// oficinas con esos nombres, el campo queda vacío y se escribe a mano: es
// preferible a proponer un cargo equivocado en un documento que se firma.
/**
 * PARA del memorando a partir de la ficha de necesidad: responsable en la
 * primera línea y su área usuaria debajo.
 *
 * El memorando va dirigido a una PERSONA en un cargo; el catálogo de oficinas
 * solo conoce cargos genéricos, así que la ficha manda cuando la hay.
 */
export function destinatarioDeLaFicha(
  responsable: string,
  areaUsuaria: string,
  personas: Persona[] = [],
): string {
  // La ficha guarda el responsable como el padrón ("CCAHUANA MENDOZA NILDO"); en
  // la cabecera de un memorando se escribe como se firma, con su grado. Se
  // resuelve contra Configuración › Usuarios en vez de darle la vuelta a ciegas:
  // los nombres guardados no siguen todos el mismo orden.
  return [nombreParaFirma(responsable, personas), areaUsuaria.trim()]
    .filter(Boolean)
    .join(String.fromCharCode(10));
}

/**
 * PARA que debe proponerse, o null si hay que dejar lo que ya está.
 *
 * La regla no es "solo si está vacío" sino "solo si nadie lo ha escrito". El
 * valor derivado del catálogo de oficinas es un DEFECTO, no una decisión: si el
 * campo aún lo conserva —porque el paso se abrió antes de que existiera la
 * ficha— se puede sustituir por el de la ficha, que es más preciso. Lo que
 * nunca se toca es un texto escrito a mano: el documento se firma.
 */
export function destinoAProponer(entrada: {
  actual: string;
  deLaFicha: string;
  deOficina: string;
}): string | null {
  const actual = entrada.actual.trim();
  const ficha = entrada.deLaFicha.trim();
  const oficina = entrada.deOficina.trim();
  const propuesto = ficha || oficina;
  if (!propuesto) return null;
  // Se propone si el campo está vacío, si conserva el defecto actual del
  // catálogo, o si lo que hay es una versión ANTERIOR del mismo dato.
  //
  // Esto último importa: el formato ha cambiado varias veces —"NOMBRE — Cargo
  // de la Oficina" en una línea, luego dos líneas, luego con grado académico— y
  // comparar solo contra el defecto de HOY dejaba los valores viejos
  // congelados: se tomaban por texto escrito a mano y no se actualizaban nunca.
  const esDefecto =
    actual === "" ||
    (oficina !== "" && actual === oficina) ||
    mismaPersona(personaDeLaFirma(actual), personaDeLaFirma(propuesto));
  if (!esDefecto) return null;
  return propuesto === actual ? null : propuesto;
}

/**
 * Nombre de la persona dentro de una firma, sea cual sea el formato en que se
 * guardó: primera línea, sin el cargo que iba tras el guion largo y sin el
 * grado académico de delante.
 *
 *   "SAUL QUISPE CHIPANA — Jefe de la OFICINA…"  → "SAUL QUISPE CHIPANA"
 *   "CPC. SAUL QUISPE CHIPANA
OFICINA…"         → "SAUL QUISPE CHIPANA"
 */
export function personaDeLaFirma(valor: string): string {
  const primeraLinea = (valor ?? "").split(/\r?\n/)[0] ?? "";
  const sinCargo = primeraLinea.split("—")[0] ?? primeraLinea;
  // El grado va delante y termina en punto ("CPC.", "ABG.", "ING.").
  return sinCargo.replace(/^\s*\S{2,6}\.\s+/, "").trim();
}

// Oficina a la que se dirige el memorando. El catálogo tiene dos variantes de
// la OGA —"OFICINA GENERAL DE ADMINISTRACION" y la misma con "JEFATURA"— y es
// la segunda la que encabeza el documento. Se busca primero esa y, si la
// entidad no la tiene registrada, se cae a la variante sin sufijo.
const OFICINA_DESTINO = "OFICINA GENERAL DE ADMINISTRACION JEFATURA";
const OFICINA_DESTINO_ALT = "OFICINA GENERAL DE ADMINISTRACION";
// Nombre genérico de la DEC en la Ley (Art. 42). Cuando la entidad registra una
// oficina con este nombre, el DE del informe la usa por defecto.
const OFICINA_ENCARGADA_CONTRATACIONES = "DEPENDENCIA ENCARGADA DE CONTRATACIONES";
// Respaldo cuando ninguna oficina está marcada como la que gestiona
// contrataciones. Con la marca puesta en Configuración, este nombre no se usa.
const OFICINA_REMITE = "OFICINA DE LOGISTICA";

// Campos narrativos del informe, con su ayuda. Se renderizan en un <details>
// para no alargar el paso: solo hacen falta al exportar el documento.
/**
 * Campos narrativos del informe, con SU ORIGEN.
 *
 * Todos son práctica de la Guía de Actuaciones Preparatorias: útiles, pero no
 * exigibles por el Reglamento. Por eso el bloque va plegado; sin marcarlo como
 * opcional parecería obligatorio y se rellenaría por si acaso.
 *
 * Ojo con los tres de riesgo: el Art. 125.4 orienta a disminuir riesgos la
 * ESTRATEGIA DE CONTRATACIÓN (paso A4), no la segmentación. Aquí se anticipan.
 */
export const CAMPOS_NARRATIVA: Array<{
  key: keyof SegData;
  label: string;
  hint: string;
  rows: number;
}> = [
  // Los campos de cabecera de memorando (Número del informe, PARA, ATENCIÓN, DE)
  // se retiraron a propósito: no se muestran en el formulario ni se imprimen en
  // el .docx (el informe los aporta desde el membrete/numeración de la entidad,
  // no desde aquí). Solo queda la NARRATIVA, que es lo que da sustancia al
  // Informe de Segmentación.
  { key: "justificacion", label: "Justificación de la categoría", hint: "Sustento de oferta, pluralidad de proveedores, procesos desiertos previos… Va en la Matriz de Segmentación.", rows: 4 },
  { key: "continuidad", label: "Continuidad (opcional)", hint: "Ej. la provisión cubre un pacto colectivo de entrega diaria.", rows: 2 },
  { key: "riesgoMercado", label: "Riesgo de mercado", hint: "Ej. mínimo: producto con oferta permanente y precios estables.", rows: 2 },
  { key: "estrategiaMitigacion", label: "Estrategia de mitigación", hint: "Ej. coordinación con el contratista para entregas en fechas pactadas.", rows: 2 },
  { key: "puntoControl", label: "Punto de control", hint: "Ej. verificación del registro sanitario vigente en cada entrega.", rows: 2 },
];

// Formulario especial del paso A2 · Segmentación. Calcula en vivo la categoría y
// el nivel mínimo de interacción con el mercado según la guía (Art. 42/125/153).
export function SegmentacionForm({
  value,
  onChange,
  readOnly = false,
  areaUsuariaSugerida = "",
  responsableSugerido = "",
  objetoSugerido,
  parametros,
}: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  readOnly?: boolean;
  areaUsuariaSugerida?: string;
  /**
   * Objeto de segmentación por defecto, derivado del "Tipo de objeto" de la
   * necesidad vinculada. Solo se usa si A2 aún no tiene objeto elegido: la DEC
   * puede cambiarlo. Sin necesidad reconocida, cae al valor por defecto histórico.
   */
  objetoSugerido?: ObjetoSegmentacion;
  /**
   * Responsable del área usuaria, de la ficha de necesidad. Encabeza el PARA
   * del informe, con su área debajo: el memorando va dirigido a una PERSONA en
   * un cargo, y así se lee en el .docx tal como se firma.
   */
  responsableSugerido?: string;
  parametros?: SegParametros;
}) {
  const data = value as SegData;
  // Por defecto, el objeto que trae la ficha de la necesidad (Tipo de objeto);
  // si no se reconoce, el valor histórico. La DEC puede cambiarlo en el select.
  const objeto: ObjetoSegmentacion = data.objeto ?? objetoSugerido ?? "bienes_servicios";
  const condiciones = Array.isArray(data.condicionesRiesgo) ? data.condicionesRiesgo : [];
  const criterios = Array.isArray(data.criteriosBasica) ? data.criteriosBasica : [];

  // Catálogo de áreas usuarias (oficinas) para el cronograma — mismo origen que
  // el campo "Área usuaria" de la Necesidad.
  const [oficinas, setOficinas] = useState<OficinaOpcion[]>([]);
  // Padrón de Configuración › Usuarios: da el grado y el orden con que se firma.
  const [personas, setPersonas] = useState<Persona[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [resOf, resPer] = await Promise.all([
          fetch("/api/oficinas", { cache: "no-store" }),
          fetch("/api/personas", { cache: "no-store" }),
        ]);
        const payload = await resOf.json();
        const padron = await resPer.json();
        // Sin oficinas, el "Área usuaria" se escribe a mano: degradar está bien,
        // pero tiene que quedar constancia de por qué.
        if (!resOf.ok) {
          console.error("[segmentacion] no se pudieron cargar las oficinas:", payload?.error);
        }
        if (!cancelled) {
          setOficinas(payload.oficinas ?? []);
          setPersonas(padron.personas ?? []);
        }
      } catch {
        if (!cancelled) {
          setOficinas([]);
          setPersonas([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cuantía calculada contra el PAC. Si está registrado, la cuantía deja de ser
  // una apreciación del usuario y pasa a ser una operación aritmética.
  // La contratación evaluada se registra DENTRO de "Otras no programadas a
  // segmentar" (a pedido de la entidad, cuando A1 declaró su valor estimado): no
  // se muestra ni se suma como "Esta contratación" aparte, para que cuente una
  // sola vez.
  const contratacionEnOtras = Boolean(parametros?.valorEstimadoA1);

  const calculo = useMemo(
    () =>
      objeto === "bienes_servicios" && parametros
        ? calcularParametrosSegmentacion({
            pacBienesServicios: parametros.pacBienesServicios,
            // Sumandos que la Guía exige y que no salen del PAC inicial.
            noProgramadasConvocadas: Number(data.montoNoProgramadasConvocadas) || 0,
            otrasNoProgramadasASegmentar: Number(data.montoOtrasNoProgramadas) || 0,
            programada: parametros.programada,
            valorEstimado: parametros.valorEstimado,
            contratacionEnOtras,
          })
        : null,
    [objeto, parametros, data.montoNoProgramadasConvocadas, data.montoOtrasNoProgramadas, contratacionEnOtras],
  );

  // El cálculo manda sobre lo elegido a mano (el informe hace lo mismo en el
  // servidor, así que lo que se ve aquí es lo que sale en el .docx). Sin cálculo
  // se respeta la elección del usuario TAL CUAL: `undefined` = aún sin responder,
  // que NO es lo mismo que "baja" (antes se forzaba a `false` y clasificaba como
  // Rutinaria en silencio una cuantía que nadie determinó).
  const cuantiaEfectiva = calculo ? calculo.cuantiaAlta : data.cuantiaAlta;

  // Bienes/servicios sin cálculo automático (falta PAC o valor estimado) y sin
  // que el usuario haya elegido alta/baja: la cuantía está SIN DETERMINAR. Se
  // avisa y no se da la categoría por firme, porque de la cuantía depende que
  // salga Rutinaria/Crítico (baja) u Operacional/Estratégico (alta). El mismo
  // helper gobierna el bloqueo de cierre de A2 en el panel.
  const cuantiaSinDeterminar = cuantiaSegmentacionSinDeterminar({
    objeto,
    cuantiaAlta: data.cuantiaAlta,
    pacBienesServicios: parametros?.pacBienesServicios,
    valorEstimado: parametros?.valorEstimado,
  });

  const resultado = useMemo(
    () =>
      clasificarSegmentacion({
        objeto,
        cuantiaAlta: cuantiaEfectiva,
        condicionesRiesgo: condiciones,
        criteriosBasica: criterios,
        centralizada: Boolean(data.centralizada),
        esIoarr: Boolean(parametros?.esIoarr),
      }),
    [objeto, cuantiaEfectiva, condiciones, criterios, data.centralizada, parametros?.esIoarr],
  );

  // Endurece el objeto de A2: en cuanto la ficha aporta su `tipo_objeto`
  // (objetoSugerido), lo FIJA como objeto de la segmentación si A2 aún no tiene uno.
  // Fill-if-empty —nunca pisa lo que la DEC cambie— y garantiza que el objeto quede
  // PERSISTIDO desde la necesidad aunque nadie abra A2, en vez de quedarse en el
  // default duro "bienes_servicios" (que dejaba una obra clasificada como bien/servicio).
  useEffect(() => {
    if (readOnly || data.objeto || !objetoSugerido) return;
    onChange({ ...value, objeto: objetoSugerido });
  }, [readOnly, data.objeto, objetoSugerido, value, onChange]);

  // Muestra en "Otras no programadas a segmentar" el valor estimado declarado en
  // A1 (rama no programada) si ese campo aún está vacío. Fill-if-empty: no pisa lo
  // que la DEC escriba, y se puede borrar. OJO: esta contratación TAMBIÉN entra en
  // la base como "Esta contratación" (`nuevaContratacion`), así que su monto pesa
  // DOS VECES en el Art. 125.2. Se hace a pedido expreso de la entidad.
  useEffect(() => {
    if (readOnly) return;
    const v = parametros?.valorEstimadoA1;
    if (typeof v !== "number" || !(v > 0)) return;
    const yaHay =
      data.montoOtrasNoProgramadas != null && String(data.montoOtrasNoProgramadas).trim() !== "";
    if (yaHay) return;
    onChange({ ...value, montoOtrasNoProgramadas: v });
  }, [readOnly, parametros?.valorEstimadoA1, data.montoOtrasNoProgramadas, value, onChange]);

  function set(patch: Partial<SegData>) {
    if (readOnly) return;
    // Materializa el objeto y el `esIoarr` (que viene de los parámetros, no de un
    // control visible) para que se persistan aunque el usuario no toque esos
    // controles. Sin esto, exportar el Informe / Anexo 2, el gating de A5 y la
    // verificación de A4 (n) re-derivan la segmentación SIN esos datos y no
    // coinciden con el "Resultado de la segmentación" que se ve aquí.
    const next = { ...value, objeto, esIoarr: Boolean(parametros?.esIoarr), ...patch };
    // La cuantía se materializa SOLO cuando está determinada: la fija el cálculo
    // automático (hay PAC y valor). El usuario al elegir un radio la manda en
    // `patch`. Sin cálculo y sin elección se deja como esté —posiblemente
    // `undefined`— para no persistir un "baja" que nadie decidió (ver hallazgo de
    // sub-clasificación silenciosa).
    if (calculo) next.cuantiaAlta = calculo.cuantiaAlta;
    onChange(next);
  }

  // Prellena el cronograma (una sola vez) con el área usuaria de la necesidad de
  // origen si aún no hay filas. El usuario puede editarla o agregar más.
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (readOnly || prefilledRef.current || !areaUsuariaSugerida) return;
    const items = Array.isArray(data.cronogramaItems) ? data.cronogramaItems : [];
    if (items.length > 0) return;
    prefilledRef.current = true;
    set({ cronogramaItems: [{ area: areaUsuariaSugerida, fecha: "" }] });
    // set/data se omiten a propósito: solo debe correr al llegar la sugerencia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaUsuariaSugerida, readOnly]);

  // PARA/DE/ATENCIÓN que hereda la cabecera de A6: se proponen en cuanto llegan
  // sus fuentes, una sola vez cada uno y solo si están vacíos. Nunca pisan lo
  // escrito: el documento se firma y el usuario manda sobre el valor por defecto.
  //
  // Un candado POR CAMPO, no uno común: el remitente sale del catálogo de
  // oficinas y el destinatario de la ficha de necesidad, que son dos peticiones
  // distintas. Con un candado único, rellenar el remitente primero cerraba el
  // destinatario antes de que llegaran los datos de la ficha.
  const destinoRef = useRef(false);
  const atencionRef = useRef(false);
  const remiteRef = useRef(false);
  useEffect(() => {
    if (readOnly) return;
    const patch: Partial<SegData> = {};

    // PARA: la autoridad que aprueba, del catálogo de oficinas.
    if (!destinoRef.current && oficinas.length > 0) {
      const destino = destinoAProponer({
        actual: data.destinatario ?? "",
        deLaFicha: "",
        deOficina: responsableDeOficina(oficinaSuperiorDeLaDec(oficinas), personas) ?? "",
      });
      if (destino) {
        patch.destinatario = destino;
        destinoRef.current = true;
      }
    }

    // ATENCIÓN: el área usuaria, que es a quien el Art. 42.2 manda informar.
    // Sale de la ficha y no depende del catálogo de oficinas.
    if (!atencionRef.current) {
      const atencion = destinoAProponer({
        actual: data.atencion ?? "",
        deLaFicha: destinatarioDeLaFicha(responsableSugerido, areaUsuariaSugerida, personas),
        deOficina: "",
      });
      if (atencion) {
        patch.atencion = atencion;
        atencionRef.current = true;
      }
    }

    // DE: la oficina que hace de DEC. Pasa por la MISMA regla que los otros dos
    // —vacío, defecto actual o versión anterior del mismo dato— y no por un
    // "solo si está vacío": con eso, un remitente guardado con el formato viejo
    // ("NOMBRE — Oficina", sin grado) se quedaba congelado para siempre
    // mientras el PARA y el ATENCIÓN sí se actualizaban.
    if (!remiteRef.current && oficinas.length > 0) {
      const remite = destinoAProponer({
        actual: data.remitente ?? "",
        deLaFicha: "",
        deOficina:
          responsableDeOficina(oficinaDec(oficinas) ?? buscarOficina(oficinas, OFICINA_REMITE), personas) ?? "",
      });
      if (remite) {
        patch.remitente = remite;
        remiteRef.current = true;
      }
    }

    if (Object.keys(patch).length > 0) set(patch);
    // `set`/`data` se omiten: el efecto debe correr cuando llegan las FUENTES
    // (oficinas y ficha), no en cada tecleo del usuario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oficinas, personas, readOnly, responsableSugerido, areaUsuariaSugerida]);

  function toggleCondicion(key: string) {
    if (readOnly) return;
    const next = condiciones.includes(key)
      ? condiciones.filter((k) => k !== key)
      : [...condiciones, key];
    set({ condicionesRiesgo: next });
  }

  function toggleCriterio(key: string) {
    if (readOnly) return;
    const next = criterios.includes(key)
      ? criterios.filter((k) => k !== key)
      : [...criterios, key];
    set({ criteriosBasica: next });
  }

  // Art. 42.1: la segmentación clasifica las contrataciones del PAC del CMN
  // "con excepción de aquellas que correspondan a contratos menores". La Guía
  // hace lo mismo con el CEAM. Se avisa en vez de bloquear: el tipo de
  // procedimiento puede estar mal registrado y no queremos impedir corregirlo.
  if (parametros?.contratoMenor || parametros?.acuerdoMarco) {
    return (
      <div className={SEG_FORM}>
        <div className={SEG_EXCLUIDO}>
          <strong>Este paso no aplica: {parametros?.acuerdoMarco ? "es una compra por catálogo electrónico de acuerdo marco (CEAM)" : "es un contrato menor"}.</strong>
          <p>
            {parametros?.acuerdoMarco
              ? "La Guía de Actuaciones Preparatorias (R.D. 019-2026-EF/54.01) no incluye al catálogo electrónico de acuerdo marco entre las contrataciones que se segmentan."
              : "El numeral 42.1 del Reglamento excluye expresamente a los contratos menores de la segmentación de contrataciones."}{" "}
            Puedes continuar con el resto de la Fase 1 sin completar A2. Si el expediente no es
            realmente {parametros?.acuerdoMarco ? "un CEAM" : "un contrato menor"}, corrige el tipo de
            procedimiento.
          </p>
        </div>
      </div>
    );
  }

  // Art. 42.3: en las contrataciones no consideradas en el PAC del CMN, la DEC
  // segmenta "una vez que el área usuaria haya solicitado la modificación del
  // CMN". Sin esa constancia en A1, la segmentación se estaría adelantando a su
  // precondición y el informe afirmaría algo que nadie verificó.
  const cmnPendiente = parametros?.programada === false && parametros?.enCmn !== true;

  return (
    <div className={SEG_FORM}>
      {cmnPendiente ? (
        <div className={SEG_AVISO} role="status">
          <strong>Falta verificar el CMN antes de segmentar.</strong>
          <p>
            Esta contratación no está programada en el PAC. El numeral 42.3 del Reglamento exige
            que la DEC segmente <em>una vez que el área usuaria haya solicitado la modificación
            del CMN</em>. En el paso A1 no consta que la necesidad esté incluida en el CMN.
            Márcalo en A1 antes de dar por cerrada la segmentación: mientras tanto, el informe
            exportado dejará constancia de que la precondición está pendiente.
          </p>
        </div>
      ) : null}

      <label className={SEG_FIELD}>
        <span>Objeto de la contratación</span>
        <select
          disabled={readOnly}
          onChange={(e) => set({ objeto: e.target.value as ObjetoSegmentacion })}
          value={objeto}
        >
          <option value="bienes_servicios">Bienes y servicios (incluye consultorías en general)</option>
          <option value="obras_consultoria_obras">Obras y consultoría de obras</option>
        </select>
      </label>

      <label className={SEG_OPCION} style={{ marginBottom: 8 }}>
        <input
          checked={Boolean(data.centralizada)}
          disabled={readOnly}
          onChange={(e) => set({ centralizada: e.target.checked })}
          type="checkbox"
        />
        <span><strong>Compra centralizada o corporativa</strong> — marca si esta contratación se realiza mediante compra centralizada o corporativa. La clasificación se fuerza como <em>Estratégico</em> (bienes/servicios) o <em>Contratación avanzada</em> (obras/consultoría).</span>
      </label>

      {objeto === "bienes_servicios" ? (
        <>
          <fieldset className={SEG_FIELDSET}>
            <legend>Cuantía</legend>
            {calculo ? (
              <div className={SEG_CALCULO}>
                <p className={SEG_CALCULO_INTRO}>
                  {parametros?.programadaPresumida
                    ? "Se PRESUME programada en el PAC —A1 aún no lo confirma; respóndelo en el paso «Programar en el CMN y el PAC»—. Con esa presunción su monto ya está considerado y la línea de corte es el 10% del monto total del PAC vigente:"
                    : parametros?.programada
                      ? "La contratación está programada en el PAC, así que su monto ya está considerado. La línea de corte es el 10% del monto total del PAC vigente:"
                      : "La contratación no está programada, así que su monto se suma al PAC vigente para establecer la línea de corte:"}
                </p>

                {/* De dónde sale cada regla del cálculo. El Reglamento fija el
                    umbral; el desglose de la base lo concreta la Guía. Sin
                    distinguirlo, todo el cálculo parecía tener el mismo respaldo
                    y no se sabía qué es discutible con la entidad y qué no. */}
                <p className={`${SEG_FUENTE_BASE} ${SEG_FUENTE_REGL}`}>
                  <strong>Art. 125.2 (Reglamento):</strong> es de alta cuantía la contratación cuya
                  cuantía en el PAC del CMN vigente al momento de segmentar <em>supera</em> el 10%
                  del monto total para las contrataciones de bienes o servicios. Igualar la línea no
                  la supera.
                </p>
                <p className={`${SEG_FUENTE_BASE} ${SEG_FUENTE_GUIA}`}>
                  <strong>Criterio de la Guía:</strong> la base se toma combinada (bienes y
                  servicios juntos) y se le suman las no programadas ya convocadas y las otras que
                  se segmenten a la vez. El Art. 125.2 no detalla ese desglose.
                </p>

                {/* La Guía exige sumar a la base, además del PAC inicial, las no
                    programadas ya convocadas y las otras que se segmenten a la vez. */}
                <div className={SEG_CALCULO_INPUTS}>
                  <label>
                    <span>No programadas ya convocadas (S/)</span>
                    <input
                      disabled={readOnly}
                      min={0}
                      onChange={(e) => set({ montoNoProgramadasConvocadas: e.target.value })}
                      placeholder="0.00"
                      step="0.01"
                      type="number"
                      value={(data.montoNoProgramadasConvocadas as string | undefined) ?? ""}
                    />
                  </label>
                  <label>
                    <span>Otras no programadas a segmentar (S/)</span>
                    <input
                      disabled={readOnly}
                      min={0}
                      onChange={(e) => set({ montoOtrasNoProgramadas: e.target.value })}
                      placeholder="0.00"
                      step="0.01"
                      type="number"
                      value={(data.montoOtrasNoProgramadas as string | undefined) ?? ""}
                    />
                  </label>
                </div>
                <p className={SEG_NOTE} style={{ marginTop: 0 }}>
                  Déjalos en 0 si no aplican. Si los omites cuando sí existen, la base queda corta
                  y una contratación de baja cuantía puede salir como alta.
                </p>

                <dl className={SEG_CALCULO_LISTA}>
                  <div>
                    <dt>Monto inicial PAC (bienes/servicios)</dt>
                    <dd>{soles(calculo.montoInicialPac)}</dd>
                  </div>
                  {calculo.noProgramadasConvocadas > 0 ? (
                    <div>
                      <dt>+ No programadas ya convocadas</dt>
                      <dd>{soles(calculo.noProgramadasConvocadas)}</dd>
                    </div>
                  ) : null}
                  {calculo.otrasNoProgramadasASegmentar > 0 ? (
                    <div>
                      <dt>+ Otras no programadas a segmentar{contratacionEnOtras ? " (+ Esta contratación)" : ""}</dt>
                      <dd>{soles(calculo.otrasNoProgramadasASegmentar)}</dd>
                    </div>
                  ) : null}
                  {!parametros?.programada && !contratacionEnOtras ? (
                    <div>
                      <dt>+ Esta contratación</dt>
                      <dd>{soles(calculo.nuevaContratacion)}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Monto total actualizado</dt>
                    <dd>{soles(calculo.montoActualizado)}</dd>
                  </div>
                  <div>
                    <dt>Línea de corte (10%)</dt>
                    <dd>
                      <strong>{soles(calculo.lineaCorte)}</strong>
                    </dd>
                  </div>
                </dl>
                <p className={`${SEG_CALCULO_RES_BASE} ${calculo.cuantiaAlta ? SEG_CALCULO_RES_TONO.alta : SEG_CALCULO_RES_TONO.ok}`} data-alta={calculo.cuantiaAlta ? "1" : "0"}>
                  Cuantía de la contratación {soles(calculo.valorEstimado)} = <strong>{calculo.porcentaje}%</strong>{" "}
                  del total actualizado ⇒ cuantía{" "}
                  <strong>{calculo.cuantiaAlta ? "ALTA" : "BAJA"}</strong>{" "}
                  ({calculo.cuantiaAlta ? "supera" : "no supera"} la línea de corte).
                </p>
              </div>
            ) : (
              <>
                <p className={SEG_NOTE}>
                  {objeto === "bienes_servicios" && parametros && !parametros.valorEstimado
                    ? "El expediente aún no tiene cuantía de la contratación, así que se determina a mano."
                    : "Registra el monto del PAC de bienes y servicios en Configuración → Municipalidad para que la cuantía se calcule sola y quede sustentada en el informe."}
                </p>
                {/* Tres estados: ninguno marcado hasta que se responda. Así una
                    cuantía sin determinar no se cuenta como "baja" por defecto. */}
                <label className={SEG_OPCION}>
                  <input
                    checked={data.cuantiaAlta === false}
                    disabled={readOnly}
                    name="cuantia"
                    onChange={() => set({ cuantiaAlta: false })}
                    type="radio"
                  />
                  <span>Baja — ≤ 10% del monto total del PAC para el objeto</span>
                </label>
                <label className={SEG_OPCION}>
                  <input
                    checked={data.cuantiaAlta === true}
                    disabled={readOnly}
                    name="cuantia"
                    onChange={() => set({ cuantiaAlta: true })}
                    type="radio"
                  />
                  <span>Alta — &gt; 10% del monto total del PAC para el objeto</span>
                </label>
                {cuantiaSinDeterminar ? (
                  <p className={SEG_AVISO} role="status" style={{ marginTop: 8 }}>
                    <strong>Falta determinar la cuantía.</strong> Elige <em>Alta</em> o <em>Baja</em>
                    {" "}(o registra el valor estimado y el PAC para calcularla): de esto depende que
                    la categoría salga Rutinaria/Crítico (baja) u Operacional/Estratégico (alta). Sin
                    responder, la categoría de abajo asume «baja» pero no queda determinada.
                  </p>
                ) : null}
              </>
            )}
          </fieldset>

          <fieldset className={SEG_FIELDSET}>
            <legend>Condiciones de alto riesgo (marca las que apliquen · basta una)</legend>
            {CONDICIONES_RIESGO_BS.map((c) => (
              <label className={SEG_OPCION} key={c.key}>
                <input
                  checked={condiciones.includes(c.key)}
                  disabled={readOnly}
                  onChange={() => toggleCondicion(c.key)}
                  type="checkbox"
                />
                <span>
                  {c.label}{" "}
                  <em className={`${SEG_FUENTE_BASE} border-l-transparent`}>
                    {c.fuente === "reglamento" ? "Art. 125.3 Reglamento" : "Guía de Act. Preparatorias"}
                  </em>
                </span>
              </label>
            ))}
          </fieldset>
        </>
      ) : (
        <fieldset className={SEG_FIELDSET}>
          <legend>Criterios concurrentes de “contratación básica” (todos deben cumplirse · Art. 153)</legend>
          {parametros?.esIoarr ? (
            <p className={`${SEG_FUENTE_BASE} ${SEG_FUENTE_REGL}`}>
              <strong>Requerimiento de IOARR.</strong> El Art. 153.2 los clasifica como{" "}
              <strong>contratación básica</strong> sin exigir los cuatro criterios de abajo. Se
              conservan visibles porque el informe deja constancia de cuáles se cumplen.
            </p>
          ) : null}
          {CRITERIOS_OBRA_BASICA.map((c) => (
            <label className={SEG_OPCION} key={c.key}>
              <input
                checked={criterios.includes(c.key)}
                disabled={readOnly}
                onChange={() => toggleCriterio(c.key)}
                type="checkbox"
              />
              <span>{c.label}</span>
            </label>
          ))}
        </fieldset>
      )}

      <div className={`${SEG_RESULT_BASE} ${resultado.nivel === "consulta_mercado_avanzada" || resultado.nivel === "indagacion_avanzada" ? SEG_RESULT_TONO.avanzado : SEG_RESULT_TONO.normal}`} data-nivel={resultado.nivel} data-provisional={cuantiaSinDeterminar ? "1" : undefined}>
        <div className={SEG_RESULT_HEAD}>
          <Calculator size={15} />
          <span>Resultado de la segmentación{cuantiaSinDeterminar ? " (provisional — falta la cuantía)" : ""}</span>
        </div>
        <div className={SEG_RESULT_GRID}>
          <div>
            <span className={SEG_RESULT_LABEL}>Categoría</span>
            <strong className={SEG_RESULT_CATEGORIA}>{resultado.categoriaLabel}</strong>
          </div>
          <div>
            <span className={SEG_RESULT_LABEL}>Nivel mínimo de interacción</span>
            <strong>{resultado.nivelLabel}</strong>
          </div>
        </div>
        <p className={SEG_RESULT_REQ}>
          <Info size={13} /> {resultado.nivelRequisito}
        </p>
      </div>

      {/* Tabla de referencia: categoría ↔ nivel de interacción */}
      <details className={SEG_REFTABLE}>
        <summary>Tabla de referencia: categoría ↔ nivel de interacción (Guía de Act. Preparatorias; categorías del Art. 125 Reglamento)</summary>
        <table>
          <thead>
            <tr><th>Categoría</th><th>Cuantía</th><th>Riesgo</th><th>Interacción mínima</th></tr>
          </thead>
          <tbody>
            <tr className={resultado.categoria === "rutinaria" ? SEG_REF_ACTIVE : undefined}>
              <td>Rutinaria</td><td>Baja (≤10% PAC)</td><td>Bajo</td><td>Indagación básica (1 fuente)</td>
            </tr>
            <tr className={resultado.categoria === "operacional" ? SEG_REF_ACTIVE : undefined}>
              <td>Operacional</td><td>Alta (&gt;10% PAC)</td><td>Bajo</td><td>Indagación avanzada (2+ fuentes)</td>
            </tr>
            <tr className={resultado.categoria === "critico" ? SEG_REF_ACTIVE : undefined}>
              <td>Crítico</td><td>Baja (≤10% PAC)</td><td>Alto</td><td>Consulta mercado básica (1 herramienta)</td>
            </tr>
            <tr className={resultado.categoria === "estrategico" ? SEG_REF_ACTIVE : undefined}>
              <td>Estratégico</td><td>Alta (&gt;10% PAC)</td><td>Alto</td><td>Consulta mercado avanzada (2+ herramientas)</td>
            </tr>
          </tbody>
        </table>
        <p className={SEG_NOTE}>Para obras/consultoría de obras: Contratación básica ↔ Consulta mercado básica; Contratación avanzada ↔ Consulta mercado avanzada (Art. 153 Reglamento). Las compras centralizadas o corporativas fuerzan la categoría: Estratégico (bienes/servicios) o Contratación avanzada (obras/consultoría).</p>
      </details>

      {/* Texto del informe: solo hace falta al exportar el .docx, así que va
          plegado para no alargar el paso. */}
      <details className={SEG_REFTABLE} style={{ marginTop: 12 }}>
        <summary>Texto del Informe de Segmentación (justificación y gestión de riesgos)</summary>
        <p className={SEG_NOTE} style={{ marginBottom: 8 }}>
          Estos textos se incorporan al documento .docx que se exporta. Se dejan en blanco si no aplican:
          su bloque se omite del informe. Admiten <strong>**negrita**</strong>, <em>*cursiva*</em> y
          __subrayado__.
        </p>
        <p className={`${SEG_FUENTE_BASE} ${SEG_FUENTE_GUIA}`}>
          <strong>Criterio de la Guía:</strong> la justificación y los tres campos de riesgo no los
          exige el Reglamento. El Art. 125.4 orienta a disminuir riesgos la <em>estrategia de
          contratación</em> (paso A4), no la segmentación: aquí se anticipan. Rellénalos si tu
          entidad los pide en el Anexo N.° 3.
        </p>
        <div className={SEG_NARRATIVA}>
          {CAMPOS_NARRATIVA.map((campo) => (
            <label className={SEG_FIELD} key={campo.key}>
              <span>
                {campo.label}
                <span className={`${SEG_FUENTETAG_BASE} ${SEG_FUENTETAG_GUIA}`}>Guía</span>
              </span>
              <textarea
                disabled={readOnly}
                onChange={(e) => set({ [campo.key]: e.target.value })}
                placeholder={campo.hint}
                rows={campo.rows}
                value={(data[campo.key] as string | undefined) ?? ""}
              />
            </label>
          ))}
        </div>
      </details>

      {/* Cronograma de presentación de requerimientos (Art. 42.2).
          Solo para contrataciones programadas: en una no programada el
          requerimiento ya llegó (es lo que dispara la segmentación, Art. 42.3),
          así que no hay nada que calendarizar. */}
      {parametros?.programada === false ? null : (
      <fieldset className={SEG_FIELDSET} style={{ marginTop: 12 }}>
        <legend>Cronograma de presentación de requerimientos (Art. 42.2)</legend>
        <p className={SEG_NOTE}>
          Culminada la segmentación de las contrataciones programadas, la DEC elabora el cronograma con las fechas estimadas para la remisión de los requerimientos por parte de las áreas usuarias, y lo comunica mediante documento interno.
        </p>
        {Array.isArray(data.cronogramaItems) && data.cronogramaItems.length > 0 ? (
          <div className={SEG_CRONO_LIST}>
            {data.cronogramaItems.map((item, i) => (
              <div className={SEG_CRONO_ROW} key={i}>
                {readOnly ? (
                  <input disabled placeholder="Área usuaria" value={item.area} />
                ) : (
                  <OficinaCombobox
                    allowFreeText
                    oficinas={oficinas}
                    onChange={(nombre) => {
                      const next = [...(data.cronogramaItems as CronoItem[])];
                      next[i] = { ...next[i], area: nombre };
                      set({ cronogramaItems: next });
                    }}
                    placeholder="Área usuaria"
                    value={item.area}
                  />
                )}
                <input
                  disabled={readOnly}
                  onChange={(e) => {
                    const next = [...(data.cronogramaItems as CronoItem[])];
                    next[i] = { ...next[i], fecha: e.target.value };
                    set({ cronogramaItems: next });
                  }}
                  type="date"
                  value={item.fecha}
                />
                {!readOnly ? (
                  <button className="segCronoRemove" onClick={() => {
                    const next = (data.cronogramaItems as CronoItem[]).filter((_, j) => j !== i);
                    set({ cronogramaItems: next });
                  }} type="button">
                    <Trash2 size={13} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {!readOnly ? (
          <button className="secondaryButton compactButton" onClick={() => {
            const next = [...(Array.isArray(data.cronogramaItems) ? (data.cronogramaItems as CronoItem[]) : []), { area: "", fecha: "" }];
            set({ cronogramaItems: next });
          }} style={{ marginTop: 6 }} type="button">
            <Plus size={13} /> Agregar área usuaria
          </button>
        ) : null}
      </fieldset>
      )}
    </div>
  );
}
