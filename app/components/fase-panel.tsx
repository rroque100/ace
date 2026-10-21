"use client";

import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  Info,
  Lightbulb,
  Loader,
  RefreshCw,
  Save,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import {
  type HitoEstado,
  type HitoStatus,
  type HitosMap,
  type FaseId,
  HITO_STATUS_META,
  accionesDeF1,
  hitosDeFase,
  progresoDeFase,
} from "@/lib/procurement-fases";
import {
  type CampoFormulario,
  type CategoriaSegmentacion,
  type NivelInteraccion,
  type SegmentacionInput,
  NIVEL_INTERACCION_META,
  OPCIONES_TIPO_EVALUADOR,
  campoEsRequerido,
  avisosA1,
  avisosA3,
  avisosA10,
  clasificarSegmentacion,
  esNoProgramada,
  esProgramada,
  programadaPresumida,
  objetoSegmentacionDe,
  pasoF1,
  valorEstimadoDeA1,
  variablesClaveA4Faltantes,
} from "@/lib/actuaciones-preparatorias";
import { OBJETO_MAP } from "@/lib/fase1-precarga";
import {
  oficinaEncargadaDeContrataciones,
  oficinaPresupuesto,
  oficinaSuperiorDeLaDec,
} from "./fase-preparatoria/segmentacion-form";
import type { OficinaOpcion } from "./oficina-combobox";
import { useYearQueryParam } from "@/lib/year-context";
import { useExpediente } from "./expediente-contexto";
import { Input, Select } from "./ui";
import {
  aplicabilidadHito,
  esAcuerdoMarco,
  pasosQueNoAplican,
  perfilDelExpediente,
  type Aplicabilidad,
  type ContextoExpediente,
} from "@/lib/aplicabilidad-fases";
import {
  citasDeNivel,
  citasSonDeOtroTipo,
  cuantiaDeA5,
  INTRO_CUANTIA_ACTUALIZADA,
  leerProveedores,
  pedidoDeResumen,
  sustentoCuantiaActualizada,
} from "@/lib/anexo1-interaccion";
import {
  SUSTENTO_EVALUADOR_SUGERIDO,
  esModeloRolesP,
  labelProcedimiento,
  modeloRolesP,
  modificaProcedimientoDelPac,
  procedimientoGenerico,
  sistemaEntregaDeTexto,
  sustentoAlElegirAgrupacion,
  sustentoAlElegirModalidadPago,
  sustentoAlElegirSistemaEntrega,
} from "@/lib/estrategia-formato";
import { problemasDelPaso } from "@/lib/calidad-paso";
import { progresoDeGrupos, visibilidadDePaso } from "@/lib/fase-campos-visibles";
import { camposAplicables } from "@/lib/expediente-copiloto";
import { filasTextarea } from "@/lib/textarea-alto";
import { avisoFechaRequerida } from "@/lib/cronograma-fechas";
import { faltaParaAprobar, montoA7 as coberturaA7 } from "@/lib/expediente-contenido";
import { faltaParaConsentir, faltaParaOtorgar } from "@/lib/seleccion-contenido";
import {
  type ActividadCronograma,
  construirCronogramaInicial,
  leerFilas,
  PUNTO_NO_CORRESPONDE,
} from "@/lib/estrategia-formato";
import { type Insumo, insumosDePaso } from "@/lib/herencia-fases";
import { migrarClavesHeredadas } from "@/lib/hitos-claves";
import { insumosDeInteraccion, puedeCerrarEstrategia, sustentoNormativoN } from "@/lib/interaccion-insumo";
import {
  procedimientoSugerido,
  procedimientosParaObjeto,
  regimenDe,
} from "@/lib/regimen-seleccion";
import { procedimientosElegibles, type TopesProcedimiento } from "@/lib/topes-procedimiento";
import type { DiasCronogramaPorProcedimiento } from "@/lib/cronograma-dias";
import { validarPlazoMinimo } from "@/lib/plazo-minimo";
import { cuantiaSegmentacionSinDeterminar, soles } from "@/lib/segmentacion-parametros";
import type { CampoSustento } from "@/lib/sustento-ia";
import { parseRequisitos } from "@/lib/requisitos-calificacion";
import { pasoF2 } from "@/lib/actuaciones-seleccion";
import { pasoF3 } from "@/lib/actuaciones-ejecucion";
import { tarjetasDeControl } from "@/lib/torre-control";
import { SegmentacionForm, type SegParametros } from "./fase-preparatoria/segmentacion-form";
import { TorreControl } from "./fase-preparatoria/torre-control";
import { Anexo1PreviewModal } from "./anexo1-preview-modal";
import { CertificacionPreviewModal } from "./certificacion-preview-modal";
import { ComitePreviewModal } from "./comite-preview-modal";
import { InformeAprobacionPreviewModal } from "./informe-aprobacion-preview-modal";
import { Anexo2PreviewModal } from "./anexo2-preview-modal";
import { EvaluadoresPreviewModal } from "./evaluadores-preview-modal";
import { SegmentacionPreviewModal } from "./segmentacion-preview-modal";
import { AdelantosEditor, CronogramaEditor, FactoresEditor, PuntosEditor, RolesEditor } from "./cronograma-roles-editor";
import { EvaluadoresEditor } from "./evaluadores-editor";
import {
  cantidadDefaultPorTipoEvaluador,
  etiquetaDesignacion,
  herenciaEvaluadorA4,
  prefijoDesignacion,
} from "@/lib/designacion-evaluadores";
import { SustentoIA } from "./sustento-ia";
import { useFeriados } from "./use-feriados";
import { calcularVencimiento } from "@/lib/cronograma-fechas";
import { EstrategiaPreviewModal } from "./estrategia-preview-modal";
import { ChecklistBasesPreviewModal } from "./checklist-bases-preview-modal";
import { ProveedoresConsultadosEditor } from "./proveedores-consultados-editor";
import { PostoresEditor } from "./postores-editor";
import { PuntajesEditor } from "./puntajes-editor";
import { RequisitosCalificacionEditor } from "./requisitos-calificacion-editor";
import { VARIANTES_AMBIGUAS } from "@/lib/bases-plantillas";
import { cn } from "@/lib/utils";

const STATUS_ORDER: HitoStatus[] = ["pendiente", "en_curso", "hecho", "na"];

/** Prefijo de la clave donde se recuerda si cada fase queda desplegada. */
const CLAVE_FASE_ABIERTA = "ace.fase.abierta.";

type FormatoExport = {
  path: string;
  label: string;
  word?: boolean;
  /** Clave de la vista previa de este formato, si tiene una. */
  previa?:
    | "segmentacion"
    | "estrategia"
    | "anexo1"
    | "certificacion"
    | "informe_aprobacion"
    | "anexo2"
    | "evaluadores"
    | "comite"
    | "bases_checklist";
};

// Un paso puede exportar VARIOS documentos (A6 genera tres: memorándum de
// designación, declaración jurada y consentimiento de datos personales), así que
// cada entrada es una LISTA aunque casi todos exporten un solo formato.
const EXPORT_FORMATO: Record<string, FormatoExport[]> = {
  A2: [{ path: "fase1/segmentacion-informe", label: "Informe de Segmentación", word: true, previa: "segmentacion" }],
  A4: [{ path: "fase1/export?formato=estrategia", label: "Formato de Estrategia", previa: "estrategia" }],
  A5: [{ path: "fase1/export?formato=anexo1", label: "Anexo N° 1 (Interacción)", previa: "anexo1" }],
  A6: [
    { path: "fase1/evaluadores-docx?doc=memo", label: "Memorándum de designación", word: true, previa: "evaluadores" },
    { path: "fase1/evaluadores-docx?doc=jurada", label: "Declaración jurada de no conflicto", word: true, previa: "evaluadores" },
    { path: "fase1/evaluadores-docx?doc=consentimiento", label: "Consentimiento de datos personales", word: true, previa: "evaluadores" },
  ],
  A7: [{ path: "fase1/certificacion-xlsx", label: "Solicitud de Certificación (Anexo)", previa: "certificacion" }],
  A8: [
    { path: "fase1/informe-aprobacion", label: "Informe de solicitud de aprobación", word: true, previa: "informe_aprobacion" },
    { path: "fase1/export?formato=anexo2", label: "Anexo N° 2 (Aprobación)", previa: "anexo2" },
  ],
  A9: [
    { path: "fase1/export?formato=bases_checklist", label: "Checklist de Bases", previa: "bases_checklist" },
    // Sin `previa` por ahora: es un documento largo (Sección General + Sección
    // Específica) y todavía no tiene un modal de vista previa propio — ver
    // Task 4 del plan docs/superpowers/plans/2026-09-01-a9-elaboracion-bases.md.
    // 404 (con mensaje) si el tipo de procedimiento del expediente todavía no
    // tiene plantilla de bases cargada en lib/bases-plantillas.ts.
    { path: "fase1/bases-docx", label: "Elaborar Bases (Word)", word: true },
  ],
  A10: [{ path: "fase1/anuncio-docx", label: "Anuncio de Contratación Futura", word: true }],

  // ── FASE 2 · Selección ────────────────────────────────────────────────────
  // Mismo mecanismo genérico de arriba: si el paso no está "hecho" todavía,
  // la ruta responde 409 y el usuario ve el motivo en el toast de error
  // (mismo patrón que cualquier otro export fallido, no se deshabilita el
  // botón a ciegas).
  B1: [{ path: "fase2/convocatoria-docx", label: "Aviso de Convocatoria", word: true }],
  B7: [{ path: "fase2/buena-pro-docx", label: "Acta de Otorgamiento de la Buena Pro", word: true }],
  B8: [{ path: "fase2/consentimiento-docx", label: "Declaración de Consentimiento de la Buena Pro", word: true }],
};

// Resumen "en cristiano" de cada paso de la Fase 1. El label ya es una acción
// llana ("Consultar al mercado"), pero un usuario no técnico necesita el PARA
// QUÉ y QUÉ PRODUCE el paso. Se muestra bajo el título, en la cabecera, para
// orientar sin abrir el paso ni traducir jerga normativa. Solo F1: los pasos de
// F2/F3 no lo llevan y su cabecera no cambia.
const RESUMEN_LLANO: Record<string, string> = {
  A1: "Confirmar que la compra está prevista en los planes del año (CMN y PAC).",
  A2: "Ver el monto y el riesgo para saber cuánto hay que estudiar el mercado.",
  A3: "Describir qué se necesita, para qué y en qué condiciones.",
  A4: "Decidir cómo se contrata: procedimiento, evaluación y forma de pago.",
  A5: "Preguntar a proveedores para afinar el pedido y fijar el precio referencial.",
  A6: "Nombrar a quienes evaluarán las ofertas.",
  A7: "Conseguir el respaldo presupuestal que cubra el gasto.",
  A8: "Reunir todo y aprobar el expediente antes de convocar.",
  A9: "Redactar las reglas del concurso (las bases).",
  A10: "Opcional: avisar al mercado que se convocará, para atraer más competencia.",
};

// «Qué desbloquea cerrar este paso», solo para los eslabones que arrastran al
// resto de la fase (el cuello de botella de la cuantía). Es la parte «¿qué
// sigue?» de la orientación: no basta con saber qué falta DENTRO del paso, sino
// por qué importa cerrarlo. Determinista, sin IA.
const DESBLOQUEA: Record<string, string> = {
  A2: "Al cerrarlo se fija el nivel de interacción que exige A5 y la línea de corte de la cuantía.",
  A3: "Es la base del expediente (Art. 54.2.a) y alimenta la estrategia de A4.",
  A5: "Al cerrarlo se fija la cuantía del expediente: desbloquea la certificación (A7) y la aprobación.",
  A7: "La certificación debe cubrir la cuantía; sin ella no se puede aprobar el expediente (A8).",
};


// Orden de menor a mayor exigencia; el nivel de interacción de A5 debe ser
// igual o superior al mínimo que determina la segmentación (A2).
const NIVEL_ORDEN: NivelInteraccion[] = [
  "indagacion_basica",
  "indagacion_avanzada",
  "consulta_mercado_basica",
  "consulta_mercado_avanzada",
];

// Tres artefactos, tres dueños:
//   Necesidad → propuesta original del área usuaria (Art. 44.2), congelada
//               al derivar.
//   A3        → requerimiento FINAL (Art. 54.2.a). La DEC puede modificarlo
//               (Art. 44.7), pero eso exige la no objeción del área usuaria.
//   A4        → estrategia: la DEC establece los requisitos (Art. 72.1).
const PARES_PROPUESTA: Array<{ a3: string; a4: string; nec: string; label: string }> = [
  { a3: "propuesta_requisitos_calificacion", a4: "var_f_requisitos_calificacion", nec: "requisitos_calificacion", label: "requisitos de calificación" },
  { a3: "propuesta_modalidad_pago", a4: "var_h_modalidad_pago", nec: "modalidad_pago", label: "modalidad de pago" },
  { a3: "propuesta_sistema_entrega", a4: "var_i_sistema_entrega", nec: "sistema_entrega", label: "sistema de entrega" },
];

type NivelMinimo = { nivel: NivelInteraccion; label: string; categoria: string; requisito: string };

/**
 * Texto corto de la propuesta del área usuaria para mostrarla junto al campo de
 * la estrategia. Los requisitos se guardan en el formato canónico multilínea
 * ("OBLIGATORIOS:\n- …"), que en crudo es ilegible dentro de un aviso: se
 * resumen a la lista de nombres. Los selects muestran su etiqueta, no el value.
 */
function resumenPropuesta(campo: CampoFormulario, propuesto: string): string {
  if (campo.tipo === "requisitos") {
    const { obligatorios, facultativos } = parseRequisitos(propuesto);
    const nombres = [...obligatorios, ...facultativos.map((f) => f.nombre)].filter(Boolean);
    return nombres.length > 0 ? nombres.join(" · ") : propuesto;
  }
  return campo.opciones?.find((o) => o.value === propuesto)?.label ?? propuesto;
}

/**
 * Campos de A4 que aceptan un borrador de sustento con IA, y con qué encargo.
 *
 * Deliberadamente corto: solo los textos libres donde no hay nada que deducir.
 * Ningún campo del que dependa un cálculo (la cuantía, los plazos, la cuantía
 * alta) entra aquí — esos los resuelve el código, que es verificable.
 */
const CAMPO_SUSTENTO_IA: Record<string, CampoSustento | undefined> = {
  var_s_objetivo: "objetivo",
};

/**
 * Input de importe con separador de miles.
 *
 * El input nativo type="number" NO agrupa los miles (no hay forma de que
 * muestre "1,234,567.89"), y en un importe que se firma confundir 100000 con
 * 1000000 es fácil. Así que se usa un input de texto que:
 *   - en reposo enseña el número formateado (es-PE: coma de miles, punto y dos
 *     decimales);
 *   - al enfocarlo pasa a crudo, para editar sin pelearse con las comas;
 *   - guarda SIEMPRE un número (o "" si se vacía), nunca la cadena con comas,
 *     para que la cuantía siga siendo comparable en A7/A8 y en los exportadores.
 */
// Caja de "propuesta del área usuaria" (A3→A4), migrada de las clases
// `pasoPropuesta*` a utilidades con los mismos tokens: por defecto ámbar
// (warning), adoptada verde (success) y sugerencia neutra.
const PROPUESTA =
  "mt-1 block rounded-[6px] border border-warning/30 bg-warning/[0.08] px-2 py-[5px] text-[11px] leading-[1.45] text-ink";
const PROPUESTA_SUGERIDA =
  "mt-1 flex flex-wrap items-center justify-between gap-2.5 rounded-[6px] border border-line bg-[#f8fafc] px-2 py-[5px] text-[11px] leading-[1.45] text-ink";
const PROPUESTA_OK =
  "mt-1 block rounded-[6px] border border-success/30 bg-success/[0.08] px-2 py-[5px] text-[11px] leading-[1.45] text-muted";

// Caja de "gating" (aviso/bloqueo del paso). El borde y el fondo son mezclas
// SOBRE line/surface (no opacidad sobre transparente), así que van como valores
// arbitrarios `color-mix`. La variante `warn` (nivel error) tiñe de ámbar.
const GATING =
  "mb-2.5 flex items-start gap-1.5 rounded-[8px] border border-[color-mix(in_srgb,var(--brand)_25%,var(--line))] bg-brand-soft px-2.5 py-2 text-[12px] leading-[1.45] text-ink";
const GATING_WARN =
  "mb-2.5 flex items-start gap-1.5 rounded-[8px] border border-[color-mix(in_srgb,var(--warning)_45%,var(--line))] bg-[color-mix(in_srgb,var(--warning)_12%,var(--surface))] px-2.5 py-2 text-[12px] leading-[1.45] text-ink [&>svg]:text-warning";

// Chrome de campo (label/ayuda/opcional/obligatorio). El wrapper es un grid con
// la etiqueta (`> span`) en muted; `full` lo lleva a ancho completo.
const FIELD = "grid gap-1 text-[12.5px] [&>span]:font-medium [&>span]:text-muted";
const FIELD_HELP = "text-[11px] leading-[1.4] text-muted";
const FIELD_OPT = "text-[10px] font-normal text-muted";
const FIELD_REQ = "text-[10px] font-semibold uppercase tracking-[0.3px] text-danger";

// Borde de la tarjeta de paso según su estado. Va en mapa JS y NO en variantes
// data-[status=...] porque Tailwind convierte el «_» de `en_curso` en espacio
// (`[data-status="en curso"]`) y la variante nunca casaría. Solo hecho/en_curso
// pintan; el resto hereda el `border-line` del reset de `.tw`.
const ITEM_BORDE: Record<string, string> = {
  hecho: "border-[color-mix(in_srgb,var(--success)_40%,var(--line))]",
  en_curso: "border-[color-mix(in_srgb,var(--accent)_40%,var(--line))]",
};

// Color del punto del mini-índice de F1 según el estado del hito. Mapa JS (no
// variante data-[...]) por el mismo motivo que ITEM_BORDE: `en_curso` lleva «_».
const DOT_ESTADO: Record<string, string> = {
  pendiente: "bg-line text-muted",
  en_curso: "bg-[#fef3c7] text-[#92400e]",
  hecho: "bg-[#d1fae5] text-[#065f46]",
  na: "bg-muted text-white opacity-50",
};

function InputMoneda({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: unknown;
  onChange: (v: number | "") => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");

  const num =
    typeof value === "number" ? value : value === "" || value == null ? null : Number(value);
  const valido = num != null && Number.isFinite(num);

  const mostrado = editando
    ? texto
    : valido
      ? (num as number).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "";

  return (
    <input
      disabled={disabled}
      inputMode="decimal"
      onBlur={() => setEditando(false)}
      onChange={(e) => {
        // Se aceptan dígitos, un punto decimal y comas de miles (que se descartan).
        const limpio = e.target.value.replace(/,/g, "");
        if (limpio !== "" && !/^\d*\.?\d*$/.test(limpio)) return;
        setTexto(limpio);
        onChange(limpio === "" || limpio === "." ? "" : Number(limpio));
      }}
      onFocus={() => {
        setEditando(true);
        setTexto(valido ? String(num) : "");
      }}
      placeholder={placeholder}
      type="text"
      value={mostrado}
    />
  );
}

/**
 * Quita el prefijo fijo del campo (p. ej. "Memorándum N° ", "INFORME N° ") de un
 * valor: se usa para lo que se MUESTRA en el input y para lo que se GUARDA, de
 * modo que el input siempre lleve solo lo que va tras el prefijo —aunque el dato
 * antiguo lo trajera completo o alguien lo pegue con él—.
 */
function sinPrefijo(raw: string, prefijo: string): string {
  return prefijo && raw.toLowerCase().startsWith(prefijo.toLowerCase()) ? raw.slice(prefijo.length) : raw;
}

function Campo({
  campo,
  value,
  onChange,
  disabled: disabledProp,
  propuesto,
  insumo,
  criterioCuantia,
  documentoSugerido,
  objetoContractual,
  procedimiento,
  plazoDias,
  plazoUnidad,
  calcBase,
  feriados,
  sugerenciaTexto,
  processId,
  requerido,
  noCorresponde,
  propuestaRequisitos,
  tipoEvaluador,
  cantidadIntegrantes,
  clasificacionN,
  cuantiaA5,
  diasCronogramaPorProcedimiento,
  tipoEvaluadorRol,
  procesoRol,
  riesgosNecesidad,
}: {
  campo: CampoFormulario;
  /** p) Tipo de evaluador de e) (var_e_tipo_evaluador): especializa el rol del evaluador. */
  tipoEvaluadorRol?: string;
  /** p) Proceso de a) (var_a_proceso): se cita en el rol del área usuaria del modelo. */
  procesoRol?: string;
  /** s) Matriz de riesgos de la necesidad (riesgos_necesidad): la ofrece un botón. */
  riesgosNecesidad?: string;
  /**
   * n) Verificación del tipo de interacción (Art. 46.1.n): cruza A2 y A5. De A2, la
   * categoría (fila que se marca con X, 120-126) y el nivel MÍNIMO exigido; de A5, el
   * nivel REALIZADO y si alcanza el mínimo. Solo se pasa en n); se muestra en solo lectura.
   */
  clasificacionN?: { categoria: string; nivelMinimo: string; realizado: string; cumple: boolean | null } | null;
  /** Cuantía actualizada de A5: el cronograma o) la usa para el plazo del consentimiento. */
  cuantiaA5?: number | null;
  /** Días estimados del cronograma POR PROCEDIMIENTO (Configuración); o) usa los del a). */
  diasCronogramaPorProcedimiento?: DiasCronogramaPorProcedimiento;
  /**
   * Propuesta de requisitos de calificación del área usuaria (A3), para
   * contrastarla en A4 (f). Solo se pasa en la variable f) de la estrategia.
   */
  propuestaRequisitos?: string;
  /**
   * El campo no aplica (su `noCorrespondeSalvoQue` apunta a un campo vacío): se
   * muestra "NO CORRESPONDE." en solo lectura en vez de una caja editable. Lo
   * calcula el paso, que es quien tiene los valores de los demás campos.
   */
  noCorresponde?: boolean;
  /**
   * ¿Es obligatorio AHORA? Lo calcula el paso, que es quien tiene sus datos:
   * el obligatorio puede ser condicional (`requeridoSi`) y depender del valor
   * de otro campo.
   */
  requerido: boolean;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled: boolean;
  // Expediente al que pertenece el campo: los borradores de sustento con IA se
  // redactan con los datos ya registrados en él.
  processId?: string;
  // Tipo de evaluador (A6): el editor de integrantes trae a los usuarios del rol
  // que le corresponde (oficial de compra, comité, jurado).
  tipoEvaluador?: string;
  // Número de integrantes (A6): el editor crea esa cantidad de filas de titulares.
  cantidadIntegrantes?: string;
  // Valor propuesto por el área usuaria en el requerimiento (A3, Art. 44.2).
  propuesto?: string;
  // Hallazgo de la interacción con el mercado (A5) que sustenta esta variable.
  // A diferencia de `propuesto`, no es un valor que se adopte tal cual: es
  // información que la DEC debe ANALIZAR (Art. 46.1), así que se inserta en el
  // texto para que la redacte, no para que la sustituya.
  insumo?: string;
  // Criterio elegido en A5 para derivar la cuantía de las propuestas.
  criterioCuantia?: string;
  // Documento con el que se consultó, sugerido desde el Resumen de la Necesidad.
  documentoSugerido?: string;
  // Objeto contractual (de A3), para adaptar la ayuda de los requisitos (Art. 72.3.b).
  objetoContractual?: string;
  // Procedimiento elegido en a) (var_a_procedimiento): el cronograma o) lista
  // las actividades propias de ese procedimiento (Art. 46.1.o).
  procedimiento?: string;
  // Plazo de ejecución del requerimiento (A3): se anota junto a la "Ejecución
  // contractual" del cronograma o) al sembrarlo (es una duración, no una fecha).
  plazoDias?: number | null;
  plazoUnidad?: string | null;
  // Fecha base para un campo de fecha con `calcularDesde` (tomada de otro hito).
  calcBase?: string;
  // Feriados registrados: para calcular vencimientos en días hábiles.
  feriados?: ReadonlySet<string>;
  // Texto sugerido para un textarea (p. ej. el sustento del tipo de evaluador,
  // que depende del tipo marcado). Se ofrece con un botón; nunca se rellena solo.
  sugerenciaTexto?: { etiqueta: string; texto: string };
}) {
  // Un campo `soloLectura` (p. ej. a) Tipo de procedimiento, que hereda de la
  // ficha) se muestra pero no se edita, con independencia del permiso de gestión.
  const disabled = disabledProp || Boolean(campo.soloLectura);
  const full = campo.ancho === "full";
  // Fija el campo a la columna 1 o 2 del grid (dos columnas); en móvil no aplica.
  const colClase = campo.columna === 1 ? "col-start-1" : campo.columna === 2 ? "col-start-2" : "";
  const campoSustentoIA = CAMPO_SUSTENTO_IA[campo.name];

  // La estrategia (A4) es la DECISIÓN de la DEC, así que llega vacía: lo que el
  // área usuaria propuso en el requerimiento (A3) se ofrece al lado como
  // sugerencia. Tres estados, y en ninguno se repite el texto:
  //   vacío     → la propuesta + botón para adoptarla
  //   adoptada  → "coincide", sin volver a imprimir el texto
  //   distinta  → el Art. 44.7 exige la no objeción del área usuaria
  const actual = typeof value === "string" ? value.trim() : "";
  const avisoPropuesta = !propuesto ? null : actual === "" ? (
    <div className={PROPUESTA_SUGERIDA}>
      <span>
        El área usuaria propuso: <strong>{resumenPropuesta(campo, propuesto)}</strong>
      </span>
      {!disabled ? (
        <button
          className="secondaryButton compactButton"
          onClick={() => onChange(propuesto)}
          type="button"
        >
          Usar esta propuesta
        </button>
      ) : null}
    </div>
  ) : actual === propuesto ? (
    <small className={PROPUESTA_OK}>
      Coincide con lo propuesto por el área usuaria (A3). No requiere no objeción.
    </small>
  ) : (
    <small className={PROPUESTA}>
      El área usuaria propuso: <strong>{resumenPropuesta(campo, propuesto)}</strong>. Modificarlo
      requiere su no objeción (Art. 44.7).
    </small>
  );
  // Insumo de la interacción (A5). No se "adopta" como la propuesta de A3: el
  // Art. 46.1 pide que la DEC ANALICE la información, así que se añade al final
  // del texto y queda editable. Si ya está incorporado, no se vuelve a ofrecer.
  const yaIncorporado = insumo != null && actual.includes(insumo);
  const avisoInsumo = !insumo ? null : (
    <div className={yaIncorporado ? PROPUESTA_OK : PROPUESTA_SUGERIDA}>
      <span>
        {yaIncorporado ? (
          "Incorpora el hallazgo de la interacción con el mercado (A5)."
        ) : (
          <>
            Interacción con el mercado (A5): <strong>{insumo}</strong>
          </>
        )}
      </span>
      {!disabled && !yaIncorporado ? (
        <button
          className="secondaryButton compactButton"
          onClick={() => onChange(actual ? `${actual}\n\n${insumo}` : insumo)}
          type="button"
        >
          Añadir al análisis
        </button>
      ) : null}
    </div>
  );
  // n) Verificación del tipo de interacción (Art. 46.1.n): NO es un dato de A4, es
  // una VERIFICACIÓN que cruza A2 (segmentación → categoría marcada con X y nivel
  // mínimo) y A5 (nivel realizado). Se muestra en solo lectura SOLO la fila marcada
  // —no las seis opciones— y si lo ejecutado en A5 alcanza el mínimo de A2.
  const avisoClasificacionN =
    campo.name === "var_n_tipo_interaccion" && clasificacionN ? (
      <div className={PROPUESTA_OK}>
        <span>Verificación (Art. 46.1.n) — de la segmentación (A2) y la interacción realizada (A5):</span>
        <span style={{ display: "block", marginTop: 4 }}>
          <span
            aria-hidden
            style={{ border: "1px solid var(--nav-line, #ccc)", borderRadius: 3, padding: "0 6px", fontWeight: 600 }}
          >
            X
          </span>{" "}
          <strong>{clasificacionN.categoria}</strong> · Nivel mínimo (A2):{" "}
          <strong>{clasificacionN.nivelMinimo}</strong>
        </span>
        <span style={{ display: "block", marginTop: 2 }}>
          Nivel realizado (A5): <strong>{clasificacionN.realizado || "— sin registrar en A5 —"}</strong>
          {clasificacionN.cumple === true
            ? " (alcanza el mínimo)."
            : clasificacionN.cumple === false
              ? " (no alcanza el mínimo exigido)."
              : "."}
        </span>
      </div>
    ) : null;
  // s) La necesidad ya trajo su gestión de riesgos (Art. 44.3): s) arranca en "NO
  // CORRESPONDE" y aquí se OFRECE traer esa matriz con un botón (segunda opción). Si
  // el campo solo tiene "NO CORRESPONDE" o está vacío, la sustituye; si la DEC ya
  // escribió algo, la añade. No se ofrece si ya está incorporada.
  const riesgosNec = (riesgosNecesidad ?? "").trim();
  const yaTraeRiesgos = riesgosNec !== "" && actual.includes(riesgosNec);
  const avisoRiesgos =
    campo.name === "var_s_objetivo" && riesgosNec ? (
      <div className={yaTraeRiesgos ? PROPUESTA_OK : PROPUESTA_SUGERIDA}>
        <span>
          {yaTraeRiesgos
            ? "La matriz de riesgos de la necesidad ya está incorporada."
            : "La necesidad trae una gestión de riesgos identificada (Art. 44.3)."}
        </span>
        {!disabled && !yaTraeRiesgos ? (
          <button
            className="secondaryButton compactButton"
            onClick={() => onChange(actual && actual !== "NO CORRESPONDE" ? `${actual}\n\n${riesgosNec}` : riesgosNec)}
            type="button"
          >
            Traer la matriz de riesgos de la necesidad
          </button>
        ) : null}
      </div>
    ) : null;
  // Sustento sugerido (p. ej. el del tipo de evaluador). Se OFRECE, no se
  // impone: reemplaza el texto solo al pulsar el botón, para no pisar lo que
  // la DEC ya redactó sin avisar.
  const sugTexto = sugerenciaTexto?.texto ?? "";
  const avisoSugerencia = !sugTexto ? null : actual === sugTexto ? (
    <small className={PROPUESTA_OK}>
      Usa el sustento sugerido para <strong>{sugerenciaTexto!.etiqueta}</strong>.
    </small>
  ) : (
    <div className={PROPUESTA_SUGERIDA}>
      <span>
        Hay un sustento sugerido para <strong>{sugerenciaTexto!.etiqueta}</strong>
        {actual ? " (reemplazará lo escrito)" : ""}.
      </span>
      {!disabled ? (
        <button
          className="secondaryButton compactButton"
          onClick={() => onChange(sugTexto)}
          type="button"
        >
          {actual ? "Reemplazar por el sugerido" : "Usar el sustento sugerido"}
        </button>
      ) : null}
    </div>
  );

  // Fecha calculada desde otro campo (p. ej. consentimiento = otorgamiento +
  // plazo). Se OFRECE con un botón; nunca se rellena sola.
  const cd = campo.calcularDesde;
  // El plazo puede depender del procedimiento elegido en A4 (p. ej. el
  // consentimiento: 8+1 días hábiles en los competitivos, 5+1 en los abreviados).
  const diasCalc = (procedimiento ? cd?.diasPorProcedimiento?.[procedimiento] : undefined) ?? cd?.dias ?? 0;
  const fechaCalculada = cd ? calcularVencimiento(calcBase, diasCalc, { habiles: cd.habiles, feriados }) : "";
  const avisoCalculo = !cd ? null : !calcBase ? (
    <small className={FIELD_HELP}>
      Para calcular esta fecha, registra primero la fecha base en el paso <strong>{cd.hito}</strong>.
    </small>
  ) : fechaCalculada && fechaCalculada === actual ? (
    <small className={PROPUESTA_OK}>
      Coincide con el cálculo ({cd.etiqueta.toLowerCase()}).
    </small>
  ) : fechaCalculada ? (
    <div className={PROPUESTA_SUGERIDA}>
      <span>
        {cd.etiqueta}: <strong>{fechaCalculada}</strong>
        {actual ? " (reemplazará la fecha actual)" : ""}.
      </span>
      {!disabled ? (
        <button className="secondaryButton compactButton" onClick={() => onChange(fechaCalculada)} type="button">
          {actual ? "Reemplazar" : "Usar esta fecha"}
        </button>
      ) : null}
    </div>
  ) : null;

  const labelContent = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      {campo.label}
      {requerido ? (
        <span className={FIELD_REQ} title="Campo obligatorio">obligatorio</span>
      ) : campo.recomendado ? (
        <span className={FIELD_OPT} title="La norma lo exige “de corresponder”: no bloquea, pero no es relleno.">
          de corresponder
        </span>
      ) : (
        <span className={FIELD_OPT}>opcional</span>
      )}
      {campo.baseLegal ? (
        <span className="inline-flex cursor-help text-brand opacity-70" title={campo.baseLegal}>
          <Info size={11} />
        </span>
      ) : null}
    </span>
  );

  // La ayuda y el enlace oficial del campo van juntos bajo el control: el
  // enlace es la versión verificable del dato (p. ej. las bases estándar).
  const ayudaConEnlace = (
    <>
      {campo.ayuda ? <small className={FIELD_HELP}>{campo.ayuda}</small> : null}
      {campo.enlace ? (
        <a
          className={cn(FIELD_HELP, "mt-[3px] inline-block text-[#2563eb] underline underline-offset-2")}
          href={campo.enlace.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          {campo.enlace.texto} ↗
        </a>
      ) : null}
    </>
  );

  // El campo no aplica (p. ej. el documento del no competitivo sin causal del
  // Art. 55): se muestra "NO CORRESPONDE." en solo lectura, no una caja vacía que
  // invite a rellenar lo que no procede. El dato guardado sigue vacío.
  if (noCorresponde) {
    return (
      <label className={cn(FIELD, full && "col-span-full")}>
        {labelContent}
        <input disabled readOnly value="NO CORRESPONDE." />
        {ayudaConEnlace}
      </label>
    );
  }

  if (campo.tipo === "boolean") {
    return (
      <label className={cn("grid grid-cols-[auto_1fr] items-start gap-2 py-1.5 text-[12.5px] [&_input]:mt-0.5", full && "col-span-full", colClase)}>
        <input
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          type="checkbox"
        />
        {labelContent}
      </label>
    );
  }
  // Tablas del Formato de Estrategia: no van dentro de <label> (varios inputs).
  if (campo.tipo === "cronograma") {
    return (
      <div className={cn(FIELD, full && "col-span-full")}>
        {labelContent}
        <CronogramaEditor
          cuantia={cuantiaA5}
          diasPorProcedimiento={diasCronogramaPorProcedimiento}
          onChange={(next) => onChange(next)}
          plazoDias={plazoDias}
          plazoUnidad={plazoUnidad}
          procedimiento={procedimiento}
          procedimientoLabel={procedimiento ? (labelProcedimiento(procedimiento) ?? undefined) : undefined}
          readOnly={disabled}
          value={value}
        />
        {ayudaConEnlace}
      </div>
    );
  }

  if (campo.tipo === "factores") {
    return (
      <div className={cn(FIELD, full && "col-span-full")}>
        {labelContent}
        <FactoresEditor
          onChange={(next) => onChange(next)}
          procedimiento={procedimiento}
          readOnly={disabled}
          value={value}
        />
        {ayudaConEnlace}
      </div>
    );
  }

  if (campo.tipo === "roles") {
    return (
      <div className={cn(FIELD, full && "col-span-full")}>
        {labelContent}
        <RolesEditor
          objeto={objetoContractual}
          onChange={(next) => onChange(next)}
          proceso={procesoRol}
          readOnly={disabled}
          tipoEvaluador={tipoEvaluadorRol}
          value={value}
        />
        {ayudaConEnlace}
      </div>
    );
  }

  if (campo.tipo === "puntos") {
    return (
      <div className={cn(FIELD, full && "col-span-full")}>
        {labelContent}
        <PuntosEditor
          onChange={(next) => onChange(next)}
          processId={processId}
          readOnly={disabled}
          value={value}
        />
        {ayudaConEnlace}
      </div>
    );
  }

  if (campo.tipo === "adelantos") {
    return (
      <div className={cn(FIELD, full && "col-span-full")}>
        {labelContent}
        <AdelantosEditor
          esObras={objetoContractual === "obra" || objetoContractual === "consultoria_obra"}
          onChange={(next) => onChange(next)}
          readOnly={disabled}
          value={value}
        />
        {ayudaConEnlace}
      </div>
    );
  }

  if (campo.tipo === "evaluadores") {
    return (
      <div className={cn(FIELD, full && "col-span-full")}>
        {labelContent}
        <EvaluadoresEditor
          cantidad={cantidadIntegrantes}
          onChange={(next) => onChange(next)}
          proponente={campo.name === "integrantes_area_usuaria" ? "area_usuaria" : "dec"}
          readOnly={disabled}
          tipoEvaluador={tipoEvaluador}
          value={value}
        />
        {ayudaConEnlace}
      </div>
    );
  }

  // Tabla de proveedores: tampoco va dentro de <label> (varios inputs).
  if (campo.tipo === "proveedores") {
    return (
      <div className={cn(FIELD, full && "col-span-full")}>
        {labelContent}
        <ProveedoresConsultadosEditor
          criterio={criterioCuantia ?? ""}
          documentoSugerido={documentoSugerido}
          onChange={(next) => onChange(next)}
          readOnly={disabled}
          value={value}
        />
        {ayudaConEnlace}
      </div>
    );
  }

  // Tabla de postores del registro de participantes (B2, Arts. 67-70).
  if (campo.tipo === "postores") {
    return (
      <div className={cn(FIELD, full && "col-span-full")}>
        {labelContent}
        <PostoresEditor onChange={(next) => onChange(next)} readOnly={disabled} value={value} />
        {ayudaConEnlace}
      </div>
    );
  }

  // Tabla del orden de prelación de la evaluación (B6, Arts. 78-82).
  if (campo.tipo === "puntajes") {
    return (
      <div className={cn(FIELD, full && "col-span-full")}>
        {labelContent}
        <PuntajesEditor onChange={(next) => onChange(next)} readOnly={disabled} value={value} />
        {ayudaConEnlace}
      </div>
    );
  }

  // Editor estructurado: no va dentro de <label> (contiene varios inputs).
  if (campo.tipo === "requisitos") {
    return (
      <div className={cn(FIELD, full && "col-span-full")}>
        {labelContent}
        {/* A3 b) es el ESPEJO de la propuesta del área usuaria (derivada de la
            necesidad), para contrastarla con la decisión de la DEC (A4). La
            captura vive en la ficha de la necesidad y la decisión en A4 (Art.
            72.1): por eso aquí es solo lectura, para que el mismo dato no tenga
            tres editores que se contradigan. */}
        <RequisitosCalificacionEditor
          modo={campo.name === "var_f_requisitos_calificacion" ? "decision" : "propuesta"}
          objeto={objetoContractual}
          onChange={(next) => onChange(next)}
          propuesta={propuestaRequisitos}
          readOnly={disabled || campo.name === "propuesta_requisitos_calificacion"}
          tipoProceso={procedimiento}
          value={(value as string) ?? ""}
        />
        {campo.name === "propuesta_requisitos_calificacion" ? (
          <small className={FIELD_HELP}>
            Solo lectura: es la propuesta del área usuaria (se edita en la ficha de la necesidad). La DEC decide los
            definitivos en la Estrategia (A4 · f), Art. 72.1.
          </small>
        ) : null}
        {avisoPropuesta}
        {avisoInsumo}
        {ayudaConEnlace}
      </div>
    );
  }

  return (
    // Un select es de una línea; cuando comparte fila con un campo más alto (su
    // sustento, en h)/i)), se ancla ARRIBA en vez de estirarse o centrarse.
    <label
      className={cn(FIELD, full && "col-span-full", colClase, campo.tipo === "select" && "self-start")}
    >
      {labelContent}
      {avisoClasificacionN}
      {campo.tipo === "textarea" ? (
        <textarea
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={campo.placeholder}
          // Crece con el contenido. En una caja a TODO EL ANCHO (`full`) cada línea
          // envuelve al doble de caracteres, así que se le pasa el perfil «wide»: si
          // no, cuenta las filas como si midiera la mitad, las sobreestima y la caja
          // sale demasiado alta con un hueco vacío bajo el texto (se veía en el
          // sustento del perfil del evaluador, Art. 46.1.e). Mismo helper y mismo
          // criterio que los editores estructurados, que ya pasan `true`.
          rows={filasTextarea((value as string) ?? "", full)}
          value={(value as string) ?? ""}
        />
      ) : campo.tipo === "select" ? (
        <select disabled={disabled} onChange={(e) => onChange(e.target.value)} value={(value as string) ?? ""}>
          <option value="">— Seleccionar —</option>
          {(campo.opciones ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : campo.moneda ? (
        <InputMoneda disabled={disabled} onChange={onChange} placeholder={campo.placeholder} value={value} />
      ) : campo.prefijo ? (
        // El prefijo ("Memorándum N° ") es una etiqueta fija dentro del campo; el
        // input guarda SOLO el número. Si pegan el prefijo, se retira para que los
        // documentos —que ya lo anteponen— no lo dupliquen.
        // Control combinado: la CAJA lleva el borde y el prefijo fijo; el input
        // interno va sin borde y transparente para que se vea como uno solo. El
        // input necesita `!` en bg/radio porque la regla global `input` de
        // styles.css (sin capa) fija #fff y radio 10 y ganaría a las utilidades.
        <div className="flex items-center gap-0.5 rounded-[8px] border border-line bg-panel px-[9px]">
          <span className="whitespace-nowrap text-[13px] text-muted" aria-hidden>
            {campo.prefijo}
          </span>
          <input
            className="min-w-0 flex-1 !rounded-none !bg-transparent px-0 py-[7px] focus:outline-none"
            disabled={disabled}
            onChange={(e) => onChange(sinPrefijo(e.target.value, campo.prefijo ?? ""))}
            placeholder={campo.placeholder}
            type="text"
            value={sinPrefijo((value as string) ?? "", campo.prefijo ?? "")}
          />
        </div>
      ) : (
        <input
          disabled={disabled}
          inputMode={campo.tipo === "number" ? "decimal" : undefined}
          onChange={(e) => onChange(campo.tipo === "number" ? (e.target.value === "" ? "" : e.target.valueAsNumber) : e.target.value)}
          placeholder={campo.placeholder}
          type={campo.tipo === "date" ? "date" : campo.tipo === "number" ? "number" : "text"}
          value={(value as string) ?? ""}
        />
      )}
      {avisoPropuesta}
      {avisoInsumo}
      {avisoRiesgos}
      {avisoSugerencia}
      {avisoCalculo}
      {/* Los sustentos del Art. 46.1 son los únicos campos que no se deducen de
          nada, y son justo donde se acaba escribiendo cualquier cosa con tal de
          pasar de pantalla. La IA ofrece el primer borrador; la persona decide. */}
      {campoSustentoIA && processId ? (
        <SustentoIA
          actual={actual}
          campo={campoSustentoIA}
          disabled={disabled}
          onUsar={(texto) => onChange(texto)}
          processId={processId}
        />
      ) : null}
      {ayudaConEnlace}
    </label>
  );
}

/** Etiqueta legible del tipo de evaluador ("Oficial de compra", "Comité"…). */
function labelTipoEvaluador(tipo: string): string {
  return OPCIONES_TIPO_EVALUADOR.find((o) => o.value === tipo)?.label ?? tipo;
}

/**
 * Sustento sugerido para la variable e) según el tipo de evaluador marcado.
 * Devuelve undefined si no hay tipo elegido o aún no hay borrador para ese tipo
 * (así el botón no aparece). El texto lo redacta y adopta la DEC.
 */
function sustentoEvaluadorSugerido(tipoEvaluador: unknown): { etiqueta: string; texto: string } | undefined {
  const tipo = typeof tipoEvaluador === "string" ? tipoEvaluador : "";
  const texto = SUSTENTO_EVALUADOR_SUGERIDO[tipo];
  if (!texto) return undefined;
  const etiqueta = OPCIONES_TIPO_EVALUADOR.find((o) => o.value === tipo)?.label ?? tipo;
  return { etiqueta, texto };
}

/**
 * Sustento legal sugerido para A5 según el NIVEL elegido: el Art. 48 sustenta la
 * indagación y los Arts. 49-50 la consulta al mercado.
 *
 * Va como sugerencia y no solo como semilla porque el nivel se elige DESPUÉS de
 * abrir el paso: sembrar solo al cargar dejaba el campo vacío para siempre en un
 * A5 nuevo, y con el artículo de la indagación si luego se pasaba a consulta.
 */
function citasSugeridas(nivel: unknown): { etiqueta: string; texto: string } | undefined {
  const n = typeof nivel === "string" ? nivel : "";
  const texto = citasDeNivel(n);
  if (!texto) return undefined;
  return { etiqueta: NIVEL_INTERACCION_META[n as NivelInteraccion]?.label ?? n, texto };
}

/**
 * Precarga el sustento legal de la interacción con el mercado en A5.
 *
 * Es texto de norma: no cambia entre expedientes, así que no tiene sentido
 * pedir que se teclee. Va como campo editable —no como constante del
 * exportador— porque la DEC puede querer ajustarlo antes de exportar.
 *
 * Solo se siembra si el paso aún no tiene el campo: una cadena vacía guardada a
 * propósito es una decisión del usuario y no se pisa.
 */
function conCitas(
  code: string,
  data: Record<string, unknown> | null | undefined,
  a2Data: Record<string, unknown> | undefined,
  a5Data: Record<string, unknown> | undefined,
  a4Data?: Record<string, unknown> | undefined,
): Record<string, unknown> {
  // Antes de nada, rescata lo que quedó atrapado en claves renombradas: el jsonb
  // conserva la clave vieja para siempre y el formulario dejaría de verla. Al
  // guardar el paso, el expediente queda migrado.
  const base = migrarClavesHeredadas(code, data);

  // A6 hereda de A4 el tipo de evaluador (Art. 46.1.e → Art. 54.2.e): es el
  // mismo hecho en dos pasos, así que A6 no lo vuelve a preguntar, lo confirma.
  // El número de integrantes lo determina el tipo (Art. 56.1 Reglamento): solo se
  // siembra cuando es único (oficial de compra → 1, comité → 3 integrantes); el
  // jurado (3 o 5 expertos) se elige. Solo se siembra lo que aún no existe: no se
  // pisa lo ya decidido.
  if (code === "A6") {
    const herencia = herenciaEvaluadorA4(a4Data);
    if (!herencia) return base;
    const next = { ...base };
    if (!("tipo_evaluador" in base)) next.tipo_evaluador = herencia.tipo;
    if (!("cantidad_integrantes" in base) && herencia.cantidadFija != null) {
      next.cantidad_integrantes = String(herencia.cantidadFija);
    }
    return next;
  }
  // A8: el documento de aprobación es siempre el Anexo N° 2 (formato oficial),
  // así que su número arranca con ese valor. Editable; solo se siembra si el
  // campo aún no existe.
  if (code === "A8") {
    if ("numero_documento" in base) return base;
    return { ...base, numero_documento: "ANEXO N° 02" };
  }
  // A7: la solicitud de certificación se fecha HOY por defecto y queda editable.
  // Solo se siembra si aún no existe, para no pisar una fecha ya elegida.
  if (code === "A7") {
    if ("fecha_solicitud" in base) return base;
    return { ...base, fecha_solicitud: hoyISO() };
  }
  // La fecha de elaboración arranca hoy y queda editable: es la del día en el
  // 99% de los casos, pero un formato puede firmarse con fecha anterior.
  if (code === "A4") {
    const next = { ...base };
    if (!("fecha_elaboracion" in base)) next.fecha_elaboracion = hoyISO();
    // n) arranca con el sustento normativo que justifica la variable (Art. 46.1.n)
    // y resume la categorización (A2) y el nivel de interacción (A5) con sus
    // artículos, cerrando con el nivel realizado. Solo se siembra si aún no
    // existe: si la DEC lo vació a propósito, no se vuelve a poner. El insumo de
    // A5 (fuentes/herramientas) se añade aparte con "Añadir al análisis".
    const sustN = sustentoNormativoN(a2Data, a5Data);
    // Si el nivel realizado (A5) NO supera el mínimo de la segmentación (A2), B129
    // no corresponde (numeral 127.2): `sustentoNormativoN` devuelve «NO CORRESPONDE»
    // y aquí se FUERZA, aunque ya hubiera un sustento sembrado antes —su contenido es
    // irrelevante, el export lo ignora igual—, para que el campo del frontend coincida
    // con lo que se exportará. Si SÍ se subió de nivel, se siembra el sustento solo si
    // el campo aún no existe (si la DEC lo vació a propósito, no se vuelve a poner).
    if (sustN === "NO CORRESPONDE") next.var_n_tipo_interaccion = "NO CORRESPONDE";
    else if (!("var_n_tipo_interaccion" in base)) next.var_n_tipo_interaccion = sustN;
    return next;
  }
  if (code !== "A5") return base;
  const next = { ...base };
  // El nivel de interacción REALIZADO arranca en el MÍNIMO que exige la
  // segmentación (A2, Art. 127.1 para bienes/servicios · Art. 153.1 para
  // obras/consultorías de obra): la DEC parte del piso legal en vez de un
  // desplegable vacío, y puede subirlo si lo cree pertinente (Art. 127.2). Solo
  // se siembra si el campo aún no existe: si la DEC ya eligió un nivel —igual,
  // mayor o incluso insuficiente, que el aviso de abajo señala—, se respeta.
  if (!("nivel" in base) && a2Data) {
    const seg = clasificarSegmentacion({
      objeto: a2Data.objeto === "obras_consultoria_obras" ? "obras_consultoria_obras" : "bienes_servicios",
      cuantiaAlta: Boolean(a2Data.cuantiaAlta),
      condicionesRiesgo: Array.isArray(a2Data.condicionesRiesgo) ? (a2Data.condicionesRiesgo as string[]) : [],
      criteriosBasica: Array.isArray(a2Data.criteriosBasica) ? (a2Data.criteriosBasica as string[]) : [],
      centralizada: Boolean(a2Data.centralizada),
      esIoarr: Boolean(a2Data.esIoarr),
    });
    next.nivel = seg.nivel;
  }
  // Solo se siembra lo que AÚN NO EXISTE: una cadena vacía guardada a
  // propósito es una decisión del usuario y no se pisa.
  //
  // La cita SIGUE al nivel elegido: el Art. 48 es de la indagación y los
  // Arts. 49-50 de la consulta al mercado. Antes se sembraba siempre el 48, así
  // que una consulta salía sustentada con el artículo de la indagación. Se lee
  // de `next.nivel` (no `base.nivel`) para que, si el nivel se acaba de sembrar
  // arriba, la cita salga junto con él en la misma pasada.
  if (!("sustento_citas" in base)) {
    const citas = citasDeNivel(String(next.nivel ?? ""));
    if (citas) next.sustento_citas = citas;
  }
  // La fecha de elaboración arranca hoy y queda editable: es la fecha del día
  // en el 99% de los casos, pero un Anexo puede firmarse con fecha anterior.
  if (!("fecha_elaboracion" in base)) next.fecha_elaboracion = hoyISO();
  // La cuantía por defecto es la menor propuesta (valor por dinero, Art. 27).
  if (!("criterio_cuantia" in base)) next.criterio_cuantia = "menor";
  return next;
}

/** Hoy en formato ISO, que es lo que espera <input type="date">. */
function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function PasoCard({
  code,
  label,
  responsable,
  estado,
  canManage,
  expanded,
  onToggle,
  onSave,
  saving,
  processId,
  objetoContractual,
  procesoNecesidad,
  procedureType,
  nivelMinimo,
  areaUsuariaSugerida,
  responsableSugerido,
  autoridadSugerida,
  numeroInformeSugerido,
  atencionSugerida,
  remitenteSugerido,
  oficinasCatalogo,
  segParametros,
  propuestas,
  categoriaSegmentacion,
  divergencias,
  documentoSugerido,
  insumosA5,
  insumosF1,
  aplicabilidad,
  regimenA4,
  estandarizadoA3,
  hitosA1,
  hitosA2,
  hitosA5,
  hitosTodos,
  feriados,
  valorEstimado,
  pacBienesServicios,
  montoNecesidad,
  fechaRequerida,
  fechaRemisionDec,
  onAbrirPaso,
  statusA5,
  showToast,
}: {
  code: string;
  label: string;
  responsable: string;
  estado: HitoEstado | undefined;
  canManage: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSave: (status: HitoStatus, data: Record<string, unknown>) => Promise<void>;
  saving: boolean;
  processId: string;
  objetoContractual?: string;
  // Tipo de proceso que anticipó el área usuaria (nec.tipo_proceso_seleccion),
  // para proponer el procedimiento competitivo de A4 a).
  procesoNecesidad?: string;
  // El procedimiento REAL del expediente (procurement_processes.procedure_type).
  // A9 lo usa para saber si el tipo de bases a elaborar es ambiguo (ver
  // VARIANTES_AMBIGUAS en lib/bases-plantillas.ts) y mostrar el selector.
  procedureType?: string | null;
  nivelMinimo?: NivelMinimo | null;
  areaUsuariaSugerida?: string;
  responsableSugerido?: string;
  // Oficina que aprueba el expediente (A8): la Gerencia Municipal, de Config › Áreas.
  autoridadSugerida?: string;
  /** A8: correlativo propuesto para el informe (Configuración → Numeración). */
  numeroInformeSugerido?: string;
  /** A8: gerencia de la entidad (Configuración → Municipalidad). */
  atencionSugerida?: string;
  /** A8: jefatura que suscribe, de la oficina que gestiona contrataciones. */
  remitenteSugerido?: string;
  /** A8: catálogo de oficinas para los selects de AL y DE del informe. */
  oficinasCatalogo?: OficinaOpcion[];
  segParametros?: SegParametros;
  propuestas?: Record<string, string>;
  categoriaSegmentacion?: CategoriaSegmentacion | null;
  divergencias?: string[];
  // Documento de origen del requerimiento, del Resumen de la Necesidad.
  documentoSugerido?: string;
  // Si este paso corresponde al objeto y al procedimiento del expediente, y con
  // qué salvedad (Art. 62.1: las etapas dependen "de su tipo, objeto y modalidad").
  aplicabilidad?: Aplicabilidad;
  // Régimen deducido de la causal del Art. 55 registrada en A1.
  regimenA4?: string;
  // ¿El requerimiento está estandarizado con ficha técnica? (A3 → Art. 96.1)
  estandarizadoA3?: boolean;
  // Datos de A1 (Programación): A4 deduce de ellos su variable a).
  hitosA1?: Record<string, unknown>;
  hitosA2?: Record<string, unknown>;
  hitosA5?: Record<string, unknown>;
  // Mapa completo de hitos: para resolver la fecha base de los campos con
  // `calcularDesde` (que referencian otro paso, p. ej. B8 lee la fecha de B7).
  hitosTodos?: HitosMap;
  // Feriados registrados (Configuración): para calcular vencimientos hábiles.
  feriados?: ReadonlySet<string>;
  // Valor estimado del expediente: lo fija A5 con el mercado (Art. 47.1) y A7
  // comprueba su certificación contra él.
  valorEstimado?: number | null;
  // PAC de bienes/servicios (dato anual de Configuración): base del 10% que
  // decide si la cuantía real reclasifica la segmentación de A2 (checklist A8).
  pacBienesServicios?: number | null;
  // Lo que el área usuaria estimó en la necesidad, para contrastarlo en A5.
  montoNecesidad?: number | null;
  // Fecha para la que el área usuaria pidió la contratación: A4 comprueba que el
  // cronograma llegue a tiempo.
  fechaRequerida?: string | null;
  // Fecha en que la necesidad se remitió a la DEC, para contrastar con A3.
  fechaRemisionDec?: string | null;
  // Abre OTRO paso de la fase. A8 lo necesita: recoge el producto de A1, A3,
  // A4, A5, A6 y A7 (Art. 54.2), así que lo que le falta se arregla en ellos.
  onAbrirPaso?: (code: string) => void;
  // Resultados de la interacción con el mercado (A5) que sustentan las
  // variables k, n y s de la estrategia (Art. 46.1 · 47.1).
  insumosA5?: Record<string, string>;
  // Lo que la Fase 1 (estrategia A4) aporta a este paso de F2/F3.
  insumosF1?: Insumo[];
  statusA5?: HitoStatus;
  showToast: (text: string, kind?: "success" | "error" | "info") => void;
}) {
  const detalle = pasoF1(code) ?? pasoF2(code) ?? pasoF3(code);
  const status = estado?.status ?? "pendiente";
  // Año fiscal en la URL de descarga: A7/A8 consumen el correlativo del contador de
  // ESE año (el mismo que la sugerencia), no del año calendario del servidor.
  const yearParam = useYearQueryParam();
  const [draftStatus, setDraftStatus] = useState<HitoStatus>(status);
  const [draftData, setDraftData] = useState<Record<string, unknown>>(() =>
    conCitas(code, estado?.data, hitosA2, hitosA5, hitosTodos?.A4?.data ?? undefined),
  );
  // A6: nº de designación (memorándum del oficial de compra / informe del comité o
  // jurado) propuesto desde Numeración. Se carga en este componente porque depende
  // de `tipo_evaluador`, que es dinámico aquí (A7/A8 vienen del padre).
  const [numeroDesignacionSugerido, setNumeroDesignacionSugerido] = useState("");

  useEffect(() => {
    setDraftStatus(estado?.status ?? "pendiente");
    setDraftData(conCitas(code, estado?.data, hitosA2, hitosA5, hitosTodos?.A4?.data ?? undefined));
    // hitosA2/hitosA5 alimentan el sustento normativo de n) (categorización +
    // nivel); conCitas solo siembra si el campo aún no existe, así que no pisa
    // lo escrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, estado?.status, estado?.data]);

  // A8: la autoridad que aprueba es la Gerencia Municipal. Se siembra cuando el
  // catálogo de oficinas ya cargó (llega async, después de conCitas) y el campo
  // aún está vacío. Solo rellena; nunca pisa lo que la DEC haya escrito.
  useEffect(() => {
    if (code !== "A8" || !autoridadSugerida) return;
    setDraftData((prev) => (String(prev.autoridad ?? "").trim() ? prev : { ...prev, autoridad: autoridadSugerida }));
  }, [code, autoridadSugerida]);

  /**
   * A8: cabecera del informe de solicitud de aprobación.
   *
   * Mismo criterio que el resto de sugerencias del panel: SOLO rellena huecos.
   * Nunca pisa lo que ya se escribió, porque el nombre correcto lo sabe quien
   * redacta —puede haber un encargado, una delegación— y la ficha de la entidad
   * solo sabe quién es el titular del cargo.
   */
  useEffect(() => {
    if (code !== "A8") return;
    setDraftData((prev) => {
      const patch: Record<string, unknown> = {};
      if (numeroInformeSugerido && !String(prev.numero_informe ?? "").trim()) {
        patch.numero_informe = numeroInformeSugerido;
        // Se recuerda la propuesta: al descargar, si el campo sigue siendo esta
        // semilla (no un número tecleado a mano) se consume el correlativo vigente
        // aunque la serie haya avanzado, para no chocar con la solicitud de A7.
        patch.numero_informe_semilla = numeroInformeSugerido;
      }
      // ATENCIÓN: desplegable de autoridad preseleccionado en la AGA ("aga"), igual
      // que A6. Se fija cuando el valor guardado no es una opción válida (vacío o el
      // texto libre antiguo de cuando era un campo tecleado a mano); una elección
      // deliberada del Gerente ("gerente") no se pisa.
      const atencionActual = String(prev.atencion ?? "").trim();
      if (atencionActual !== "aga" && atencionActual !== "gerente") {
        patch.atencion = "aga";
      }
      if (remitenteSugerido && !String(prev.remitente ?? "").trim()) {
        patch.remitente = remitenteSugerido;
      }
      return Object.keys(patch).length > 0 ? { ...prev, ...patch } : prev;
    });
  }, [code, numeroInformeSugerido, atencionSugerida, remitenteSugerido]);

  // A7: el número de la solicitud de certificación se propone con el MISMO
  // correlativo de la DEC que el informe de A8 (misma serie INFORME). Solo rellena
  // el hueco; al descargar se consume de verdad.
  useEffect(() => {
    if (code !== "A7" || !numeroInformeSugerido) return;
    setDraftData((prev) =>
      String(prev.numero_solicitud ?? "").trim()
        ? prev
        // `numero_solicitud_semilla` recuerda la propuesta: al descargar, si el campo
        // sigue siendo esta semilla (no un número a mano) se consume el correlativo
        // vigente aunque la serie haya avanzado, para no chocar con el informe de A8.
        : { ...prev, numero_solicitud: numeroInformeSugerido, numero_solicitud_semilla: numeroInformeSugerido },
    );
  }, [code, numeroInformeSugerido]);

  // A6: pide la sugerencia del nº de designación cuando hay tipo de evaluador. El
  // tipo de documento cambia con él: oficial de compra → MEMORANDUM, comité/jurado
  // → INFORME. Se extrae `tipoEvalA6` para no re-llamar al API por edits ajenos.
  const tipoEvalA6 = code === "A6" ? String(draftData.tipo_evaluador ?? "").trim() : "";
  useEffect(() => {
    if (code !== "A6") {
      setNumeroDesignacionSugerido("");
      return;
    }
    if (tipoEvalA6 !== "oficial_compra" && tipoEvalA6 !== "comite" && tipoEvalA6 !== "jurado") {
      setNumeroDesignacionSugerido("");
      return;
    }
    const tipoDoc = tipoEvalA6 === "oficial_compra" ? "MEMORANDUM" : "INFORME";
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/numeracion/sugerido?tipo=${tipoDoc}&${yearParam}`, { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) setNumeroDesignacionSugerido(String(data.numero ?? "").trim());
      } catch {
        if (!cancelled) setNumeroDesignacionSugerido("");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, tipoEvalA6, yearParam]);

  // A6: siembra el nº de designación si está vacío, o si sigue siendo la propuesta
  // anterior sin tocar (p. ej. cambió el tipo de evaluador y con él la serie). Un
  // número escrito a mano por la DEC se respeta.
  useEffect(() => {
    if (code !== "A6" || !numeroDesignacionSugerido) return;
    setDraftData((prev) => {
      const actual = String(prev.documento_designacion ?? "").trim();
      const semilla = String(prev.documento_designacion_semilla ?? "").trim();
      if (actual && actual !== semilla) return prev;
      return {
        ...prev,
        documento_designacion: numeroDesignacionSugerido,
        documento_designacion_semilla: numeroDesignacionSugerido,
      };
    });
  }, [code, numeroDesignacionSugerido]);

  // A7: el "Monto certificado o previsto" arranca de la CUANTÍA base —la "Cuantía
  // actualizada" de A5 (Art. 53.1), que es lo que se va a certificar—. Solo rellena
  // el hueco: la DEC puede ajustarlo al monto realmente certificado.
  useEffect(() => {
    if (code !== "A7") return;
    const cuantia = cuantiaDeA5(hitosA5 ?? {});
    if (cuantia == null || cuantia <= 0) return;
    setDraftData((prev) => (String(prev.monto ?? "").trim() ? prev : { ...prev, monto: cuantia }));
  }, [code, hitosA5]);

  // A7: destinatarios de la solicitud por defecto —A la OGA, ATENCIÓN a Presupuesto
  // (Art. 14.2.j)—, como nombres de oficina del catálogo. Solo rellena huecos.
  useEffect(() => {
    if (code !== "A7" || !oficinasCatalogo || oficinasCatalogo.length === 0) return;
    const al = oficinaSuperiorDeLaDec(oficinasCatalogo)?.nombre ?? "";
    const at = oficinaPresupuesto(oficinasCatalogo)?.nombre ?? "";
    setDraftData((prev) => {
      const patch: Record<string, unknown> = {};
      if (al && !String(prev.solicitud_al ?? "").trim()) patch.solicitud_al = al;
      if (at && !String(prev.solicitud_atencion ?? "").trim()) patch.solicitud_atencion = at;
      return Object.keys(patch).length > 0 ? { ...prev, ...patch } : prev;
    });
  }, [code, oficinasCatalogo]);

  // A6: cabecera de la solicitud de comité (AL/ATENCIÓN/DE). Solo rellena huecos.
  //  - AL (destinatario) y DE (remitente): del enrutamiento del Informe de
  //    Segmentación (A2), que ya lo trae.
  //  - ATENCIÓN: desplegable de autoridad, preseleccionado en la AGA ("aga"). Se
  //    fija cuando el valor guardado no es una de las opciones válidas (vacío o
  //    texto antiguo de cuando era un campo libre); una elección deliberada del
  //    Gerente ("gerente") no se pisa.
  useEffect(() => {
    if (code !== "A6") return;
    const a2 = (hitosA2 ?? {}) as Record<string, unknown>;
    setDraftData((prev) => {
      const patch: Record<string, unknown> = {};
      const semillaSiVacio = (campo: string, valor: string) => {
        if (valor.trim() && !String(prev[campo] ?? "").trim()) patch[campo] = valor.trim();
      };
      semillaSiVacio("destinatario", String(a2.destinatario ?? ""));
      semillaSiVacio("remitente", String(a2.remitente ?? ""));
      const atencionActual = String(prev.atencion ?? "").trim();
      if (atencionActual !== "aga" && atencionActual !== "gerente") {
        patch.atencion = "aga";
      }
      return Object.keys(patch).length > 0 ? { ...prev, ...patch } : prev;
    });
  }, [code, hitosA2]);

  // A1 · el select "Situación en el PAC" es la fuente única de la programación.
  // Mantiene sincronizados los DOS flags booleanos que el resto del código sigue
  // leyendo por separado —`programada` (línea de corte de A2, informe) y `en_pac`
  // ("¿modifica el PAC?" de A4, C6 del export)—, y a la inversa DERIVA el select
  // desde ellos en expedientes derivados antes de este cambio (que traen los flags
  // pero no el select). Fill-if-empty / idempotente: los guardas evitan el bucle.
  useEffect(() => {
    if (code !== "A1") return;
    setDraftData((prev) => {
      const sit = prev.situacion_pac;
      const tieneSit = sit === "programado" || sit === "no_programado";
      if (!tieneSit) {
        // Backfill del select desde los flags heredados; si tampoco existen, nada.
        const b = typeof prev.programada === "boolean" ? prev.programada
          : typeof prev.en_pac === "boolean" ? prev.en_pac : null;
        if (b === null) return prev;
        return { ...prev, situacion_pac: b ? "programado" : "no_programado", programada: b, en_pac: b };
      }
      const b = sit === "programado";
      if (prev.programada === b && prev.en_pac === b) return prev; // ya sincronizado
      return { ...prev, programada: b, en_pac: b };
    });
  }, [code, draftData.situacion_pac, draftData.programada, draftData.en_pac]);

  // A4 · j) Puntos no negociables: por defecto "NO CORRESPONDE". Solo aplican con
  // subetapa de negociación o diálogo competitivo (Art. 46.1.j), así que en la gran
  // mayoría no hay: se siembra una fila "NO CORRESPONDE"/"NO CORRESPONDE" para que
  // el valor por defecto quede PERSISTIDO (no solo mostrado). Solo rellena el hueco:
  // nunca pisa puntos ya registrados ni un valor de texto heredado.
  useEffect(() => {
    if (code !== "A4") return;
    setDraftData((prev) => {
      const v = prev.var_j_puntos_no_negociables;
      const tieneDatos = (typeof v === "string" && v.trim() !== "") || leerFilas(v).length > 0;
      if (tieneDatos) return prev;
      return {
        ...prev,
        var_j_puntos_no_negociables: [{ punto: PUNTO_NO_CORRESPONDE, sustento: PUNTO_NO_CORRESPONDE }],
      };
    });
  }, [code]);

  // A4 · k) Al responder que la cuantía se actualizó (SÍ), el sustento de k)
  // (var_k_financiamiento_cuantia) se precarga con DOS cosas, en este orden:
  //   1) las FUENTES/HERRAMIENTAS marcadas en A5 (Art. 48.2 / 50.1), de donde salió
  //      el nuevo monto;
  //   2) el HALLAZGO de la interacción (la cuantía actualizada y su conclusión), el
  //      MISMO que ofrece el botón "Añadir al análisis".
  // Al incluir el hallazgo literal, el aviso pasa a "Incorpora el hallazgo de la
  // interacción con el mercado (A5)" (ya incorporado), sin tener que pulsarlo aparte.
  // Solo rellena el hueco: respeta lo que la DEC ya haya escrito.
  useEffect(() => {
    if (code !== "A4") return;
    const a5 = hitosA5 ?? {};
    const fuentes = sustentoCuantiaActualizada(a5);
    const hallazgo = insumosDeInteraccion(a5).var_k_financiamiento_cuantia ?? "";
    const sugerido = [fuentes, hallazgo].filter(Boolean).join("\n\n");
    if (!sugerido) return;
    setDraftData((prev) => {
      if (String(prev.si_cuantia_actualizada) !== "si") return prev;
      const actual = String(prev.var_k_financiamiento_cuantia ?? "").trim();
      // Rellena si está vacío o si el texto es una precarga NUESTRA anterior: la
      // frase base (formato con fuentes) o el hallazgo solo —que guardó una versión
      // previa del seeding o el botón "Añadir al análisis"—. Así se completa con las
      // fuentes y se mantiene en sincronía. Nunca pisa un sustento propio de la DEC.
      const esNuestra =
        !actual || actual.startsWith(INTRO_CUANTIA_ACTUALIZADA) || (hallazgo !== "" && actual === hallazgo);
      if (!esNuestra) return prev;
      if (actual === sugerido) return prev;
      return { ...prev, var_k_financiamiento_cuantia: sugerido };
    });
  }, [code, draftData.si_cuantia_actualizada, hitosA5]);

  // A4 · l) Si en la tabla de adelantos se marca CUALQUIER fila, la casilla
  // "¿Se selecciona la garantía por adelantos?" pasa a SÍ: marcar un adelanto
  // implica, por lógica, que la garantía por adelantos aplica. No la fuerza a NO al
  // desmarcar todo —ese es un juicio de la DEC, y el formato tiene su casilla NO—.
  useEffect(() => {
    if (code !== "A4") return;
    const algunoMarcado = leerFilas<{ marcar?: boolean }>(draftData.adelantos_items).some((r) => Boolean(r.marcar));
    if (!algunoMarcado) return;
    setDraftData((prev) =>
      String(prev.si_garantia_adelantos) === "si" ? prev : { ...prev, si_garantia_adelantos: "si" },
    );
  }, [code, draftData.adelantos_items]);

  // A4 · p) Roles y responsabilidades: se auto-siembra el MODELO por etapa (Guía p),
  // Art. 46.1.p) adaptado al proceso de a), el objeto (A3) y el evaluador de e).
  // Espera a que a) tenga proceso para citarlo. Fill-if-empty: nunca pisa lo editado;
  // para rehacerlo está "Listar roles habituales".
  useEffect(() => {
    if (code !== "A4") return;
    const proceso = String(draftData.var_a_proceso ?? "").trim();
    if (!proceso) return;
    const objeto = String(hitosTodos?.A3?.data?.objeto_contractual ?? "");
    const tipo = String(draftData.var_e_tipo_evaluador ?? "");
    const nuevo = modeloRolesP({ proceso, objeto, tipoEvaluador: tipo });
    setDraftData((prev) => {
      const filas = leerFilas<{ rol?: string; etapa?: string }>(prev.roles_items);
      // Rellena si está vacío, o REFRESCA si sigue siendo el modelo auto-generado (no
      // editado a mano): así el proceso de a) —o el objeto/evaluador— se mantiene al día.
      if (filas.length > 0 && !esModeloRolesP(prev.roles_items, objeto, tipo)) return prev;
      if (JSON.stringify(filas) === JSON.stringify(nuevo)) return prev;
      return { ...prev, roles_items: nuevo };
    });
  }, [code, draftData.var_a_proceso, draftData.var_e_tipo_evaluador, hitosTodos?.A3?.data?.objeto_contractual]);

  // A4 · s) Objetivo (Art. 46.1.s): por defecto "NO CORRESPONDE". La matriz de
  // riesgos de la necesidad NO se vuelca sola —se ofrece con un botón (avisoRiesgos)—.
  // Fill-if-empty: nunca pisa lo que la DEC escriba.
  useEffect(() => {
    if (code !== "A4") return;
    setDraftData((prev) =>
      String(prev.var_s_objetivo ?? "").trim() ? prev : { ...prev, var_s_objetivo: "NO CORRESPONDE" },
    );
  }, [code]);

  // n) Verificación del tipo de interacción (Art. 46.1.n): NO es un dato propio de
  // A4, es una VERIFICACIÓN. Cruza dos pasos:
  //   · A2 (Segmentación) → la categoría (fila que se marca con X, 120-126) y el
  //     nivel MÍNIMO de interacción exigido.
  //   · A5 (Interacción) → el nivel REALMENTE ejecutado, y si alcanza ese mínimo.
  // Se muestra en solo lectura en n) para verificarlo sin reabrir A2 ni A5.
  const clasificacionN = useMemo(() => {
    const a2 = (hitosA2 ?? {}) as Record<string, unknown>;
    if (Object.keys(a2).length === 0) return null;
    const seg = clasificarSegmentacion({
      objeto: a2.objeto === "obras_consultoria_obras" ? "obras_consultoria_obras" : "bienes_servicios",
      cuantiaAlta: Boolean(a2.cuantiaAlta),
      condicionesRiesgo: Array.isArray(a2.condicionesRiesgo) ? (a2.condicionesRiesgo as string[]) : [],
      criteriosBasica: Array.isArray(a2.criteriosBasica) ? (a2.criteriosBasica as string[]) : [],
      centralizada: Boolean(a2.centralizada),
      // Mismos inputs que el "Resultado de la segmentación" de A2 (que materializa
      // objeto, cuantía efectiva y esIoarr): así n) coincide siempre con A2.
      esIoarr: Boolean(a2.esIoarr),
    });
    const a5 = (hitosA5 ?? {}) as Record<string, unknown>;
    const nivelReal = typeof a5.nivel === "string" ? (a5.nivel as NivelInteraccion) : null;
    const realizado = nivelReal ? NIVEL_INTERACCION_META[nivelReal]?.label ?? "" : "";
    const cumple = nivelReal ? NIVEL_ORDEN.indexOf(nivelReal) >= NIVEL_ORDEN.indexOf(seg.nivel) : null;
    return { categoria: seg.categoriaLabel, nivelMinimo: seg.nivelLabel, realizado, cumple };
  }, [hitosA2, hitosA5]);

  // Cuantía actualizada de A5: la usa el cronograma o) para el plazo del
  // consentimiento (apelación por cuantía + 1, Art. 304 + 82.1).
  const cuantiaCronograma = useMemo(() => cuantiaDeA5(hitosA5 ?? {}), [hitosA5]);

  // A4 a) Tipo de procedimiento: se propone el competitivo que corresponde a la
  // clasificación de la ficha (objeto + tipo de proceso que anticipó el área
  // usuaria, Arts. 93/94/95), traducido al select del Formato (Art. 54). Solo
  // rellena el hueco: la estrategia la decide la DEC (Art. 46.1.a) y puede
  // cambiarlo. Un no competitivo (o sin proceso definido) no se siembra: va a b).
  useEffect(() => {
    if (code !== "A4") return;
    const proceso = (procesoNecesidad ?? "").trim();
    const generico = procedimientoGenerico(proceso);
    if (!generico) return; // no competitivo o sin proceso: a) queda vacío (→ b)
    setDraftData((prev) => {
      const patch: Record<string, unknown> = {};
      // a) muestra el proceso específico de la ficha (solo lectura); se rellena si
      // aún no está.
      if (!String(prev.var_a_proceso ?? "").trim()) patch.var_a_proceso = proceso;
      // El genérico (Art. 54) se DERIVA del proceso mostrado y se mantiene
      // sincronizado: es lo que consumen el cronograma y los plazos.
      if (prev.var_a_procedimiento !== generico) patch.var_a_procedimiento = generico;
      return Object.keys(patch).length > 0 ? { ...prev, ...patch } : prev;
    });
  }, [code, procesoNecesidad]);

  // A5 · Sustento legal: sigue al nivel elegido. El campo es opcional, pero para
  // que en el formulario se vea LO MISMO que saldrá en B12/B26, se siembra con la
  // cita del nivel (Art. 48 indagación / Arts. 49-50 consulta) cuando está vacío o
  // cuando aún conserva la cita del OTRO tipo (se cambió el nivel). Una redacción
  // propia de la DEC —distinta a ambas citas— no se pisa. El efecto reacciona solo
  // al CAMBIO de nivel, no a cada tecla: así se puede vaciar el campo a mano y no
  // se vuelve a rellenar hasta que se cambie el nivel.
  useEffect(() => {
    if (code !== "A5") return;
    setDraftData((prev) => {
      const nivel = String(prev.nivel ?? "");
      const citas = citasDeNivel(nivel);
      if (!citas) return prev; // sin nivel no se cita nada
      const actual = String(prev.sustento_citas ?? "").trim();
      if (actual && !citasSonDeOtroTipo(actual, nivel)) return prev;
      return { ...prev, sustento_citas: citas };
    });
  }, [code, draftData.nivel]);

  // A6 cambia sus exportables según el tipo de evaluador (A6 · «Tipo de
  // evaluador»): con COMITÉ, solo la Solicitud de propuesta de comité (Excel, el
  // formato oficial); con oficial de compra o jurado, los tres documentos de
  // designación (.docx). Los demás pasos no dependen del dato.
  const tipoEvaluadorSel =
    code === "A6" ? String((draftData?.tipo_evaluador ?? estado?.data?.tipo_evaluador) ?? "").trim() : "";
  const exportables: FormatoExport[] =
    code === "A6" && tipoEvaluadorSel === "comite"
      ? [
          { path: "fase1/solicitud-comite-xlsx", label: "Solicitud de comité (Excel)", previa: "comite" },
          // La jurada y el consentimiento también aplican al comité: se firman por
          // integrante. La previa trae el selector Todos / cada miembro.
          { path: "fase1/evaluadores-docx?doc=jurada", label: "Declaración jurada de no conflicto", word: true, previa: "evaluadores" },
          { path: "fase1/evaluadores-docx?doc=consentimiento", label: "Consentimiento de datos personales", word: true, previa: "evaluadores" },
        ]
      : EXPORT_FORMATO[code] ?? [];
  // Path que se está descargando ahora (para el spinner por botón).
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);

  // A9 · "Elaborar Bases (Word)": un puñado de procedimientos de catálogo
  // resuelven a más de un PDF de bases estándar (VARIANTES_AMBIGUAS en
  // lib/bases-plantillas.ts). Si el expediente está en uno de esos casos, la
  // descarga necesita que se elija cuál corresponde ANTES de pedirla — la
  // ruta ya rechaza (409) una petición sin `?variante=` cuando hay 2+.
  const variantesBases =
    code === "A9" && procedureType ? VARIANTES_AMBIGUAS[procedureType] : undefined;
  const [varianteBasesSel, setVarianteBasesSel] = useState<string>("");

  // Se declara DESPUÉS del estado que usa (draftStatus/draftData): así el
  // compilador de React no ve un uso antes de la declaración y puede optimizar
  // el componente sin descartar la memoización manual de más abajo.
  async function descargar(target: FormatoExport, miembro?: number | null, varianteBases?: string) {
    setDownloadingPath(target.path);
    try {
      // El documento lo genera el SERVIDOR a partir de lo guardado. Si el paso
      // tiene cambios sin guardar (p. ej. condiciones de riesgo recién marcadas
      // en A2), se persisten primero para que el export refleje lo que se ve.
      const sinGuardar =
        draftStatus !== (estado?.status ?? "pendiente") ||
        JSON.stringify(draftData ?? {}) !== JSON.stringify(estado?.data ?? {});
      if (sinGuardar && canManage) {
        await onSave(draftStatus, draftData);
      }
      // A7: la fecha de la solicitud (campo del paso) viaja como query param a C12,
      // para que la previa/export reflejen el valor actual del campo aunque aún no
      // se haya guardado (al exportar, además, arriba se persiste el borrador).
      const sep = target.path.includes("?") ? "&" : "?";
      const fechaSolicitud = String(draftData.fecha_solicitud ?? "");
      const extra = code === "A7" && fechaSolicitud ? `${sep}fecha=${encodeURIComponent(fechaSolicitud)}` : "";
      // A6: descarga por miembro (la ruta ya lleva "?doc=", así que va con "&").
      const extraMiembro = miembro != null ? `&miembro=${miembro}` : "";
      // A9: procedimiento ambiguo (VARIANTES_AMBIGUAS) — la variante elegida en
      // el selector viaja como query param. A diferencia de fecha/miembro
      // arriba, `fase1/bases-docx` no lleva "?" propio, así que el separador
      // se decide contra lo ya concatenado (no se puede asumir "&" a ciegas).
      const sepVariante = `${target.path}${extra}${extraMiembro}`.includes("?") ? "&" : "?";
      const extraVariante = varianteBases ? `${sepVariante}variante=${encodeURIComponent(varianteBases)}` : "";
      // A7/A8 consumen el correlativo del contador del AÑO FISCAL: se pasa en la URL
      // para que coincida con el año de la sugerencia (no el calendario del servidor).
      const base = `/api/processes/${processId}/${target.path}${extra}${extraMiembro}${extraVariante}`;
      const urlDescarga =
        code === "A7" || code === "A8" ? `${base}${base.includes("?") ? "&" : "?"}${yearParam}` : base;
      const res = await fetch(urlDescarga);
      if (!res.ok) {
        let msg = "No se pudo generar el archivo.";
        try {
          const payload = await res.json();
          msg = payload.error ?? msg;
        } catch {
          // respuesta sin JSON
        }
        showToast(msg, "error");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? `${target.label}.${target.word ? "docx" : "xlsx"}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Descargado: ${filename}`, "success");
    } catch {
      showToast("No se pudo conectar para descargar el archivo.", "error");
    } finally {
      setDownloadingPath(null);
    }
  }

  // Copiloto (A3): pide al modelo redactar los apartados del requerimiento,
  // anclado al PDF-modelo del proceso. Solo rellena los VACÍOS del borrador —no
  // pisa lo escrito— y no guarda: el usuario revisa y luego cierra el paso.
  async function redactarConIA() {
    setRedactandoIA(true);
    try {
      const res = await fetch(`/api/processes/${processId}/copiloto/redactar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const payload = await res.json();
      if (!res.ok) {
        showToast(payload.error ?? "No se pudo redactar con el copiloto.", "error");
        return;
      }
      const aplicar = camposAplicables((payload.campos ?? {}) as Record<string, string>, draftData);
      const n = Object.keys(aplicar).length;
      if (n === 0) {
        showToast("El copiloto no propuso nada nuevo para los apartados vacíos.", "info");
        return;
      }
      setDraftData((prev) => ({ ...prev, ...aplicar }));
      showToast(
        `El copiloto redactó ${n} apartado${n === 1 ? "" : "s"} anclado al modelo. Revísalo y complétalo antes de guardar.`,
        "success",
      );
    } catch {
      showToast("No se pudo conectar con el copiloto.", "error");
    } finally {
      setRedactandoIA(false);
    }
  }

  /**
   * Campos que aplican al OBJETO de esta contratación.
   *
   * Dos filtros que hacen lo mismo por caminos distintos:
   *
   *   · `mostrarParaObjeto`, declarado en el propio campo, para los que la norma
   *     acota (Art. 44.4 bienes y obras, 126.2 bienes y servicios, 154.1 obras).
   *   · El prefijo `obra_` de A4, que agrupa el bloque del Art. 154 sin
   *     necesidad de marcar sus ~15 variables una a una.
   *
   * Sin objeto definido no se filtra: quien aún no lo eligió debe verlo todo.
   */
  const campos = useMemo(() => {
    const todos = detalle?.campos ?? [];
    if (!objetoContractual) return todos;
    const esObra = objetoContractual === "obra" || objetoContractual === "consultoria_obra";
    return todos.filter((c) => {
      if (code === "A4" && c.name.startsWith("obra_") && !esObra) return false;
      if (c.mostrarParaObjeto && !c.mostrarParaObjeto.includes(objetoContractual)) return false;
      return true;
    });
  }, [detalle, code, objetoContractual]);

  // Los pasos llegan a 46 campos (A4) con la mitad opcionales. Por defecto se
  // muestran los obligatorios y los "de corresponder"; los demás quedan tras un
  // desplegable.
  //
  // Excepción deliberada: un campo opcional CON VALOR se muestra igual. Ocultar
  // datos ya registrados es peor que mostrar de más — el usuario los perdería
  // de vista sin saber que están ahí.
  const [verOpcionales, setVerOpcionales] = useState(false);
  // A4 apila varios avisos de CONTEXTO permanente (régimen, modificación del
  // PAC) que sepultaban los avisos accionables. Se pliegan bajo una cabecera;
  // arranca plegado para que lo primero que se vea sea lo que pide acción.
  const [contextoAbierto, setContextoAbierto] = useState(false);
  // Copiloto · iteración 2: redacción de A3 con IA, anclada al modelo del proceso.
  const [redactandoIA, setRedactandoIA] = useState(false);
  const { camposVisibles, ocultos, obligatoriosPendientes, obligatoriosTotal, faltanObligatorios } = useMemo(
    // La regla de visibilidad vive en una función pura para poder probarla sin
    // montar React (tests en `node`, sin DOM): lo que allí se afirma es lo que
    // aquí se pinta. Ver lib/fase-campos-visibles.ts.
    () => visibilidadDePaso(campos, draftData, verOpcionales),
    [campos, draftData, verOpcionales],
  );
  // A4: avance por sección (a–t). Se calcula sobre el objeto-filtrado completo, no
  // sobre lo visible, para que el "llenos/total" no baile al plegar los opcionales.
  const progresoGrupos = useMemo(() => progresoDeGrupos(campos, draftData), [campos, draftData]);

  // A3: el Art. 126.2 fija un plazo mínimo de un año para los bienes/servicios
  // rutinarios u operacionales de provisión continua. La categoría la aporta A2.
  // Coherencia de A1: las dos casillas de programación son el mismo hecho y
  // podían contradecirse en silencio. A10: el beneficio de los 40 días se
  // calcula y verifica solo (Art. 64.3).
  const avisosDeA1 = code === "A1" ? avisosA1(draftData) : [];
  const avisosDeA3 = code === "A3" ? avisosA3(draftData) : [];
  const avisosDeA10 = code === "A10" ? avisosA10(draftData) : [];

  // Art. 42.3: en las contrataciones NO programadas la DEC segmenta "luego de la
  // recepción del requerimiento". La Guía lo repite textualmente. Eso invierte el
  // orden del bloque (A2 antes de A3): en estas contrataciones corresponde primero
  // formular el requerimiento y después clasificarlo. Se AVISA sin bloquear, porque
  // la norma lo permite hacer en cualquier orden y el módulo no debe prohibirlo.
  // `hitosA1` son los datos GUARDADOS de A1; en A1 mismo se mira el borrador en
  // vivo para que el aviso aparezca en cuanto se marca "no programada".
  const noProgramada = code === "A2" || code === "A3" ? esNoProgramada(hitosA1) : false;
  const noProgramadaDraft = code === "A1" ? esNoProgramada(draftData) : false;

  const avisoPlazo =
    code === "A3"
      ? validarPlazoMinimo({
          categoria: categoriaSegmentacion,
          objetoContractual: draftData.objeto_contractual as string | undefined,
          plazoDias: Number(draftData.plazo_dias),
          provisionContinua: Boolean(draftData.provision_continua),
        })
      : null;

  // A3: si la estrategia se apartó de lo propuesto, el requerimiento fue
  // modificado (Art. 44.7) y la no objeción no puede quedar en "no aplica".
  const noObjecionIncoherente =
    code === "A3" &&
    (divergencias?.length ?? 0) > 0 &&
    (draftData.no_objecion === "no_aplica" || !draftData.no_objecion);

  // A5: aviso si el nivel de interacción elegido es inferior al mínimo (A2).
  const nivelSeleccionado = draftData.nivel as NivelInteraccion | undefined;
  const nivelInsuficiente =
    code === "A5" &&
    nivelMinimo != null &&
    nivelSeleccionado != null &&
    NIVEL_ORDEN.indexOf(nivelSeleccionado) < NIVEL_ORDEN.indexOf(nivelMinimo.nivel);

  // A6: el tipo de evaluador lo decide A4 (Art. 46.1.e) y A6 lo designa
  // (Art. 54.2.e). Si en A6 se cambia a otro tipo distinto del de A4, el
  // expediente se contradice a sí mismo. Se avisa; no se bloquea, porque la DEC
  // puede haber cambiado de criterio y entonces lo que toca es corregir A4.
  const tipoEvaluadorA4 =
    code === "A6" ? String(hitosTodos?.A4?.data?.var_e_tipo_evaluador ?? "") : "";
  const tipoEvaluadorA6 = code === "A6" ? String(draftData.tipo_evaluador ?? "") : "";
  const evaluadorDivergente =
    Boolean(tipoEvaluadorA4) && Boolean(tipoEvaluadorA6) && tipoEvaluadorA4 !== tipoEvaluadorA6;

  // A4: la estrategia no puede CERRARSE con la interacción pendiente.
  //
  // El Art. 46.1 la analiza "considerando la información obtenida en la
  // interacción" y el 47.1 la declara insumo suyo. Se bloquea el cierre, no la
  // edición: el 46.2 permite variar la estrategia hasta antes de aprobar el
  // expediente, así que redactarla en paralelo a la interacción es lo previsto.
  const estrategiaSinInteraccion = code === "A4" && !puedeCerrarEstrategia(statusA5);

  // A2: la segmentación no puede CERRARSE con la cuantía de bienes/servicios sin
  // determinar (sin cálculo automático posible —falta PAC o valor— y sin que la
  // DEC eligiera alta/baja a mano). De la cuantía depende la categoría
  // (Rutinaria/Crítico vs Operacional/Estratégico) y el nivel de interacción que
  // exige A5; darla por hecha asumiendo "baja" sería clasificar en silencio. Se
  // bloquea el cierre, no la edición. Misma regla que el aviso del formulario.
  const segmentacionSinCuantia =
    code === "A2" &&
    cuantiaSegmentacionSinDeterminar({
      objeto: typeof draftData.objeto === "string" ? draftData.objeto : undefined,
      cuantiaAlta: typeof draftData.cuantiaAlta === "boolean" ? draftData.cuantiaAlta : undefined,
      pacBienesServicios: segParametros?.pacBienesServicios,
      valorEstimado: segParametros?.valorEstimado,
    });

  // A4: la estrategia no puede CERRARSE sin las dos variables del Art. 46.1 que la
  // norma NO condiciona a "de corresponder" y que sostienen el análisis: a) el tipo
  // de procedimiento —sin él no hay estrategia que analizar— y s) la identificación
  // del objetivo, que INCLUYE EXPRESAMENTE la gestión de riesgos (46.1.s). Cerrar
  // sin s) dejaría el expediente sin ese análisis de riesgos. Los obligatorios en
  // general no bloquean "Hecho"; estas dos sí, por su peso normativo. Bloquea el
  // cierre, no la edición.
  const a4VariablesClaveVacias = code === "A4" ? variablesClaveA4Faltantes(draftData) : [];
  const a4SinVariablesClave = a4VariablesClaveVacias.length > 0;

  // A4 · Art. 46.1.b: un procedimiento no competitivo es una EXCEPCIÓN del
  // Art. 55 de la Ley y hay que sustentarla. Sin sustento, el formato afirmaría
  // la excepción sin justificarla.
  // Lo que ya se sabe basta para señalar la familia del procedimiento: el
  // objeto (A3) y si el requerimiento está estandarizado con ficha técnica
  // (A3, que lo hereda del área usuaria).
  const sugerencia =
    code === "A4"
      ? procedimientoSugerido(objetoContractual, estandarizadoA3 === true)
      : null;
  // Con la cuantía estimada y los topes (por defecto 2026), ya se puede afirmar la
  // MODALIDAD que antes «dependía de un anexo que ACE no tenía». Se ofrecen las
  // opciones elegibles; la DEC decide. Vacío si aún no hay objeto o cuantía.
  const elegiblesPorCuantia =
    code === "A4"
      ? procedimientosElegibles(objetoContractual, valorEstimado ?? null, estandarizadoA3 === true, segParametros?.topes)
      : [];

  // a) ¿Modifica el procedimiento del PAC? Se deduce, así que hay que ENSEÑAR
  // el resultado: si no, quien rellena A4 no sabe qué saldrá marcado en el
  // Excel ni por qué, y acaba buscando una casilla que no existe.
  const procPac = code === "A4" ? String(hitosA1?.procedimiento_pac ?? "") : "";
  // El proceso ESPECÍFICO (con su submodalidad), igual que el exportador, para que
  // el aviso de A4 y el .xls coincidan; fallback al genérico en datos antiguos.
  const procA4 = String(draftData.var_a_proceso ?? draftData.var_a_procedimiento ?? "");
  const enPac = hitosA1?.en_pac !== false;
  const modificaPac = code === "A4" ? modificaProcedimientoDelPac(procPac, procA4, enPac) : null;

  // A5 fija la cuantía de la contratación (Art. 47.1) y esa cuantía ES el valor
  // estimado del expediente: de ella salen la línea de corte de A2 (Art. 125.2)
  // y la certificación que A7 debe cubrir. Como se decide aquí, aquí se enseña.
  const cuantiaA5 = code === "A5" ? cuantiaDeA5(draftData) : null;
  const propuestasA5 = code === "A5" ? leerProveedores(draftData.proveedores) : [];
  const criterioA5 = String(draftData.criterio_cuantia ?? "");
  // Una sola propuesta no tiene "menor" ni "promedio": el criterio es una
  // etiqueta vacía sobre un único dato, y quien lo lea creerá que hubo un rango.
  const criterioSinRango =
    code === "A5" &&
    propuestasA5.filter((p) => Number(p.monto) > 0).length === 1 &&
    (criterioA5 === "menor" || criterioA5 === "promedio");
  // El área usuaria estimó una cifra y el mercado dice otra. Ninguna de las dos
  // es "la mala" —por eso no se corrige nada solo—, pero una brecha grande hay
  // que resolverla antes de aprobar el expediente.
  const brechaNecesidad =
    code === "A5" && cuantiaA5 != null && montoNecesidad != null && montoNecesidad > 0
      ? cuantiaA5 / montoNecesidad
      : null;
  const hayBrecha = brechaNecesidad != null && (brechaNecesidad > 1.1 || brechaNecesidad < 0.9);

  // El sustento legal cargado quedó del OTRO tipo de interacción: pasa al
  // sembrarlo y cambiar el nivel después. El Anexo saldría citando el artículo
  // que no toca (y con el criterio que no es: el 48.3 cuenta fuentes, el 49.2
  // cuenta herramientas).
  const citasDesfasadas =
    code === "A5" && citasSonDeOtroTipo(String(draftData.sustento_citas ?? ""), String(draftData.nivel ?? ""));

  // ¿El cronograma llega a la fecha que pidió el área usuaria? Nadie lo miraba,
  // y es la pregunta por la que existe la contratación.
  const avisoTarde =
    code === "A4"
      ? avisoFechaRequerida(
          leerFilas<ActividadCronograma>(draftData.cronograma_items),
          fechaRequerida,
          Number(hitosTodos?.A3?.data?.plazo_dias) || null,
        )
      : null;

  // La DEC no puede haber RECIBIDO un requerimiento que la necesidad no registra
  // como remitido, ni recibirlo antes de que se remita.
  const recepcionA3 = code === "A3" ? String(draftData.fecha_recepcion_dec ?? "") : "";
  const sinRemision = Boolean(recepcionA3) && !fechaRemisionDec;
  const recepcionAntesDeRemision =
    Boolean(recepcionA3) && Boolean(fechaRemisionDec) && recepcionA3 < fechaRemisionDec!;

  // Relleno que no debería llegar a un documento firmado ("NOLOSE", "11", una
  // fila de cronograma sin fecha). Solo se mira al declarar el paso hecho:
  // guardar un borrador a medias es trabajo legítimo, no un error.
  const problemasCalidad =
    draftStatus === "hecho"
      ? problemasDelPaso(code, draftData, {
          a1: hitosTodos?.A1?.data,
          a3: hitosTodos?.A3?.data,
          a4: hitosTodos?.A4?.data,
          feriados,
          objeto: objetoContractual,
        })
      : [];

  // A8 recoge lo de A1, A3, A4, A5, A6 y A7: el Art. 54.2 enumera literal por
  // literal lo que el expediente contiene, así que aprobarlo sin esas piezas es
  // aprobar un expediente que la norma dice que está incompleto.
  //
  // Se calcula SIEMPRE (no solo al declarar el paso hecho) porque en A8 esta
  // lista no es un reproche: es el índice de lo que se está aprobando. Saber qué
  // falta —y qué ya está— es el trabajo del paso.
  const faltaExpediente =
    code === "A8" && hitosTodos ? faltaParaAprobar(hitosTodos, valorEstimado ?? null, pacBienesServicios ?? null) : [];

  // Mismo criterio que A8: no se puede otorgar la buena pro (B7) sin haber
  // cerrado la evaluación (y las bases integradas, si hubo consultas u
  // observaciones), ni declarar el consentimiento (B8) sin un otorgamiento
  // previo. Ver lib/seleccion-contenido.ts.
  const faltaOtorgar = code === "B7" && hitosTodos ? faltaParaOtorgar(hitosTodos) : [];
  const faltaConsentir = code === "B8" && hitosTodos ? faltaParaConsentir(hitosTodos) : [];

  // A7: la certificación tiene que cubrir el valor estimado. Sin cobertura no
  // procede aprobar el expediente (A8). Con ejecución plurianual ("ambas") la
  // cobertura es CCP + previsión, no `monto` (oculto en ese caso): se lee con el
  // mismo helper que usa la puerta A8, o el aviso quedaría mudo en plurianuales.
  const montoA7 = code === "A7" ? coberturaA7(draftData) : Number.NaN;
  const certificacionCorta =
    code === "A7" &&
    Number.isFinite(montoA7) &&
    montoA7 > 0 &&
    valorEstimado != null &&
    valorEstimado > 0 &&
    montoA7 < valorEstimado;

  // El procedimiento lo elige A4, pero los plazos que dependen de él se aplican
  // en toda la Fase 2 (p. ej. el consentimiento de B8), así que fuera de A4 se
  // lee del hito A4 ya guardado. Dentro de A4 manda el borrador aunque esté
  // vacío: si se borra a), o) no puede seguir usando el procedimiento anterior.
  // El cronograma o) y los factores/requisitos se calculan por la CLAVE del
  // procedimiento (licitacion_publica_abreviada, …), no por el texto de a)
  // ("Licitación Pública abreviada para bienes"). Se deriva de a) con
  // `procedimientoGenerico` para que los mapas de plazos (Arts. 64.1/66.1/68.1/304)
  // encuentren el procedimiento; sin esto caía a genéricos y no calculaba según a).
  const procedimientoProceso =
    (code === "A4"
      ? procedimientoGenerico(procA4)
      : String(hitosTodos?.A4?.data?.var_a_procedimiento ?? "")) || undefined;

  // o) Cronograma: al abrir A4 con un procedimiento definido en a), se AUTO-SIEMBRA
  // con las actividades mínimas de ese procedimiento (Art. 46.1.o) si aún está
  // vacío —para que se muestre sin tener que pulsar "Sembrar"—. Fill-if-empty, y
  // solo reacciona al CAMBIO de procedimiento: borrar filas a mano no lo vuelve a
  // llenar, y cambiar a) después no pisa un cronograma ya editado (eso lo ofrece el
  // botón "Rehacer la fase de selección" del propio editor).
  useEffect(() => {
    if (code !== "A4") return;
    const proc = (procedimientoProceso ?? "").trim();
    if (!proc) return;
    setDraftData((prev) => {
      if (leerFilas<ActividadCronograma>(prev.cronograma_items).length > 0) return prev;
      return {
        ...prev,
        cronograma_items: construirCronogramaInicial(
          proc,
          Number(hitosTodos?.A3?.data?.plazo_dias) || null,
          (hitosTodos?.A3?.data?.plazo_unidad as string | undefined) ?? null,
        ),
      };
    });
  }, [code, procedimientoProceso, hitosTodos?.A3?.data?.plazo_dias, hitosTodos?.A3?.data?.plazo_unidad]);

  const noCompetitivoSinSustento =
    code === "A4" &&
    regimenA4 === "no_competitivo" &&
    !String(draftData.var_b_no_competitivo ?? "").trim();

  // Por qué "Hecho" no se puede guardar todavía, en una línea JUNTO al botón. La
  // <option> solo anticipa dos causas (A5 y el sustento de b)); las otras dos
  // —observaciones de calidad y expediente incompleto— dependen de haber elegido
  // ya "Hecho", así que no caben en la etiqueta de la opción. Sin este aviso, el
  // usuario elige "Hecho", ve el botón gris y tiene que adivinar por qué o buscar
  // las listas de más arriba. Se nombra la causa en el punto exacto del bloqueo.
  const motivoBloqueoHecho =
    draftStatus !== "hecho"
      ? null
      : estrategiaSinInteraccion
        ? "cierra la interacción con el mercado (A5)"
        : noCompetitivoSinSustento
          ? "completa el sustento de b) del procedimiento no competitivo"
          : a4SinVariablesClave
            ? `completa ${a4VariablesClaveVacias.map((v) => v.falta).join(" y ")}`
            : faltaExpediente.length > 0
              ? "el expediente aún no está completo (ver el detalle arriba)"
              : problemasCalidad.length > 0
                ? "resuelve las observaciones de arriba"
                : null;
  // Qué FORMATO tiene la previa abierta, o null. Se guarda el formato entero y no
  // solo su clave porque A6 tiene TRES formatos con la misma clave ("evaluadores")
  // que se distinguen por el `doc` de su path; con solo la clave no se sabría cuál.
  const [previaAbierta, setPreviaAbierta] = useState<FormatoExport | null>(null);
  const cerrarPrevia = () => setPreviaAbierta(null);
  const meta = HITO_STATUS_META[status];

  return (
    <li className={cn("overflow-hidden rounded-[10px] border bg-surface", ITEM_BORDE[status])} data-aplica={aplicabilidad?.estado} data-status={status}>
      <button
        aria-controls={`paso-cuerpo-${code}`}
        aria-expanded={expanded}
        className="flex w-full flex-wrap items-center gap-2.5 px-3 py-[11px] text-left text-ink hover:bg-[color-mix(in_srgb,var(--brand)_5%,transparent)]"
        onClick={onToggle}
        type="button"
      >
        <span className="min-w-[34px] shrink-0 rounded-[6px] bg-brand px-[7px] py-0.5 text-center text-[12px] font-bold text-white" title={`${code} · ${label}`}>
          {code.replace(/^[A-Z]/, "")}
        </span>
        <span className="flex flex-[1_1_55%] min-w-[11ch] flex-col gap-0.5 text-left">
          <span className={cn("text-[13.5px] font-semibold", aplicabilidad?.estado === "no_aplica" && "opacity-[0.62]")}>{label}</span>
          {/* El «para qué» en lenguaje llano, para quien no maneja la jerga
              normativa: se lee sin abrir el paso. Solo lo tienen los de F1. */}
          {RESUMEN_LLANO[code] ? <span className="text-[11.5px] font-normal leading-[1.35] text-muted">{RESUMEN_LLANO[code]}</span> : null}
        </span>
        {/* Que no corresponda es lo primero que hay que saber de un paso, y hasta
            ahora solo se descubría abriéndolo: con 26 pasos, eso son 26 clics
            para enterarse de que ocho sobraban. */}
        {aplicabilidad?.estado === "no_aplica" ? (
          <span className="shrink-0 rounded-full border px-[9px] py-0.5 text-[11px] font-semibold bg-[color-mix(in_srgb,var(--ink)_10%,var(--surface))] border-[color-mix(in_srgb,var(--ink)_20%,var(--line))] text-[color-mix(in_srgb,var(--ink)_70%,transparent)]" title={aplicabilidad.motivo}>
            No corresponde
          </span>
        ) : null}
        {aplicabilidad?.estado === "facultativo" ? (
          <span className="shrink-0 rounded-full border px-[9px] py-0.5 text-[11px] font-semibold text-brand bg-[color-mix(in_srgb,var(--brand)_10%,var(--surface))] border-[color-mix(in_srgb,var(--brand)_30%,var(--line))]" title={aplicabilidad.motivo}>
            Puede no corresponder
          </span>
        ) : null}
        <span className="shrink-0 rounded-full px-[9px] py-0.5 text-[11px] font-semibold text-white" style={{ background: meta.color }}>
          {meta.label}
        </span>
        {/* Progreso de obligatorios sin abrir el paso: es la diferencia entre un
            "en curso" ya listo para cerrar y uno al que aún le faltan datos. La
            barra da la proporción de un vistazo; cuando no falta ninguno, el paso
            avisa "listo" (todos los obligatorios llenos, se puede marcar hecho).
            Aplica a TODOS los pasos: el conteo sale del mismo helper de visibilidad. */}
        {status !== "hecho" &&
        status !== "na" &&
        aplicabilidad?.estado !== "no_aplica" &&
        obligatoriosTotal > 0 ? (
          obligatoriosPendientes === 0 ? (
            <span
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-success/[0.13] px-2 py-0.5 text-[11px] font-bold text-success"
              title="Todos los campos obligatorios están llenos: el paso se puede marcar como hecho"
            >
              <Check size={12} aria-hidden /> listo
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 whitespace-nowrap"
              title={`${obligatoriosTotal - obligatoriosPendientes} de ${obligatoriosTotal} campos obligatorios llenos`}
            >
              <span className="h-1 w-[42px] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--muted)_24%,transparent)] [&>i]:block [&>i]:h-full [&>i]:rounded-[inherit] [&>i]:bg-brand [&>i]:transition-[width] [&>i]:duration-200" aria-hidden>
                <i
                  style={{
                    width: `${Math.round(((obligatoriosTotal - obligatoriosPendientes) / obligatoriosTotal) * 100)}%`,
                  }}
                />
              </span>
              <span className="text-[11px] font-semibold text-muted">{obligatoriosPendientes} por llenar</span>
            </span>
          )
        ) : null}
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {expanded ? (
        <div className="grid gap-2 border-t border-line px-[14px] pt-1 pb-[14px]" id={`paso-cuerpo-${code}`}>
          {/* Va lo PRIMERO del cuerpo, antes incluso de la descripción del paso:
              si no corresponde, todo lo que viene detrás es ruido.

              Tres tratamientos distintos a propósito. "No corresponde" tiene un
              artículo literal detrás y ofrece el atajo para cerrarlo; "puede no
              corresponder" solo informa, porque nace de un silencio de la norma y
              decidirlo es del usuario; la nota no habla de SI el paso toca sino de
              CÓMO se hace en este procedimiento, que es otra pregunta. Cuando los
              tres se veían iguales, la más decisiva se perdía entre las otras. */}
          {aplicabilidad?.estado === "no_aplica" ? (
            <div className={cn(GATING, "pasoGatingNoAplica")}>
              <Ban size={13} />
              <span>
                <strong>No corresponde a este expediente.</strong> {aplicabilidad.motivo}
                {status !== "na" && canManage ? (
                  <>
                    {" "}
                    <button
                      className="mt-2.5 inline-flex cursor-pointer items-center gap-[5px] rounded-[7px] border border-dashed border-line px-[9px] py-[5px] !text-[11.5px] text-muted hover:border-brand hover:bg-[color-mix(in_srgb,var(--brand)_5%,transparent)] hover:text-ink"
                      onClick={() => void onSave("na", draftData)}
                      type="button"
                    >
                      Marcarlo como “No aplica”
                    </button>
                  </>
                ) : null}
              </span>
            </div>
          ) : null}

          {aplicabilidad?.estado === "facultativo" ? (
            <div className={GATING}>
              <Info size={13} />
              <span>
                <strong>Puede no corresponder.</strong> {aplicabilidad.motivo}
              </span>
            </div>
          ) : null}

          {aplicabilidad?.nota && aplicabilidad.estado !== "no_aplica" ? (
            <div className={cn(GATING, "pasoGatingComo")}>
              <Lightbulb size={13} />
              <span>
                <strong>Cómo se hace en este procedimiento.</strong>
                <span className="mt-[3px] block whitespace-pre-line">{aplicabilidad.nota}</span>
              </span>
            </div>
          ) : null}

          {detalle ? (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-[6px] bg-brand-soft px-2 py-0.5 text-[11.5px] font-semibold text-brand-dark">{detalle.accionGuia}</span>
                <span className="inline-flex items-center gap-1 text-[11.5px] text-muted">
                  <UserRound size={12} /> {detalle.responsables}
                </span>
              </div>
              <p className="m-0 text-[13px] leading-normal text-ink">{detalle.objetivo}</p>
              <p className="m-0 flex items-center gap-[5px] text-[11.5px] italic text-muted">
                <Info size={12} /> {detalle.baseLegal}
              </p>
              {detalle.formatos.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {detalle.formatos.map((f) => (
                    <span className="inline-flex items-center gap-1 rounded-[6px] border border-dashed border-[color-mix(in_srgb,var(--accent)_40%,var(--line))] px-[7px] py-0.5 text-[11px] text-accent" key={f}>
                      <FileText size={11} /> {f}
                    </span>
                  ))}
                </div>
              ) : null}
              {detalle.nota ? <p className="m-0 rounded-[4px] border-l-[3px] border-l-[color-mix(in_srgb,var(--accent)_55%,var(--line))] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] px-2.5 py-[7px] text-[12px] text-muted">{detalle.nota}</p> : null}
            </>
          ) : (
            <p className="m-0 text-[13px] leading-normal text-ink">{responsable}</p>
          )}

          {/* Orientación del paso — copiloto · iteración 1 (sin IA). Responde en
              llano «¿qué falta aquí?» (los obligatorios pendientes POR NOMBRE, no
              un número suelto) y «¿qué sigue?» (qué desbloquea cerrarlo). Todo
              determinista: reusa el conteo de obligatorios y las dependencias ya
              conocidas. Se omite en pasos cerrados, «no aplica» o sin nada que
              orientar. */}
          {aplicabilidad?.estado !== "no_aplica" &&
          status !== "na" &&
          status !== "hecho" &&
          (faltanObligatorios.length > 0 || DESBLOQUEA[code]) ? (
            <div className="mb-1.5 mt-2.5 rounded-[9px] border border-line bg-brand-soft px-3 py-2.5 text-[12.5px] leading-normal">
              {faltanObligatorios.length > 0 ? (
                <>
                  <span className="text-[12px] font-semibold text-ink">
                    Falta por llenar en este paso ({faltanObligatorios.length}):
                  </span>
                  <ul className="mt-1.5 list-disc pl-[18px] [&>li]:my-0.5 [&>li]:text-[var(--ink-soft)]">
                    {faltanObligatorios.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {DESBLOQUEA[code] ? (
                <p className="mt-2.5 flex items-start gap-[5px] border-t border-dashed border-line pt-2 text-[11.5px] text-muted">
                  <ChevronRight size={12} /> {DESBLOQUEA[code]}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Copiloto · iteraciones 2-3. A2 (justificación de la segmentación,
              que alimenta su informe), A3 (requerimiento, Art. 44) y A4
              (estrategia, Art. 46) reusan la maquinaria del copiloto: redactan los
              apartados vacíos anclados al modelo/norma. Propone; el usuario revisa
              y guarda. */}
          {(code === "A2" || code === "A3" || code === "A4") && canManage ? (
            <div className="mt-1 mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-2.5">
              <button
                className="inline-flex flex-none items-center gap-1.5 rounded-[8px] border border-brand bg-brand px-3 py-1.5 !text-[12.5px] !font-semibold text-white hover:enabled:brightness-[1.07] disabled:cursor-default disabled:opacity-60"
                disabled={redactandoIA}
                onClick={() => void redactarConIA()}
                type="button"
              >
                {redactandoIA ? <Loader className="spinIcon" size={13} /> : <Sparkles size={13} />}
                {redactandoIA
                  ? "Redactando…"
                  : code === "A2"
                    ? "Redactar la justificación con IA"
                    : code === "A4"
                      ? "Redactar la estrategia con IA"
                      : "Redactar el requerimiento con IA"}
              </button>
              <span className="min-w-[180px] flex-[1_1_200px] text-[11px] leading-[1.4] text-muted">
                {code === "A2"
                  ? "Propone la justificación y el análisis de riesgo que van al Informe de Segmentación."
                  : code === "A4"
                    ? "Propone el sustento de las variables vacías anclado al modelo y la norma."
                    : "Propone los apartados vacíos anclado al modelo del proceso y la norma."}{" "}
                Solo rellena huecos; revísalo antes de guardar.
              </span>
            </div>
          ) : null}

          {noObjecionIncoherente ? (
            <div className={GATING_WARN}>
              <Info size={13} />
              <span>
                El requerimiento difiere de lo que propuso el área usuaria en{" "}
                <strong>{divergencias!.join(", ")}</strong>. El Art. 44.7 exige que la DEC obtenga
                su no objeción antes de continuar: márcalo abajo. No puede quedar en “no aplica”.
              </span>
            </div>
          ) : null}

          {avisosDeA1.map((a) => (
            <div className={GATING_WARN} key={a.mensaje}>
              <AlertTriangle size={14} />
              <span>{a.mensaje}</span>
            </div>
          ))}

          {avisosDeA3.map((a) => (
            <div className={GATING_WARN} key={a.mensaje}>
              <AlertTriangle size={14} />
              <span>{a.mensaje}</span>
            </div>
          ))}

          {avisosDeA10.map((a) => (
            <div className={a.nivel === "error" ? GATING_WARN : GATING} key={a.mensaje}>
              <AlertTriangle size={14} />
              <span>{a.mensaje}</span>
            </div>
          ))}

          {/* Art. 42.3: en las NO programadas la segmentación se efectúa luego de
              la recepción del requerimiento. Aviso, no candado: la norma permite
              el otro orden y el módulo no debe prohibirlo. */}
          {noProgramadaDraft || (code !== "A1" && noProgramada) ? (
            <div className={GATING}>
              <Info size={13} />
              <span>
                <strong>Contratación no programada: el orden de la Guía se invierte.</strong>{" "}
                El numeral 42.3 del Reglamento: en las contrataciones no programadas la DEC efectúa
                la segmentación <em>luego de la recepción del requerimiento</em>. La Guía lo repite
                sin rodeos.{" "}
                {code === "A1"
                  ? "Al ser no programada, corresponde primero A3 · Formular el requerimiento y después A2 · Segmentación de las contrataciones. Puedes hacerlo en otro orden —la norma no lo prohíbe— pero respeta la secuencia descrita."
                  : "Este expediente está declarado como no programado en A1, así que corresponde primero A3 · Formular el requerimiento y después A2 · Segmentación de las contrataciones. Puedes hacerlo en otro orden —la norma no lo prohíbe— pero respeta la secuencia descrita."}
              </span>
            </div>
          ) : null}

          {code === "A3" && avisoPlazo ? (
            <div className={avisoPlazo.nivel === "error" ? GATING_WARN : GATING}>
              <Info size={13} />
              <span>{avisoPlazo.mensaje}</span>
            </div>
          ) : null}


          {/* El Art. 54.1 determina la FAMILIA sin ambigüedad, así que se
              sugiere de un clic. La MODALIDAD (abreviada o no) depende de la
              cuantía y los Arts. 93-95 remiten a un anexo web que no está en la
              norma publicada: preseleccionarla sería afirmar lo que no se sabe,
              en un documento que se firma. */}
          {sugerencia && draftData.var_a_procedimiento !== sugerencia.value ? (
            <div className={GATING}>
              <Info size={13} />
              <span>
                Por el objeto corresponde{" "}
                <strong>{labelProcedimiento(sugerencia.value)}</strong>. {sugerencia.motivo}{" "}
                {!elegiblesPorCuantia[0]?.value ? (
                  <>
                    Comprueba si aplica su <strong>modalidad abreviada</strong>: eso depende de la
                    cuantía y la norma remite a un anexo que ACE no tiene.
                  </>
                ) : null}
                {canManage ? (
                  <>
                    {" "}
                    <button
                      className="mt-2.5 inline-flex cursor-pointer items-center gap-[5px] rounded-[7px] border border-dashed border-line px-[9px] py-[5px] !text-[11.5px] text-muted hover:border-brand hover:bg-[color-mix(in_srgb,var(--brand)_5%,transparent)] hover:text-ink"
                      onClick={() =>
                        setDraftData((prev) => ({ ...prev, var_a_procedimiento: sugerencia.value }))
                      }
                      type="button"
                    >
                      Usarlo
                    </button>
                  </>
                ) : null}
              </span>
            </div>
          ) : null}

          {/* Sugerencia por CUANTÍA (topes DSEACE-OECE): la modalidad que antes no
              se podía afirmar. `value` vacío = contrato menor, no se ofrece adoptar. */}
          {elegiblesPorCuantia[0]?.value && draftData.var_a_procedimiento !== elegiblesPorCuantia[0].value ? (
            <div className={GATING}>
              <Info size={13} />
              <span>
                Según los topes y la cuantía estimada, corresponde{" "}
                <strong>{labelProcedimiento(elegiblesPorCuantia[0].value)}</strong>. {elegiblesPorCuantia[0].motivo}
                {elegiblesPorCuantia.filter((e) => e.value).length > 1 ? (
                  <>
                    {" "}También podría ser{" "}
                    {elegiblesPorCuantia
                      .slice(1)
                      .filter((e) => e.value)
                      .map((e) => labelProcedimiento(e.value))
                      .join(" o ")}
                    .
                  </>
                ) : null}
                {canManage ? (
                  <>
                    {" "}
                    <button
                      className="mt-2.5 inline-flex cursor-pointer items-center gap-[5px] rounded-[7px] border border-dashed border-line px-[9px] py-[5px] !text-[11.5px] text-muted hover:border-brand hover:bg-[color-mix(in_srgb,var(--brand)_5%,transparent)] hover:text-ink"
                      onClick={() =>
                        setDraftData((prev) => ({ ...prev, var_a_procedimiento: elegiblesPorCuantia[0].value }))
                      }
                      type="button"
                    >
                      Usarlo
                    </button>
                  </>
                ) : null}
              </span>
            </div>
          ) : null}

          {code === "A4" ? (
            <>
              {/* Régimen y modificación del PAC son CONTEXTO permanente del paso
                  —no avisos que pidan acción—. Plegados bajo una sola cabecera
                  dejan de sepultar los avisos decisivos; si la modificación del
                  PAC está sin determinar, la cabecera se tiñe para seguir
                  señalando ese punto desde plegado. */}
              <button
                aria-expanded={contextoAbierto}
                className={`pasoContextoToggle ${modificaPac === null ? "pasoContextoAviso" : ""}`}
                onClick={() => setContextoAbierto((v) => !v)}
                type="button"
              >
                {contextoAbierto ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <span>
                  Contexto de la estrategia — régimen y modificación del PAC.
                  {modificaPac === null ? (
                    <>
                      {" "}
                      <strong>La modificación del PAC está sin determinar.</strong>
                    </>
                  ) : null}
                </span>
              </button>

              {contextoAbierto ? (
                <>
                  <div className={GATING}>
                    <Info size={13} />
                    <span>
                      Régimen: <strong>{regimenA4 === "no_competitivo" ? "NO COMPETITIVO" : "COMPETITIVO"}</strong>.{" "}
                      {regimenA4 === "no_competitivo" ? (
                        <>
                          Lo determina la causal del <strong>Art. 55</strong> registrada en A1
                          (Programación), no este paso: el <strong>Art. 101.1</strong> excluye la
                          segmentación de los no competitivos, así que debe saberse antes de A2.
                        </>
                      ) : (
                        <>
                          Es la regla general del <strong>Art. 54.3</strong>. Para declararlo no
                          competitivo hay que acreditar una causal del Art. 55 en A1 (Programación).
                        </>
                      )}
                    </span>
                  </div>

                  <div className={modificaPac === null ? GATING_WARN : GATING}>
                    <Info size={13} />
                    <span>
                      <strong>a) ¿Modifica el procedimiento del PAC?</strong>{" "}
                      {modificaPac === null ? (
                        <>
                          <strong>Sin determinar</strong> — el Excel saldrá con las dos casillas en blanco.
                          {!procPac ? (
                            <>
                              {" "}
                              Falta <em>“Procedimiento de selección registrado en el PAC”</em> en{" "}
                              <strong>A1 · Programación</strong>.
                            </>
                          ) : (
                            <> Falta elegir el tipo de procedimiento aquí abajo.</>
                          )}
                        </>
                      ) : (
                        <>
                          <strong>{modificaPac ? "SÍ" : "NO"}</strong> → se marcará una X en{" "}
                          <code>{modificaPac ? "F4" : "H4"}</code>.{" "}
                          {!enPac ? (
                            <>
                              Es una <strong>contratación no programada</strong>: no está en el PAC, así
                              que no hay ningún procedimiento registrado allí que modificar.
                            </>
                          ) : (
                            <>
                              El PAC programaba <strong>{labelProcedimiento(procPac)}</strong> y la
                              estrategia{" "}
                              {modificaPac ? (
                                <>
                                  elige <strong>{labelProcedimiento(procA4)}</strong>: sustenta el cambio
                                  abajo.
                                </>
                              ) : (
                                <>lo mantiene.</>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {noCompetitivoSinSustento ? (
            <div className={GATING_WARN}>
              <Info size={13} />
              <span>
                Has declarado un procedimiento <strong>no competitivo</strong>. Es una excepción a
                la regla general del Art. 54.3 y el <strong>Art. 46.1.b</strong> exige sustentarla:
                rellena <em>“b) Sustento para la utilización de un procedimiento de selección no
                competitivo”</em> antes de cerrar el paso.
              </span>
            </div>
          ) : null}

          {estrategiaSinInteraccion ? (
            <div className={GATING}>
              <Info size={13} />
              <span>
                La <strong>interacción con el mercado (A5)</strong> es insumo de la estrategia
                (Art. 47.1) y esta se analiza “considerando la información obtenida” en ella
                (Art. 46.1). Puedes ir redactándola —el Art. 46.2 permite variarla hasta antes de
                aprobar el expediente— pero <strong>no podrás darla por hecha</strong> hasta cerrar
                A5. Si no corresponde (contrato menor o catálogo de acuerdo marco), marca A5 como
                “No aplica”.
              </span>
            </div>
          ) : null}

          {code === "A5" && nivelMinimo ? (
            <div className={nivelInsuficiente ? GATING_WARN : GATING}>
              <Info size={13} />
              <span>
                Segmentación (A2): <strong>{nivelMinimo.categoria}</strong> → nivel mínimo de
                interacción: <strong>{nivelMinimo.label}</strong>. {nivelMinimo.requisito} El nivel
                elegido debe ser igual o superior.
                {nivelInsuficiente ? " ⚠ El nivel seleccionado es inferior al mínimo." : ""}
              </span>
            </div>
          ) : null}

          {/* La cuantía que sale de la interacción con el mercado. Se enseña con
              su cifra y con lo que arrastra: es el dato del que dependen A2, A7
              y el Formato 1, y hasta ahora se calculaba sin que nadie lo viera. */}
          {code === "A5" && cuantiaA5 != null ? (
            <div className={hayBrecha ? GATING_WARN : GATING}>
              <Info size={13} />
              <span>
                Cuantía de la contratación: <strong>{soles(cuantiaA5)}</strong>. Al guardar, pasa a
                ser la cuantía de la contratación del expediente (Art. 47.1): con ella A2 calcula su línea de
                corte y A7 comprueba la certificación.
                {hayBrecha && montoNecesidad != null ? (
                  <>
                    {" "}
                    ⚠ El área usuaria estimó <strong>{soles(montoNecesidad)}</strong> (
                    {brechaNecesidad!.toFixed(1)}× de diferencia). Resuelve cuál es la cifra buena
                    antes de aprobar el expediente: cambia la categoría de A2, el nivel de
                    interacción exigido y el presupuesto que hace falta.
                  </>
                ) : null}
                {criterioSinRango ? (
                  <> ⚠ Solo hay una propuesta: con un único dato no hay menor ni promedio.</>
                ) : null}
              </span>
            </div>
          ) : null}

          {avisoTarde ? (
            <div className={GATING_WARN}>
              <Info size={13} />
              <span>
                El área usuaria necesitaba esta contratación el{" "}
                <strong>{avisoTarde.requerida}</strong> y con este cronograma la tendría el{" "}
                <strong>{avisoTarde.entrega}</strong>: <strong>{avisoTarde.diasTarde} días</strong>{" "}
                tarde (firma del contrato más el plazo de ejecución). Ajusta el cronograma o deja
                constancia del motivo.
              </span>
            </div>
          ) : null}

          {sinRemision ? (
            <div className={GATING_WARN}>
              <Info size={13} />
              <span>
                Registras que la DEC recibió el requerimiento el <strong>{recepcionA3}</strong>, pero
                la necesidad no tiene fecha de remisión. Registra la remisión en la necesidad: la DEC
                no puede recibir lo que nadie remitió.
              </span>
            </div>
          ) : null}

          {recepcionAntesDeRemision ? (
            <div className={GATING_WARN}>
              <Info size={13} />
              <span>
                La recepción por la DEC (<strong>{recepcionA3}</strong>) es anterior a la remisión
                registrada en la necesidad (<strong>{fechaRemisionDec}</strong>). Una de las dos
                fechas está mal.
              </span>
            </div>
          ) : null}

          {citasDesfasadas ? (
            <div className={GATING_WARN}>
              <Info size={13} />
              <span>
                El sustento legal cargado es el del otro tipo de interacción: la indagación se
                sustenta en el <strong>Art. 48</strong> y la consulta al mercado en los{" "}
                <strong>Arts. 49 y 50</strong>, y el criterio de básica/avanzada no es el mismo (el
                48.3 cuenta fuentes de información; el 49.2, herramientas). Usa el sustento sugerido
                del campo para corregirlo.
              </span>
            </div>
          ) : null}

          {evaluadorDivergente ? (
            <div className={GATING_WARN}>
              <Info size={13} />
              <span>
                En la estrategia (A4) el tipo de evaluador es{" "}
                <strong>{labelTipoEvaluador(tipoEvaluadorA4)}</strong> y aquí estás designando un{" "}
                <strong>{labelTipoEvaluador(tipoEvaluadorA6)}</strong>. La designación (Art. 54.2.e)
                debe coincidir con lo decidido en la estrategia (Art. 46.1.e): corrige uno de los
                dos.
              </span>
            </div>
          ) : null}

          {code === "A7" && certificacionCorta ? (
            <div className={GATING_WARN}>
              <Info size={13} />
              <span>
                La certificación (<strong>{soles(montoA7)}</strong>) no cubre la cuantía de la contratación (
                <strong>{soles(valorEstimado!)}</strong>), que resulta de la interacción con el
                mercado (A5). Sin cobertura presupuestal no procede aprobar el expediente (A8):
                amplía la certificación o replantea el requerimiento.
              </span>
            </div>
          ) : null}

          {/* Insumos de la Fase 1 (estrategia A4) para este paso de F2/F3.
              No se auto-rellenan: se OFRECEN con su origen citado y un botón
              para adoptarlos, igual que A5→A4. Un dato heredado en silencio
              rompe la trazabilidad; uno visible con "viene de A4" la conserva. */}
          {insumosF1 && insumosF1.length > 0 ? (
            <div className="mb-3 rounded-[8px] border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2.5">
              <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-[#1e40af]">
                <ClipboardCheck size={13} /> Definido en la Fase 1 (estrategia)
              </div>
              {insumosF1.map((ins) => {
                const yaEsta = String(draftData[ins.campo] ?? "").includes(ins.valor);
                return (
                  <div className="flex items-start justify-between gap-2.5 border-t border-t-[#dbeafe] py-[7px] first-of-type:border-t-0 [&>div]:text-[13px]" key={`${ins.destino}-${ins.campo}-${ins.label}`}>
                    <div>
                      <strong>{ins.label}.</strong> {ins.valor}
                      <small className="mt-0.5 block text-[11px] text-muted">{ins.origen}</small>
                    </div>
                    {canManage && !yaEsta ? (
                      <button
                        className="secondaryButton compactButton"
                        onClick={() =>
                          setDraftData((prev) => {
                            const actual = String(prev[ins.campo] ?? "").trim();
                            return { ...prev, [ins.campo]: actual ? `${actual}\n${ins.valor}` : ins.valor };
                          })
                        }
                        type="button"
                      >
                        Usar
                      </button>
                    ) : yaEsta ? (
                      <small className="whitespace-nowrap text-[12px] text-[#166534]">Incorporado</small>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="mt-1">
            {detalle?.especial === "segmentacion" ? (
              <SegmentacionForm
                // Remonta al cambiar de expediente. Las propuestas de PARA /
                // ATENCIÓN / DE se hacen UNA VEZ por montaje, con un candado en
                // `useRef`; al navegar entre expedientes React reutiliza el
                // componente y esos candados seguirían cerrados, así que el
                // siguiente expediente no recibiría sus datos. Lo mismo con el
                // cronograma prellenado.
                key={processId ?? "sin-expediente"}
                areaUsuariaSugerida={areaUsuariaSugerida}
                responsableSugerido={responsableSugerido}
                objetoSugerido={objetoSegmentacionDe(objetoContractual)}
                onChange={setDraftData}
                parametros={segParametros}
                readOnly={!canManage}
                value={draftData}
              />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  {camposVisibles.map((campo, i) => {
                    // Subtítulo de grupo: solo cuando el grupo cambia respecto al
                    // campo VISIBLE anterior (así resiste el filtro de opcionales).
                    // Sin `grupo` (todos los pasos salvo A4) no pinta nada.
                    const nuevoGrupo = campo.grupo && campo.grupo !== camposVisibles[i - 1]?.grupo;
                    const est = nuevoGrupo && campo.grupo ? progresoGrupos.get(campo.grupo) : undefined;
                    const grupoCompleto = est && est.total > 0 && est.llenos >= est.total;
                    return (
                    <Fragment key={campo.name}>
                    {nuevoGrupo ? (
                      <div className="pasoGrupo" data-completo={grupoCompleto ? "si" : undefined}>
                        <span className="min-w-0 flex-1 text-[11px] font-bold uppercase tracking-[0.03em] text-ink">{campo.grupo}</span>
                        {est && est.total > 0 ? (
                          <span className="pasoGrupoProgreso">
                            <span className="pasoGrupoCheck">
                              <Check size={13} aria-hidden /> completo
                            </span>
                            <span
                              className="pasoGrupoBarra"
                              title={`${est.llenos} de ${est.total} campos exigibles`}
                            >
                              <i style={{ width: `${Math.round((est.llenos / est.total) * 100)}%` }} />
                            </span>
                            <span className="pasoGrupoCuenta">
                              {est.llenos}/{est.total}
                            </span>
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <Campo
                      requerido={campoEsRequerido(campo, draftData)}
                      propuestaRequisitos={
                        campo.name === "var_f_requisitos_calificacion"
                          ? String(hitosTodos?.A3?.data?.propuesta_requisitos_calificacion ?? "")
                          : undefined
                      }
                      noCorresponde={
                        campo.noCorrespondeSalvoQue
                          ? !String(draftData[campo.noCorrespondeSalvoQue.campo] ?? "").trim()
                          : false
                      }
                      // El Art. 54.1 reparte por objeto: licitación pública
                      // para bienes y obras, concurso público para servicios.
                      // Ofrecer los cuatro invita a elegir el que no toca.
                      campo={
                        // El nº de designación (A6): su prefijo y etiqueta cambian
                        // con el tipo de evaluador —oficial de compra "Memorándum
                        // N° "; comité/jurado "INFORME N° "—.
                        campo.name === "documento_designacion"
                          ? {
                              ...campo,
                              prefijo: prefijoDesignacion(String(draftData.tipo_evaluador ?? "")),
                              label: etiquetaDesignacion(String(draftData.tipo_evaluador ?? "")),
                            }
                          : campo.name === "var_a_procedimiento"
                          ? {
                              ...campo,
                              opciones: procedimientosParaObjeto(objetoContractual).map((o) => ({
                                label: `${o.label} (${o.objeto})`,
                                value: o.value,
                              })),
                            }
                          : // Campos que eligen una OFICINA del catálogo (A8 · AL/DE,
                            // A7 · A/ATENCIÓN de la solicitud): el documento imprime a
                            // su responsable. El valor es el nombre de la oficina.
                            campo.opcionesOficinas && (oficinasCatalogo?.length ?? 0) > 0
                            ? {
                                ...campo,
                                opciones: (oficinasCatalogo ?? []).map((o) => ({
                                  label: o.nombre,
                                  value: o.nombre,
                                })),
                              }
                            : campo
                      }
                      disabled={!canManage}
                      criterioCuantia={draftData.criterio_cuantia as string | undefined}
                      documentoSugerido={documentoSugerido}
                      objetoContractual={objetoContractual}
                      calcBase={
                        campo.calcularDesde
                          ? (hitosTodos?.[campo.calcularDesde.hito]?.data?.[campo.calcularDesde.campo] as
                              | string
                              | undefined)
                          : undefined
                      }
                      clasificacionN={campo.name === "var_n_tipo_interaccion" ? clasificacionN : undefined}
                      cuantiaA5={campo.name === "cronograma_items" ? cuantiaCronograma : undefined}
                      diasCronogramaPorProcedimiento={
                        campo.name === "cronograma_items" ? segParametros?.diasCronogramaPorProcedimiento : undefined
                      }
                      tipoEvaluadorRol={
                        campo.name === "roles_items" ? String(draftData.var_e_tipo_evaluador ?? "") : undefined
                      }
                      procesoRol={campo.name === "roles_items" ? String(draftData.var_a_proceso ?? "") : undefined}
                      riesgosNecesidad={
                        campo.name === "var_s_objetivo" ? String(draftData.riesgos_necesidad ?? "") : undefined
                      }
                      feriados={feriados}
                      insumo={insumosA5?.[campo.name]}
                      key={campo.name}
                      onChange={
                        // h) Al elegir la modalidad de pago, su sustento (var_h_
                        // sustento_pago) se auto-carga con la norma que le
                        // corresponde (Art. 130/286), salvo que la DEC ya haya
                        // escrito algo propio. Mismo trato que g) con los factores.
                        campo.name === "var_h_modalidad_pago"
                          ? (v) =>
                              setDraftData((prev) => {
                                const auto = sustentoAlElegirModalidadPago(
                                  String(v ?? ""),
                                  String(prev.var_h_sustento_pago ?? ""),
                                );
                                return auto !== null
                                  ? { ...prev, var_h_modalidad_pago: v, var_h_sustento_pago: auto }
                                  : { ...prev, var_h_modalidad_pago: v };
                              })
                          : // i) Igual que h): al elegir el sistema de entrega, su
                            // sustento (var_i_sustento_entrega) se auto-carga con la
                            // norma que le toca (Art. 129/158), salvo texto propio.
                            campo.name === "var_i_sistema_entrega"
                            ? (v) =>
                                setDraftData((prev) => {
                                  const auto = sustentoAlElegirSistemaEntrega(
                                    String(v ?? ""),
                                    String(prev.var_i_sustento_entrega ?? ""),
                                  );
                                  return auto !== null
                                    ? { ...prev, var_i_sistema_entrega: v, var_i_sustento_entrega: auto }
                                    : { ...prev, var_i_sistema_entrega: v };
                                })
                            : // A6: al elegir el tipo de evaluador, el número de
                              // integrantes se autoselecciona (oficial 1, comité 3,
                              // jurado 5; el jurado sigue editable a 3).
                              campo.name === "tipo_evaluador"
                              ? (v) =>
                                  setDraftData((prev) => {
                                    const cant = cantidadDefaultPorTipoEvaluador(String(v ?? ""));
                                    return cant
                                      ? { ...prev, tipo_evaluador: v, cantidad_integrantes: cant }
                                      : { ...prev, tipo_evaluador: v };
                                  })
                              : // q) Igual que h)/i): al elegir el tipo de agrupación, el
                                // sustento (var_q_agrupar) se auto-carga con la norma del
                                // mecanismo (Art. 52), salvo que la DEC ya escribiera algo.
                                campo.name === "agrupacion_tipo"
                                ? (v) =>
                                    setDraftData((prev) => {
                                      const auto = sustentoAlElegirAgrupacion(
                                        String(v ?? ""),
                                        String(prev.var_q_agrupar ?? ""),
                                      );
                                      return auto !== null
                                        ? { ...prev, agrupacion_tipo: v, var_q_agrupar: auto }
                                        : { ...prev, agrupacion_tipo: v };
                                    })
                                : (v) => setDraftData((prev) => ({ ...prev, [campo.name]: v }))
                      }
                      processId={processId}
                      procedimiento={procedimientoProceso}
                      plazoDias={Number(hitosTodos?.A3?.data?.plazo_dias) || null}
                      plazoUnidad={(hitosTodos?.A3?.data?.plazo_unidad as string | undefined) ?? null}
                      tipoEvaluador={draftData.tipo_evaluador as string | undefined}
                      cantidadIntegrantes={
                        // Cada sección del comité crea su propio número de filas: la
                        // del área usuaria, 2 (los expertos); la de la DEC, 1 (el
                        // comprador). Oficial/jurado usan el total del paso.
                        campo.name === "integrantes_area_usuaria"
                          ? "2"
                          : campo.name === "integrantes" &&
                              String(draftData.tipo_evaluador ?? "") === "comite"
                            ? "1"
                            : (draftData.cantidad_integrantes as string | undefined)
                      }
                      propuesto={propuestas?.[campo.name]}
                      sugerenciaTexto={
                        campo.name === "var_e_perfil_evaluador"
                          ? sustentoEvaluadorSugerido(draftData.var_e_tipo_evaluador)
                          : campo.name === "sustento_citas"
                            ? citasSugeridas(draftData.nivel)
                            : undefined
                      }
                      value={draftData[campo.name]}
                    />
                    </Fragment>
                    );
                  })}
                </div>
                {ocultos > 0 || verOpcionales ? (
                  <button
                    className="mt-2.5 inline-flex cursor-pointer items-center gap-[5px] rounded-[7px] border border-dashed border-line px-[9px] py-[5px] !text-[11.5px] text-muted hover:border-brand hover:bg-[color-mix(in_srgb,var(--brand)_5%,transparent)] hover:text-ink"
                    onClick={() => setVerOpcionales((v) => !v)}
                    type="button"
                  >
                    {verOpcionales ? (
                      <>
                        <ChevronDown size={13} /> Ocultar los campos opcionales
                      </>
                    ) : (
                      <>
                        <ChevronRight size={13} /> Mostrar {ocultos}{" "}
                        {ocultos === 1 ? "campo opcional" : "campos opcionales"}
                      </>
                    )}
                  </button>
                ) : null}
              </>
            )}
          </div>

          {/* Cada formato con previa abre la suya, identificada por su clave.
              Un paso puede tener DOS (A8: informe y Anexo N° 2), por eso la
              condición es la clave y no el código del paso. La descarga que
              recibe el modal es la del formato de ESA previa, no la del primer
              exportable. */}
          {previaAbierta?.previa === "segmentacion" ? (
            <SegmentacionPreviewModal
              onClose={cerrarPrevia}
              onDescargar={() => void descargar(previaAbierta)}
              processId={processId}
            />
          ) : null}
          {previaAbierta?.previa === "anexo1" ? (
            <Anexo1PreviewModal
              onClose={cerrarPrevia}
              onDescargar={() => void descargar(previaAbierta)}
              processId={processId}
            />
          ) : null}
          {previaAbierta?.previa === "estrategia" ? (
            <EstrategiaPreviewModal
              onClose={cerrarPrevia}
              onDescargar={() => void descargar(previaAbierta)}
              processId={processId}
            />
          ) : null}
          {previaAbierta?.previa === "informe_aprobacion" ? (
            <InformeAprobacionPreviewModal
              onClose={cerrarPrevia}
              onDescargar={() => {
                const fmt = previaAbierta;
                cerrarPrevia();
                void descargar(fmt);
              }}
              processId={processId}
            />
          ) : null}
          {previaAbierta?.previa === "anexo2" ? (
            <Anexo2PreviewModal
              onClose={cerrarPrevia}
              onDescargar={() => void descargar(previaAbierta)}
              processId={processId}
            />
          ) : null}
          {previaAbierta?.previa === "certificacion" ? (
            <CertificacionPreviewModal
              onClose={cerrarPrevia}
              onDescargar={() => void descargar(previaAbierta)}
              processId={processId}
              fecha={String(draftData.fecha_solicitud ?? "")}
            />
          ) : null}
          {previaAbierta?.previa === "comite" ? (
            <ComitePreviewModal
              onClose={cerrarPrevia}
              onDescargar={() => void descargar(previaAbierta)}
              processId={processId}
            />
          ) : null}
          {/* A6: los tres documentos comparten modal; el `doc` sale del path del
              formato abierto (fase1/evaluadores-docx?doc=memo|jurada|…). */}
          {previaAbierta?.previa === "evaluadores" ? (
            <EvaluadoresPreviewModal
              doc={new URLSearchParams(previaAbierta.path.split("?")[1] ?? "").get("doc") ?? "memo"}
              label={previaAbierta.label}
              onClose={cerrarPrevia}
              onDescargar={(miembro) => void descargar(previaAbierta, miembro)}
              processId={processId}
            />
          ) : null}
          {previaAbierta?.previa === "bases_checklist" ? (
            <ChecklistBasesPreviewModal
              onClose={cerrarPrevia}
              onDescargar={() => void descargar(previaAbierta)}
              processId={processId}
            />
          ) : null}

          {/* Un botón por documento: A6 exporta tres (memorándum, jurada,
              consentimiento); el resto de pasos, uno. */}
          {exportables.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {exportables.map((fmt) => {
                const cargando = downloadingPath === fmt.path;
                // Bases de un procedimiento ambiguo: hace falta elegir la
                // variante ANTES de poder pedir la descarga — ver
                // VARIANTES_AMBIGUAS en lib/bases-plantillas.ts. El selector
                // reemplaza al botón simple solo para este documento.
                if (fmt.path === "fase1/bases-docx" && variantesBases && variantesBases.length > 0) {
                  return (
                    <div className="flex flex-wrap items-center gap-2" key={fmt.path}>
                      <select
                        aria-label="Variante de bases a elaborar"
                        onChange={(e) => setVarianteBasesSel(e.target.value)}
                        value={varianteBasesSel}
                      >
                        <option value="">— Elegir variante de bases —</option>
                        {variantesBases.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                      <button
                        className="secondaryButton compactButton pasoExport"
                        disabled={downloadingPath !== null || !varianteBasesSel}
                        onClick={() => void descargar(fmt, null, varianteBasesSel)}
                        type="button"
                      >
                        {cargando ? <Loader className="spinIcon" size={14} /> : <FileText size={14} />}
                        {cargando ? "Generando…" : `Exportar ${fmt.label} (Word)`}
                      </button>
                    </div>
                  );
                }
                return (
                  <button
                    className="secondaryButton compactButton pasoExport"
                    disabled={downloadingPath !== null}
                    key={fmt.path}
                    onClick={() => (fmt.previa ? setPreviaAbierta(fmt) : void descargar(fmt))}
                    type="button"
                  >
                    {cargando ? (
                      <Loader className="spinIcon" size={14} />
                    ) : fmt.word ? (
                      <FileText size={14} />
                    ) : (
                      <FileSpreadsheet size={14} />
                    )}
                    {cargando
                      ? "Generando…"
                      : fmt.previa
                        ? `Vista previa y exportar ${fmt.label}`
                        : `Exportar ${fmt.label} (${fmt.word ? "Word" : "Excel"})`}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Al declarar el paso HECHO se enseña lo que quedó a medias. La opción
              NO se deshabilita, a diferencia de los bloqueos legales: si no se
              puede elegir, tampoco se ve qué falta, y el usuario se queda
              mirando un botón gris. Lo que se bloquea es guardar. */}
          {/* La norma escribe esta lista: el Art. 54.2 enumera a)…g) y cada
              literal es el producto de un paso. Se enseña con su número para que
              cualquiera pueda verificarlo contra el Reglamento. */}
          {faltaExpediente.length > 0 ? (
            <div className={cn(GATING_WARN, "[&>ul]:my-1 [&>ul]:pl-[18px] [&_li]:mb-0.5")}>
              <Info size={13} />
              <div>
                <strong>El expediente aún no está completo</strong> según el Art. 54.2 del
                Reglamento. Falta:
                <ul>
                  {faltaExpediente.map((f) => (
                    <li key={`${f.literal}-${f.etiqueta}`}>
                      <strong>{f.literal})</strong> {f.etiqueta}. {f.detalle}{" "}
                      {f.paso && onAbrirPaso ? (
                        <button className="mt-2.5 inline-flex cursor-pointer items-center gap-[5px] rounded-[7px] border border-dashed border-line px-[9px] py-[5px] !text-[11.5px] text-muted hover:border-brand hover:bg-[color-mix(in_srgb,var(--brand)_5%,transparent)] hover:text-ink" onClick={() => onAbrirPaso(f.paso!)} type="button">
                          Ir a {f.paso}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                Puedes guardarlo en curso y aprobarlo cuando estén.
              </div>
            </div>
          ) : null}

          {/* Mismo patrón que el aviso de A8 (arriba), para los gates entre
              pasos de la Fase 2: ver lib/seleccion-contenido.ts. */}
          {faltaOtorgar.length > 0 ? (
            <div className={cn(GATING_WARN, "[&>ul]:my-1 [&>ul]:pl-[18px] [&_li]:mb-0.5")}>
              <Info size={13} />
              <div>
                <strong>Todavía no se puede otorgar la buena pro.</strong> Falta:
                <ul>
                  {faltaOtorgar.map((f) => (
                    <li key={`${f.literal}-${f.etiqueta}`}>
                      <strong>{f.etiqueta}</strong> ({f.literal}). {f.detalle}{" "}
                      {f.paso && onAbrirPaso ? (
                        <button className="mt-2.5 inline-flex cursor-pointer items-center gap-[5px] rounded-[7px] border border-dashed border-line px-[9px] py-[5px] !text-[11.5px] text-muted hover:border-brand hover:bg-[color-mix(in_srgb,var(--brand)_5%,transparent)] hover:text-ink" onClick={() => onAbrirPaso(f.paso!)} type="button">
                          Ir a {f.paso}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                Puedes guardarlo en curso y otorgarlo cuando estén.
              </div>
            </div>
          ) : null}

          {faltaConsentir.length > 0 ? (
            <div className={cn(GATING_WARN, "[&>ul]:my-1 [&>ul]:pl-[18px] [&_li]:mb-0.5")}>
              <Info size={13} />
              <div>
                <strong>Todavía no se puede declarar consentida la buena pro.</strong> Falta:
                <ul>
                  {faltaConsentir.map((f) => (
                    <li key={`${f.literal}-${f.etiqueta}`}>
                      <strong>{f.etiqueta}</strong> ({f.literal}). {f.detalle}{" "}
                      {f.paso && onAbrirPaso ? (
                        <button className="mt-2.5 inline-flex cursor-pointer items-center gap-[5px] rounded-[7px] border border-dashed border-line px-[9px] py-[5px] !text-[11.5px] text-muted hover:border-brand hover:bg-[color-mix(in_srgb,var(--brand)_5%,transparent)] hover:text-ink" onClick={() => onAbrirPaso(f.paso!)} type="button">
                          Ir a {f.paso}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                Puedes guardarlo en curso y declararlo consentido cuando esté.
              </div>
            </div>
          ) : null}

          {canManage && draftStatus === "hecho" && problemasCalidad.length > 0 ? (
            <div className={cn(GATING_WARN, "[&>ul]:my-1 [&>ul]:pl-[18px] [&_li]:mb-0.5")}>
              <Info size={13} />
              <div>
                <strong>Esto se firma y se publica.</strong> Antes de darlo por hecho:
                <ul>
                  {problemasCalidad.map((p) => (
                    <li key={`${p.campo}-${p.mensaje}`}>{p.mensaje}</li>
                  ))}
                </ul>
                Puedes guardarlo en curso y seguir después.
              </div>
            </div>
          ) : null}

          {canManage ? (
            <>
            <div className="mt-1.5 flex items-end gap-2.5 border-t border-dashed border-line pt-2.5">
              <label className="grid gap-1 text-[12px] text-muted">
                <span>Estado</span>
                <Select className="!w-56" onChange={(e) => setDraftStatus(e.target.value as HitoStatus)} value={draftStatus}>
                  {STATUS_ORDER.map((s) => (
                    <option
                      // "Hecho" se deshabilita, no se oculta: que se vea por qué
                      // no se puede elegir todavía.
                      disabled={s === "hecho" && (estrategiaSinInteraccion || noCompetitivoSinSustento || segmentacionSinCuantia || a4SinVariablesClave)}
                      key={s}
                      value={s}
                    >
                      {HITO_STATUS_META[s].label}
                      {s === "hecho" && estrategiaSinInteraccion ? " — requiere cerrar A5" : s === "hecho" && noCompetitivoSinSustento ? " — falta el sustento de b)" : s === "hecho" && segmentacionSinCuantia ? " — falta determinar la cuantía" : s === "hecho" && a4SinVariablesClave ? " — faltan variables obligatorias (a, e, s)" : ""}
                    </option>
                  ))}
                </Select>
              </label>
              <button
                className="primaryButton compactButton"
                // Deshabilitar la <option> es solo la vista: el estado puede
                // venir ya en "hecho" de la base o de un draft previo.
                disabled={
                  saving ||
                  (draftStatus === "hecho" &&
                    (estrategiaSinInteraccion ||
                      noCompetitivoSinSustento ||
                      segmentacionSinCuantia ||
                      a4SinVariablesClave ||
                      problemasCalidad.length > 0 ||
                      faltaExpediente.length > 0))
                }
                onClick={() => void onSave(draftStatus, draftData)}
                type="button"
              >
                {saving ? <Loader size={14} /> : <Save size={14} />}
                Guardar paso
              </button>
            </div>
            {/* El porqué del botón gris, en el punto del bloqueo. role="status"
                para que un lector de pantalla lo anuncie al elegir "Hecho". */}
            {motivoBloqueoHecho ? (
              <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] leading-[1.45] text-muted [&>svg]:mt-px [&>svg]:flex-none [&>svg]:text-warning" role="status">
                <Info size={13} />
                <span>
                  Para marcarlo <strong>Hecho</strong> falta: {motivoBloqueoHecho}. Puedes
                  guardarlo <strong>en curso</strong> mientras tanto.
                </span>
              </p>
            ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function FasePanel({
  faseId,
  processId,
  canManage,
  onNotified,
}: {
  faseId: FaseId;
  processId: string;
  canManage: boolean;
  onNotified?: () => void;
}) {
  // Hitos, proceso y ficha, compartidos por toda la página (ver
  // expediente-contexto.tsx). Antes cada panel los pedía por separado.
  const {
    cargando: loading,
    fijarHitos: setHitos,
    hitos,
    necesidad,
    proceso,
    recargarTodo,
  } = useExpediente();
  // Feriados de Configuración (una sola carga): para calcular vencimientos en
  // días hábiles en los campos con `calcularDesde`.
  const { setFechas: feriados } = useFeriados();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  // Copiloto · iteración 4: chat del expediente.
  const [chatAbierto, setChatAbierto] = useState(false);
  const [chatPregunta, setChatPregunta] = useState("");
  const [chatAnswer, setChatAnswer] = useState("");
  const [chatCargando, setChatCargando] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Área usuaria de la necesidad de origen, para prellenar el cronograma de A2.
  const [areaUsuariaSugerida, setAreaUsuariaSugerida] = useState("");
  // Insumos para calcular la cuantía en A2: valor estimado del expediente y PAC
  // de bienes y servicios registrado en Configuración.
  const [valorEstimado, setValorEstimado] = useState<number | null>(null);
  const [pacBienesServicios, setPacBienesServicios] = useState<number | null>(null);
  // Topes de procedimiento configurados (Configuración → Municipalidad). Null
  // hasta que llegan de parametros-segmentacion; procedimientosElegibles cae al
  // defecto 2026 mientras tanto.
  const [topesConfig, setTopesConfig] = useState<TopesProcedimiento | null>(null);
  // Días estimados del cronograma POR PROCEDIMIENTO (Configuración anual). `null`
  // hasta que llegan; el cronograma cae al defecto por procedimiento mientras tanto.
  const [diasCronogramaConfig, setDiasCronogramaConfig] = useState<DiasCronogramaPorProcedimiento | null>(null);
  const yearParam = useYearQueryParam();
  // Lo que el área usuaria estimó en la necesidad. No es el valor estimado —ese
  // lo fija A5 con el mercado (Art. 47.1)— pero si difieren mucho, alguien tiene
  // que mirarlo antes de aprobar el expediente.
  const [montoNecesidad, setMontoNecesidad] = useState<number | null>(null);
  // Fechas de la necesidad: para qué día se pidió y cuándo se remitió a la DEC.
  const [fechaRequerida, setFechaRequerida] = useState<string | null>(null);
  const [fechaRemisionDec, setFechaRemisionDec] = useState<string | null>(null);
  // Necesidad de origen, para la tarjeta de procedencia de la torre de control.
  const [necesidadOrigen, setNecesidadOrigen] = useState<{ codigo: string; status: string } | null>(null);
  // IOARR de la ficha: el Art. 153.2 clasifica sus requerimientos como básicos.
  const [esIoarr, setEsIoarr] = useState(false);
  // Responsable del área usuaria (ficha de necesidad): encabeza el PARA del
  // informe de segmentación, con su área debajo.
  const [responsableSugerido, setResponsableSugerido] = useState("");
  // Objeto y procedimiento declarados en la FICHA. Sirven de respaldo del
  // objeto de A3 —que puede no haberse sembrado en expedientes antiguos— para
  // que el filtrado por objeto funcione desde el primer momento.
  const [objetoNecesidad, setObjetoNecesidad] = useState("");
  const [procesoNecesidad, setProcesoNecesidad] = useState("");
  // Nombre de la oficina que aprueba el expediente (A8): la Gerencia Municipal,
  // la autoridad de la gestión administrativa (Art. 54.2 Reglamento). De Configuración › Áreas.
  const [autoridadSugerida, setAutoridadSugerida] = useState("");
  // Cabecera del informe de A8: correlativo, gerencia de la entidad y quien firma.
  const [numeroInformeSugerido, setNumeroInformeSugerido] = useState("");
  const [atencionSugerida, setAtencionSugerida] = useState("");
  const [remitenteSugerido, setRemitenteSugerido] = useState("");
  const [oficinasCatalogo, setOficinasCatalogo] = useState<OficinaOpcion[]>([]);

  /**
   * AL y DE del informe de A8: la OFICINA que se propone por defecto.
   *
   * Ahora estos campos guardan el NOMBRE de la oficina (el select del paso), no
   * el responsable compuesto: de la oficina, la previa y el .docx derivan a su
   * responsable en tiempo de armado. Por eso aquí basta el nombre —AL, la
   * inmediata superior de la que gestiona contrataciones (la OGA); DE, la propia
   * dependencia de contrataciones—; ya no hace falta el padrón para sembrarlos.
   */
  useEffect(() => {
    if (oficinasCatalogo.length === 0) return;
    setAutoridadSugerida(oficinaSuperiorDeLaDec(oficinasCatalogo)?.nombre ?? "");
    setRemitenteSugerido(oficinaEncargadaDeContrataciones(oficinasCatalogo)?.nombre ?? "");
  }, [oficinasCatalogo]);
  // Tipo de procedimiento ESPECÍFICO: los contratos menores no se segmentan
  // (Art. 42.1). Se deriva de `hitos.A4.data.var_a_proceso` — el catálogo de
  // los Arts. 93-95 (lib/procesos-seleccion.ts), confirmado por la DEC en la
  // Estrategia — y NO de `proceso.procedure_type`: esa columna la alimenta
  // lib/expediente-columnas.ts desde `var_a_procedimiento`, el GENÉRICO de 7
  // valores del Art. 54 (p. ej. "licitacion_publica_abreviada"), que nunca
  // coincide con un `value` de PROCESOS_SELECCION (rompía tanto el selector
  // de variantes de A9 —`VARIANTES_AMBIGUAS` usa las etiquetas específicas—
  // como `bases-docx/route.ts`, ya corregido con el mismo criterio) y que
  // además, al venir de `proceso` en vez de `hitos`, no se refrescaba en este
  // panel al guardar A4 (`proceso` viene del contexto compartido y solo se
  // recarga completo tras A5; `hitos` sí se actualiza en cada guardado).
  const procedureType = useMemo<string | null>(() => {
    const varAProceso = hitos.A4?.data?.var_a_proceso;
    if (typeof varAProceso === "string" && varAProceso.trim()) return varAProceso.trim();
    return (proceso?.procedure_type as string | null) ?? null;
  }, [hitos.A4?.data?.var_a_proceso, proceso?.procedure_type]);
  // Propuesta original del área usuaria (Art. 44.2), leída de la Necesidad. No
  // se copia al expediente: mientras está derivada, la ficha está congelada, así
  // que leerla en vivo es estable y no puede quedarse desfasada.
  const [propuestaNecesidad, setPropuestaNecesidad] = useState<Record<string, string>>({});
  // Documento de origen del requerimiento ("pedido de compra SIGA N° …"), leído
  // del Resumen de LA necesidad de ESTE expediente. Sugiere el "Documento de la
  // consulta" al añadir un proveedor en A5.
  const [documentoSugerido, setDocumentoSugerido] = useState("");

  function showToast(text: string, kind: "success" | "error" | "info" = "info") {
    setToast({ text, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }

  const pasos = useMemo(() => hitosDeFase(faseId), [faseId]);
  const progreso = useMemo(() => progresoDeFase(faseId, hitos), [faseId, hitos]);
  const acciones = useMemo(() => (faseId === "F1" ? accionesDeF1(hitos) : []), [faseId, hitos]);

  // Objeto contractual (de A3) para condicionar las variables de obra en A4.
  // Manda lo registrado en A3; si aún no está, el objeto declarado en la ficha.
  const objetoContractual =
    ((hitos.A3?.data?.objeto_contractual as string | undefined) ?? "") || objetoNecesidad;

  /**
   * Lo que la norma necesita saber para decidir qué pasos corresponden: el objeto
   * y el procedimiento. Ambos salen de la ficha y los confirma la DEC —A3 el
   * objeto, A1 la causal del Art. 55—, así que se prefiere lo confirmado y se cae
   * a lo declarado mientras tanto.
   */
  const ctxExpediente: ContextoExpediente = useMemo(
    () => ({
      acuerdoMarco: esAcuerdoMarco(procedureType, procesoNecesidad),
      causalArt55: (hitos.A1?.data?.causal_art_55 as string | undefined) ?? null,
      contratoMenor: procedureType === "contrato_menor",
      objeto: objetoContractual,
      tipoProceso: procesoNecesidad,
    }),
    [hitos.A1?.data?.causal_art_55, procedureType, objetoContractual, procesoNecesidad],
  );

  /**
   * Plegado del panel, recordado POR FASE.
   *
   * Las tres fases suman 26 pasos en la misma página. Plegarlas deja ver de un
   * vistazo en qué punto está el expediente sin recorrer tres acordeones.
   *
   * El valor inicial no es el mismo para las tres: la Fase 1 arranca ABIERTA
   * porque es donde empieza todo expediente y donde se trabaja la mayor parte
   * del tiempo; Selección y Ejecución arrancan plegadas porque hasta que no
   * llega su turno no hay nada que hacer en ellas. En cuanto el usuario decide,
   * manda su decisión.
   */
  const [abierta, setAbierta] = useState(faseId === "F1");

  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(`${CLAVE_FASE_ABIERTA}${faseId}`);
      if (guardado !== null) setAbierta(guardado === "true");
    } catch {
      // Sin localStorage se queda con el valor por defecto de su fase.
    }
  }, [faseId]);

  function alternarPanel() {
    setAbierta((previo) => {
      const siguiente = !previo;
      try {
        window.localStorage.setItem(`${CLAVE_FASE_ABIERTA}${faseId}`, String(siguiente));
      } catch {
        // Que no se pueda recordar no debe impedir plegarla ahora.
      }
      return siguiente;
    });
  }

  const perfilExpediente = useMemo(() => perfilDelExpediente(ctxExpediente), [ctxExpediente]);
  const descartados = useMemo(
    () => pasosQueNoAplican(pasos.map((p) => p.code), ctxExpediente),
    [pasos, ctxExpediente],
  );

  // Categoría de la segmentación (A2): A3 la necesita para el plazo mínimo del
  // Art. 126.2, que solo rige en rutinarios y operacionales.
  const categoriaSegmentacion = useMemo<CategoriaSegmentacion | null>(() => {
    if (faseId !== "F1") return null;
    const seg = hitos.A2?.data as SegmentacionInput | undefined;
    if (!seg) return null;
    return clasificarSegmentacion(seg).categoria;
  }, [faseId, hitos.A2]);

  // Art. 44.2: lo que el área usuaria PROPUSO en el requerimiento (A3). Se
  // enfrenta a lo que la DEC decide en la estrategia (A4); si difieren, hace
  // falta la no objeción del área usuaria (Art. 44.7).

  // Lo que A4 enfrenta es el requerimiento FINAL de A3, no la propuesta: la
  // estrategia decide sobre el requerimiento vigente (Art. 72.1).
  const propuestasA3 = useMemo<Record<string, string>>(() => {
    const a3 = hitos.A3?.data ?? {};
    const out: Record<string, string> = {};
    for (const par of PARES_PROPUESTA) {
      // f) no se ofrece al lado: la estrategia trae las CITAS legales de los
      // tipos marcados (no el texto crudo del requerimiento), así que ofrecer la
      // propuesta en bruto para "adoptarla" en f) confundiría.
      if (par.a4 === "var_f_requisitos_calificacion") continue;
      const propuesto = a3[par.a3];
      if (typeof propuesto !== "string" || !propuesto.trim()) continue;
      // El sistema de entrega de la ficha es texto libre ("Llave en mano") y en
      // A4 es un select: sin normalizar, "Usar esta propuesta" metería un valor
      // que no existe en la lista y el campo saldría vacío. Si no se reconoce,
      // no se ofrece: mejor que la DEC elija a que adopte algo que no encaja.
      if (par.a4 === "var_i_sistema_entrega") {
        const normalizado = sistemaEntregaDeTexto(propuesto);
        if (normalizado) out[par.a4] = normalizado;
        continue;
      }
      out[par.a4] = propuesto.trim();
    }
    return out;
  }, [hitos.A3]);

  // Lo que la interacción (A5) aporta a las variables k, n y s de la estrategia
  // (Art. 46.1 · 47.1: la interacción "sirve de insumo" y la estrategia se
  // analiza "considerando la información obtenida" en ella).
  const insumosA5 = useMemo(
    () => insumosDeInteraccion(hitos.A5?.data ?? {}),
    [hitos.A5],
  );

  // Art. 44.7: la DEC puede modificar el requerimiento, pero necesita la no
  // objeción del área usuaria. La modificación se detecta comparando el
  // requerimiento final (A3) con la propuesta original (la Necesidad).
  //
  // Antes esto comparaba A3 con A4, que es otra cosa: apartarse en la
  // estrategia no modifica el requerimiento, y el 72.1 deja los requisitos en
  // manos de la DEC precisamente ahí.
  const divergenciasA4 = useMemo<string[]>(() => {
    const a3 = hitos.A3?.data ?? {};
    const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    return PARES_PROPUESTA.filter((par) => {
      const propuesto = propuestaNecesidad[par.a3] ?? "";
      const final = texto(a3[par.a3]);
      // Solo hay modificación si ambos existen y difieren: un A3 aún sin llenar
      // no es una modificación, es trabajo pendiente.
      return propuesto !== "" && final !== "" && propuesto !== final;
    }).map((par) => par.label);
  }, [hitos.A3, propuestaNecesidad]);

  // Estado del expediente: las parejas de datos que ninguna fase ve por su
  // cuenta (la cuantía frente a la segmentación, la certificación frente al
  // valor estimado, el cronograma frente a la fecha que se pidió).
  const tarjetasControl = useMemo(
    () =>
      faseId === "F1"
        ? tarjetasDeControl({
            hitos,
            valorEstimado,
            montoNecesidad,
            fechaRequerida,
            pacBienesServicios,
            necesidad: necesidadOrigen,
            divergencias: divergenciasA4,
          })
        : [],
    [
      faseId,
      hitos,
      valorEstimado,
      montoNecesidad,
      fechaRequerida,
      pacBienesServicios,
      necesidadOrigen,
      divergenciasA4,
    ],
  );

  // Literales del Art. 54.2 aún incumplidos: la misma verificación que bloquea
  // A8, subida a la torre para que se vea desde arriba qué falta y en qué paso.
  const faltanExpediente = useMemo(
    () => (faseId === "F1" ? faltaParaAprobar(hitos, valorEstimado ?? null, pacBienesServicios ?? null) : []),
    [faseId, hitos, valorEstimado, pacBienesServicios],
  );

  // Insumos para que A2 calcule la cuantía. `programada` sale de A1: si la
  // contratación no está en el PAC, su monto se suma antes de sacar el 10%.
  const segParametros = useMemo<SegParametros>(() => {
    const a1 = hitos.A1?.data ?? {};
    // En una NO programada el valor estimado lo DECLARA A1 (campo obligatorio):
    // ese es el número que debe alimentar la fila "+ Esta contratación" de la
    // base y, con ella, la cuantía de A2. Si A1 no lo trae —programada, o aún
    // vacío— se cae al valor estimado del expediente (proceso/necesidad), que es
    // el comportamiento previo. Misma regla en el servidor (informe .docx).
    const valorA1 = valorEstimadoDeA1(a1);
    return {
      acuerdoMarco: esAcuerdoMarco(procedureType, procesoNecesidad),
      contratoMenor: procedureType === "contrato_menor",
      enCmn: a1.en_cmn === true,
      esIoarr,
      pacBienesServicios,
      programada: esProgramada(a1),
      programadaPresumida: programadaPresumida(a1),
      valorEstimado: valorA1 ?? valorEstimado,
      // El mismo valor de A1 se muestra además en "Otras no programadas a
      // segmentar" (fill-if-empty en el formulario). Va aparte de `valorEstimado`
      // porque son dos sumandos distintos de la base; a pedido expreso, con doble
      // conteo consciente en el Art. 125.2.
      valorEstimadoA1: valorA1,
      versionCmn: typeof a1.version_cmn === "string" ? a1.version_cmn : undefined,
      topes: topesConfig ?? undefined,
      diasCronogramaPorProcedimiento: diasCronogramaConfig ?? undefined,
    };
  }, [esIoarr, hitos.A1, pacBienesServicios, procedureType, procesoNecesidad, valorEstimado, topesConfig, diasCronogramaConfig]);

  // Nivel mínimo de interacción con el mercado que exige la segmentación (A2).
  const nivelMinimo = useMemo<NivelMinimo | null>(() => {
    if (faseId !== "F1") return null;
    const seg = hitos.A2?.data as SegmentacionInput | undefined;
    if (!seg) return null;
    const r = clasificarSegmentacion({ ...seg, objeto: seg.objeto ?? "bienes_servicios" });
    return { nivel: r.nivel, label: r.nivelLabel, categoria: r.categoriaLabel, requisito: r.nivelRequisito };
  }, [faseId, hitos]);

  // Insumos de la Fase 1: área usuaria de la necesidad (para el cronograma de
  // A2), valor estimado del expediente y PAC de bienes y servicios (para
  // calcular la cuantía en A2).
  useEffect(() => {
    if (faseId !== "F1") return;
    let cancelled = false;
    void (async () => {
      try {
        const pacRes = await fetch("/api/configuracion/parametros-segmentacion", { cache: "no-store" });
        const pac = await pacRes.json();
        if (!cancelled) {
          setPacBienesServicios(pac.pacMontoBienesServicios ?? null);
          setTopesConfig(pac.topes ?? null);
          setDiasCronogramaConfig(pac.diasCronogramaPorProcedimiento ?? null);
        }
      } catch {
        // Sin PAC registrado, A2 pide la cuantía a mano.
      }
      try {
        // Oficina que aprueba el expediente (A8): la Gerencia Municipal, es
        // decir la autoridad de la gestión administrativa. Coincidencia flexible
        // ("gerencia municipal" o "gerencia general"); sin ella, se escribe a mano.
        const oRes = await fetch("/api/oficinas", { cache: "no-store" });
        const o = await oRes.json();
        // Sin catálogo, A8 pide la autoridad a mano: degradar está bien, pero
        // tiene que quedar constancia de por qué.
        if (!oRes.ok) console.error("[fase A8] no se pudieron cargar las oficinas:", o?.error);
        // A8: gerencia de la entidad y correlativo del informe. El gerente
        // municipal no tiene cuenta en la aplicación, así que su nombre vive en
        // la ficha de la entidad, no en `profiles`.
        void (async () => {
          try {
            const [aRes, nRes] = await Promise.all([
              fetch("/api/configuracion/autoridad", { cache: "no-store" }),
              // Con el ejercicio seleccionado: el correlativo del informe sale
              // de la serie del año sobre el que se trabaja, no de la del reloj.
              fetch(`/api/numeracion/sugerido?tipo=INFORME&${yearParam}`, { cache: "no-store" }),
            ]);
            const autoridad = await aRes.json();
            const numeracion = await nRes.json();
            if (cancelled) return;
            // ATENCIÓN = AGA (Configuración → Municipalidad). Si no se registró
            // el AGA aparte, se cae al gerente: en un gobierno local la Ley los
            // identifica (Art. 25.1.b), y así la línea nunca sale en blanco.
            const nombre = String(autoridad.aga?.nombre || autoridad.nombre || "").trim();
            const cargo = String(autoridad.aga?.cargo || autoridad.cargo || "").trim();
            setAtencionSugerida([nombre, cargo].filter(Boolean).join("\n"));
            setNumeroInformeSugerido(String(numeracion.numero ?? "").trim());
          } catch {
            // Sin sugerencia, los campos de A8 se escriben a mano.
          }
        })();
        // El catálogo de oficinas alimenta los selects de AL y DE de A8 y siembra
        // sus valores por defecto (la OGA y la dependencia de contrataciones).
        const oficinas: OficinaOpcion[] = Array.isArray(o.oficinas) ? o.oficinas : [];
        // A8 · AL: la oficina inmediata superior de la que gestiona
        // contrataciones, que es a quien la DEC eleva la solicitud. Es el mismo
        // destino que el informe de segmentación (A2), resuelto con el mismo
        // helper para que los dos documentos no puedan discrepar.
        //
        // Antes se buscaba "gerencia municipal": esa es la AGA, que va en el
        // ATENCIÓN, no en el destinatario.
        if (!cancelled) setOficinasCatalogo(oficinas);
        // DE del informe de A8: la misma jefatura que firma el de segmentación
        // (A2). Se reutiliza el helper en vez de repetir la regla —que además
        // sabe no escribir "Jefe de la … JEFATURA" dos veces—.

      } catch {
        // Sin catálogo de oficinas, A8 pide la autoridad a mano.
      }
    })();
    return () => {
      cancelled = true;
    };
    // `yearParam`: al cambiar de ejercicio, la serie del correlativo es otra.
  }, [faseId, processId, yearParam]);

  /**
   * Expediente y ficha de origen. Va SIN el guard de F1 porque el objeto y el
   * procedimiento deciden qué pasos corresponden en las TRES fases (Art. 62.1):
   * lo que la Fase 2 hace con ellos —descartar el registro de participantes en un
   * no competitivo, avisar de que la subasta inversa no evalúa técnicamente— es
   * tan necesario como lo que hace la Fase 1.
   */
  /**
   * Insumos del expediente y de su ficha, del contexto.
   *
   * Antes cada panel los pedía por su cuenta: tres llamadas a
   * `/api/processes/:id` (cuatro consultas cada una) y tres a
   * `/api/necesidades/:id` para exactamente los mismos datos. Ahora se cargan
   * una vez para toda la página.
   */
  useEffect(() => {
    if (!proceso) return;
    // A2 (segmentación) necesita el valor estimado para su línea de corte (10%,
    // Art. 125). Antes de A5 el expediente aún no tiene `valor_estimado` propio, así
    // que se cae al monto PRELIMINAR de la necesidad —el mismo respaldo que ya usa el
    // informe de segmentación exportado (segmentacion-informe/route.ts)—. Sin esto, un
    // expediente recién derivado mostraba A2 en blanco aunque su necesidad traía monto.
    const necMonto = (necesidad as Record<string, unknown> | null)?.monto_estimado ?? null;
    const raw = proceso.valor_estimado ?? proceso.amount ?? necMonto;
    const n = raw === null || raw === undefined || raw === "" ? null : Number(raw);
    setValorEstimado(n !== null && Number.isFinite(n) && n > 0 ? n : null);
  }, [proceso, necesidad]);

  useEffect(() => {
    if (!necesidad) return;
    const nec = necesidad as Record<string, unknown>;
    const num = (v: unknown) => (v == null ? null : Number(v));
    setMontoNecesidad(num(nec.monto_estimado));
    setFechaRequerida((nec.fecha_requerida as string | null) ?? null);
    setFechaRemisionDec((nec.fecha_remision_dec as string | null) ?? null);
    if (nec.codigo) setNecesidadOrigen({ codigo: nec.codigo as string, status: (nec.status as string) ?? "" });
    setEsIoarr(typeof nec.ioarr === "string" && (nec.ioarr as string).trim() !== "");
    setAreaUsuariaSugerida((nec.area_usuaria as string | null) ?? "");
    setResponsableSugerido((nec.responsable as string | null) ?? "");
    // tipo_objeto de la ficha ("bienes"…) → objeto de A3 ("bien"…).
    setObjetoNecesidad(OBJETO_MAP[nec.tipo_objeto as keyof typeof OBJETO_MAP] ?? "");
    setProcesoNecesidad((nec.tipo_proceso_seleccion as string | null) ?? "");
    setDocumentoSugerido(pedidoDeResumen(nec.summary as string | null));
    const propuesta: Record<string, string> = {};
    for (const par of PARES_PROPUESTA) {
      const v = nec[par.nec];
      if (typeof v === "string" && v.trim()) propuesta[par.a3] = v.trim();
    }
    setPropuestaNecesidad(propuesta);
  }, [necesidad]);

  async function savePaso(code: string, status: HitoStatus, data: Record<string, unknown>) {
    setSavingCode(code);
    setError("");
    try {
      const res = await fetch(`/api/processes/${processId}/hitos`, {
        body: JSON.stringify({ code, status, data }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "No se pudo guardar el paso.");
        return;
      }
      setHitos(payload.hitos ?? {});
      // Guardar A5 recalcula el valor estimado del expediente en el servidor
      // (Art. 47.1). Sin releerlo, A2 seguiría calculando su línea de corte y A7
      // comprobando su certificación contra la cifra anterior.
      if (code === "A5") {
        // Recarga compartida: la cifra la leen A2 y A7, que viven en este mismo
        // panel, y la ficha de resumen, que vive en otro. Con el contexto se
        // enteran los tres a la vez y con una sola petición.
        await recargarTodo();
      }
      if (payload.notificado && onNotified) {
        onNotified();
      }
    } catch {
      setError("No se pudo conectar para guardar el paso.");
    } finally {
      setSavingCode(null);
    }
  }

  async function precargarDesdeNecesidad() {
    setSyncing(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/processes/${processId}/fase1/precarga`, { method: "POST" });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "No se pudieron traer los datos de la necesidad.");
        return;
      }
      if (payload.hitos) setHitos(payload.hitos);

      // f) Requisitos de calificación se carga TAL CUAL la propuesta del área
      // usuaria (Art. 44.2.b) en A4. La modalidad de pago (h) y el sistema de
      // entrega (i) NO se copian solos: son la elección de un valor único de la
      // DEC (Art. 72.1) y aparecen junto a su campo con "Usar esta propuesta".
      const a3Traido = (payload.hitos?.A3?.data ?? {}) as Record<string, unknown>;
      const a4Traido = (payload.hitos?.A4?.data ?? {}) as Record<string, unknown>;
      const requisitosCargados =
        typeof a4Traido.var_f_requisitos_calificacion === "string" &&
        a4Traido.var_f_requisitos_calificacion.trim().length > 0;
      const propuestasListas = PARES_PROPUESTA.filter(
        (par) =>
          par.a4 !== "var_f_requisitos_calificacion" &&
          typeof a3Traido[par.a3] === "string" &&
          (a3Traido[par.a3] as string).trim(),
      ).map((par) => par.label);

      const partes: string[] = [];
      if (payload.llenados > 0) {
        partes.push(
          `Se rellenaron ${payload.llenados} campos vacíos con datos de la necesidad (no se tocó nada de lo que ya habías escrito).`,
        );
      } else {
        partes.push("No había huecos que rellenar en A1/A3/A7.");
      }
      if (payload.requisitosRefrescados) {
        partes.push(
          "Los requisitos de calificación (f) se ACTUALIZARON: traen la cita legal de los tipos del Art. 72.3 que el área usuaria marcó en la necesidad (los tipos cambiaron). Concreta el detalle de cada uno sobre esa base.",
        );
      } else if (requisitosCargados) {
        partes.push(
          "En A4, los requisitos de calificación (f) traen la cita legal (Art. 72.3) de los tipos que el área usuaria marcó en la necesidad. Concreta el detalle de cada uno; la DEC los establece (Art. 72.1).",
        );
      }
      if (propuestasListas.length > 0) {
        partes.push(
          `En A4 se trajo la propuesta del área usuaria para ${propuestasListas.join(" y ")}: se rellenó donde el campo estaba vacío. La DEC puede cambiarla (Art. 72.1); si ya habías escrito algo, se respetó y la propuesta queda al lado.`,
        );
      }
      setNotice(partes.join(" "));
    } catch {
      setError("No se pudo conectar para traer los datos de la necesidad.");
    } finally {
      setSyncing(false);
    }
  }

  // Copiloto · chat: pregunta sobre este expediente. El servidor responde
  // combinando el estado determinista (checklist) con el RAG de la norma.
  async function preguntarCopiloto() {
    const q = chatPregunta.trim();
    if (q.length < 2) return;
    setChatCargando(true);
    setChatAnswer("");
    try {
      const res = await fetch(`/api/processes/${processId}/copiloto/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta: q }),
      });
      const payload = await res.json();
      setChatAnswer(res.ok ? (payload.answer ?? "Sin respuesta.") : (payload.error ?? "No se pudo responder."));
    } catch {
      setChatAnswer("No se pudo conectar con el copiloto.");
    } finally {
      setChatCargando(false);
    }
  }

  const completados = progreso.completados;
  const total = progreso.total;

  // Ruta crítica de la Fase 1. El cuello de botella real no es normativo: la
  // CUANTÍA la fija A5 (interacción, Art. 47.1) y sin ella A7 (certificación) y
  // la aprobación no avanzan; y A2 (segmentación) debe cerrarse antes porque
  // fija el nivel de interacción que A5 debe alcanzar. Como A3/A4 se pueden
  // rellenar sin cuantía, es fácil dejar A2/A5 abiertos y que la fase se
  // estanque sin que se note. Se señala la dependencia abierta MÁS AGUAS ARRIBA,
  // con salto directo, para que se cierre pronto.
  const rutaCritica: { paso: string; texto: ReactNode } | null = (() => {
    if (faseId !== "F1" || loading) return null;
    const abierto = (code: string) => {
      const st = hitos[code]?.status ?? "pendiente";
      return !descartados.includes(code) && st !== "hecho" && st !== "na";
    };
    const a2 = (hitos.A2?.data ?? {}) as Record<string, unknown>;
    if (abierto("A2") && Object.keys(a2).length > 0) {
      return {
        paso: "A2",
        texto: (
          <>
            Cierra <strong>A2 · Segmentación</strong>: fija el nivel de interacción que A5 debe
            alcanzar y la línea de corte de la cuantía. Es el primer eslabón de la fase, y quedó a
            medias.
          </>
        ),
      };
    }
    if (abierto("A5") && (valorEstimado == null || valorEstimado <= 0)) {
      return {
        paso: "A5",
        texto: (
          <>
            La <strong>cuantía</strong> del expediente la fija <strong>A5 · Interacción con el
            mercado</strong> (Art. 47.1). Sin cerrarla no hay cuantía de la contratación, y <strong>A7</strong>{" "}
            (certificación) y la aprobación quedan bloqueadas.
          </>
        ),
      };
    }
    return null;
  })();

  return (
    <section className="processPanel faseUnoPanel">
      <div className="processPanelHead">
        <ClipboardCheck size={17} />
        <h3 className="panelTitulo">
          {faseId === "F1"
            ? "Fase 1 · Actuaciones Preparatorias"
            : faseId === "F2"
              ? "Fase 2 · Selección"
              : "Fase 3 · Ejecución Contractual"}
        </h3>
        {faseId === "F1" ? <span className="faseUnoBadge">Guía R.D. 019-2026-EF/54.01</span> : null}
        {faseId === "F1" && canManage ? (
          <button
            className="secondaryButton compactButton faseSyncBtn"
            disabled={syncing}
            onClick={() => void precargarDesdeNecesidad()}
            title="Trae de la necesidad los datos que aún falten (CMN/PAC, requerimiento, presupuesto). Solo rellena huecos: NO borra ni cambia lo que ya escribiste en el expediente."
            type="button"
          >
            <RefreshCw className={syncing ? "spinIcon" : undefined} size={13} />
            {syncing ? "Trayendo datos…" : "Traer datos nuevos de la necesidad"}
          </button>
        ) : null}
        <button
          aria-controls={`fase-detalle-${faseId}`}
          aria-expanded={abierta}
          className="panelToggle"
          onClick={alternarPanel}
          type="button"
        >
          {abierta ? "Ocultar pasos" : `Ver los ${total} pasos`}
          {abierta ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      <div className="grid gap-1.5">
        <div className="flex justify-between text-[13px] text-muted [&>strong]:text-brand-dark">
          <span>{completados} de {total} pasos completados</span>
          <strong>{progreso.porcentaje}%</strong>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-brand-soft">
          <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-dark transition-[width] duration-300" style={{ width: `${progreso.porcentaje}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap gap-1 pt-2 pb-1">
        {pasos.map((paso) => {
          const st = hitos[paso.code]?.status ?? "pendiente";
          const noAplica = descartados.includes(paso.code);
          return (
            // Un <button> y no un <span onClick>: sin él el punto no recibía
            // foco ni respondía a Enter, así que el índice entero quedaba fuera
            // del alcance de quien navega con teclado.
            <button
              key={paso.code}
              className={cn(
                "inline-flex size-6 cursor-pointer items-center justify-center rounded-[6px] p-0 !text-[11px] !font-bold transition-[background,transform] duration-150 hover:scale-[1.15] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                DOT_ESTADO[st],
                noAplica && "line-through opacity-[0.45]",
              )}
              data-no-aplica={noAplica ? "true" : undefined}
              title={
                noAplica
                  ? `${paso.label} — no corresponde a este procedimiento`
                  : `${paso.label}${RESUMEN_LLANO[paso.code] ? ` · ${RESUMEN_LLANO[paso.code]}` : ""} (${st})`
              }
              // El texto visible es solo un número: sin esto se oiría "1, botón".
              aria-label={`${paso.code}: ${paso.label}`}
              onClick={() => {
                // Abre el panel además de seleccionar el paso: con el detalle
                // plegado, pulsar un punto parecería no hacer nada.
                if (!abierta) alternarPanel();
                setExpanded(paso.code);
              }}
              type="button"
            >
              {paso.code.replace(/^[A-Z]/, "")}
            </button>
          );
        })}
      </div>

      {/* De qué expediente estamos hablando y qué implica, en una línea y antes
          de los pasos. Sin esto el usuario ve ocho casillas atenuadas sin saber
          por qué, y la respuesta —"es un no competitivo"— está tres pantallas
          más arriba, en la ficha. */}
      {!loading && perfilExpediente ? (
        <div className="mt-0.5 mb-2.5 grid gap-1 rounded-[8px] border border-line bg-brand-soft px-[11px] py-[9px] text-[12px] leading-normal">
          <span className="flex items-center gap-1.5 font-semibold text-ink [&>svg]:flex-none [&>svg]:text-brand">
            <Info size={13} /> {perfilExpediente}
          </span>
          {descartados.length > 0 ? (
            <span className="text-muted">
              Por norma no corresponden {descartados.length} de {pasos.length} pasos:{" "}
              {descartados.map((code, i) => (
                <Fragment key={code}>
                  {i > 0 ? ", " : ""}
                  <button
                    className="px-px !font-semibold text-brand hover:underline"
                    onClick={() => setExpanded(code)}
                    type="button"
                  >
                    {code}
                  </button>
                </Fragment>
              ))}
              . Ábrelos para ver el artículo y cerrarlos como “No aplica”.
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Ruta crítica: qué cerrar YA para desatascar la cuantía y, con ella, el
          resto de la fase. Va fuera del acordeón y con salto directo al paso. */}
      {rutaCritica && canManage ? (
        <div className="faseRutaCritica" role="status">
          <Lightbulb size={14} />
          <span>
            <strong>Ruta crítica.</strong> {rutaCritica.texto}{" "}
            <button className="faseRutaCriticaIr" onClick={() => setExpanded(rutaCritica.paso)} type="button">
              Ir a {rutaCritica.paso} <ChevronRight size={12} />
            </button>
          </span>
        </div>
      ) : null}

      {/* El resultado de guardar/traer datos es asíncrono: sin role, un lector de
          pantalla no anuncia ni el error ni la confirmación. `alert` interrumpe
          para el fallo (hay que enterarse); `status`/polite no roba el foco para
          el aviso de éxito. */}
      {error ? <p className="formMessage errorText" role="alert">{error}</p> : null}
      {notice ? <p className="formMessage successText" role="status" aria-live="polite">{notice}</p> : null}

      {/* El estado del expediente va ANTES de los pasos: ninguna de las
          contradicciones que enseña vive dentro de un paso, así que dejarlas
          dentro del acordeón era esconderlas. */}
      {!loading && tarjetasControl.length > 0 ? (
        <TorreControl
          faltan={faltanExpediente}
          onAbrirPaso={(code) => setExpanded(code)}
          tarjetas={tarjetasControl}
        />
      ) : null}

      {/* Copiloto · iteración 4: chat del expediente. Se presenta como PANEL
          LATERAL (mismo patrón que el copiloto del requerimiento en Necesidades):
          un botón lo abre y el panel `.copiloto` —fijo a la derecha— alberga la
          conversación. Misma funcionalidad: responde con el estado real + la
          norma; si algo no consta, lo dice. */}
      {faseId === "F1" && canManage && !loading ? (
        <button
          className="secondaryButton compactButton faseCopilotoBtn"
          onClick={() => setChatAbierto(true)}
          type="button"
        >
          <Sparkles size={14} /> Copiloto del expediente
        </button>
      ) : null}

      {chatAbierto ? (
        <aside className="copiloto" aria-label="Copiloto del expediente">
          <header className="copilotoHead">
            <span className="copilotoTitulo">
              <Sparkles size={15} /> Copiloto del expediente
            </span>
            <button className="iconButton" onClick={() => setChatAbierto(false)} title="Cerrar" type="button">
              <X size={16} />
            </button>
          </header>
          <p className="copilotoSub">
            Pregunta sobre el estado de este expediente y sobre la norma. Responde con los datos
            reales del expediente; si algo no consta, lo dice.
          </p>
          <form
            className="mt-0.5 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void preguntarCopiloto();
            }}
          >
            <Input
              className="min-w-0 flex-1"
              disabled={chatCargando}
              onChange={(e) => setChatPregunta(e.target.value)}
              placeholder="¿Qué falta para aprobar? · ¿Qué dice el Art. 47?"
              value={chatPregunta}
            />
            <button
              className="inline-flex flex-none items-center gap-[5px] rounded-[7px] border border-brand bg-brand px-3.5 py-[7px] !text-[12.5px] !font-semibold text-white disabled:cursor-default disabled:opacity-[.55]"
              disabled={chatCargando || chatPregunta.trim().length < 2}
              type="submit"
            >
              {chatCargando ? <Loader className="spinIcon" size={14} /> : "Preguntar"}
            </button>
          </form>
          <div className="copilotoLog">
            {chatAnswer ? (
              <div className="mt-2.5 whitespace-pre-wrap rounded-[8px] border border-line bg-surface px-3 py-2.5 text-[12.8px] leading-[1.55] text-ink" role="status" aria-live="polite">
                {chatAnswer}
              </div>
            ) : (
              <p className="copilotoVacio">
                Escribe una pregunta para empezar. P. ej. «¿qué falta para aprobar?» o «¿qué dice el
                Art. 53 sobre la certificación?».
              </p>
            )}
          </div>
        </aside>
      ) : null}

      {/* Aquí empieza lo que se pliega. Fuera quedan a propósito el avance, el
          índice de pasos, el perfil y la torre de control: el avance y el índice
          resumen la fase de un vistazo —que es para lo que se pliega—, y las
          contradicciones de la torre son advertencias. Esconder una advertencia
          detrás de un clic es la forma segura de que nadie la lea. */}
      <div className="faseDetalle" hidden={!abierta} id={`fase-detalle-${faseId}`}>
      {loading ? (
        <p className="sideMuted">
          <Loader size={14} /> Cargando pasos…
        </p>
      ) : faseId === "F1" ? (
        <div className="accionGroups">
          {acciones.map((accion) => (
            <div
              className="accionGroup"
              key={accion.id}
              data-precondicion={accion.precondicion ? "true" : undefined}
              data-opcional={accion.opcional ? "true" : undefined}
            >
              <div className="accionGroupHead">
                <span
                  className="accionNumeral"
                  title={`Numeración de la Guía de Actuaciones Preparatorias (${accion.numeral})`}
                >
                  {accion.numeral}
                </span>
                <span className="accionLabel">{accion.label}</span>
                {accion.opcional ? <span className="accionOpcional">opcional</span> : null}
                <span className="accionMiniProgress">
                  {accion.completados}/{accion.total}
                </span>
              </div>
              <ol className="m-0 grid list-none gap-2 p-0">
                {accion.hitos.map((paso) => (
                  <PasoCard
                    canManage={canManage}
                    code={paso.code}
                    estado={hitos[paso.code]}
                    expanded={expanded === paso.code}
                    areaUsuariaSugerida={areaUsuariaSugerida}
                    responsableSugerido={responsableSugerido}
                    autoridadSugerida={autoridadSugerida}
                    numeroInformeSugerido={numeroInformeSugerido}
                    atencionSugerida={atencionSugerida}
                    remitenteSugerido={remitenteSugerido}
                    oficinasCatalogo={oficinasCatalogo}
                    key={paso.code}
                    label={paso.label}
                    nivelMinimo={nivelMinimo}
                    objetoContractual={objetoContractual}
                    procesoNecesidad={procesoNecesidad}
                    procedureType={procedureType}
                    onSave={(status, data) => savePaso(paso.code, status, data)}
                    onToggle={() => setExpanded((cur) => (cur === paso.code ? null : paso.code))}
                    processId={processId}
                    responsable={paso.responsable}
                    saving={savingCode === paso.code}
                    categoriaSegmentacion={categoriaSegmentacion}
                    divergencias={divergenciasA4}
                    documentoSugerido={documentoSugerido}
                    insumosA5={paso.code === "A4" ? insumosA5 : undefined}
                    insumosF1={insumosDePaso(paso.code, hitos)}
                    aplicabilidad={aplicabilidadHito(paso.code, ctxExpediente)}
                    regimenA4={regimenDe(hitos)}
                    estandarizadoA3={
                      hitos.A3?.data?.estandarizado === true || hitos.A3?.data?.estandarizado === "si"
                    }
                    hitosA1={hitos.A1?.data ?? {}}
                    hitosA2={hitos.A2?.data ?? {}}
                    hitosA5={hitos.A5?.data ?? {}}
                    hitosTodos={hitos}
                    feriados={feriados}
                    valorEstimado={valorEstimado}
                    pacBienesServicios={pacBienesServicios}
                    montoNecesidad={montoNecesidad}
                    fechaRequerida={fechaRequerida}
                    fechaRemisionDec={fechaRemisionDec}
                    onAbrirPaso={(c) => setExpanded(c)}
                    propuestas={paso.code === "A4" ? propuestasA3 : undefined}
                    segParametros={segParametros}
                    showToast={showToast}
                    statusA5={hitos.A5?.status}
                  />
                ))}
              </ol>
            </div>
          ))}
        </div>
      ) : (
        <ol className="m-0 grid list-none gap-2 p-0">
          {pasos.map((paso) => (
            <PasoCard
              aplicabilidad={aplicabilidadHito(paso.code, ctxExpediente)}
              canManage={canManage}
              code={paso.code}
              estado={hitos[paso.code]}
              expanded={expanded === paso.code}
              insumosF1={insumosDePaso(paso.code, hitos)}
              key={paso.code}
              label={paso.label}
              onSave={(status, data) => savePaso(paso.code, status, data)}
              onToggle={() => setExpanded((cur) => (cur === paso.code ? null : paso.code))}
              processId={processId}
              responsable={paso.responsable}
              saving={savingCode === paso.code}
              hitosTodos={hitos}
              feriados={feriados}
              showToast={showToast}
            />
          ))}
        </ol>
      )}

      {!loading && !canManage ? (
        <p className="m-0 flex items-center gap-1.5 text-[12px] text-muted">
          <CheckCircle2 size={13} /> Vista de solo lectura.
        </p>
      ) : null}
      </div>

      {toast ? (
        <div className={`faseToast faseToast-${toast.kind}`} role="status">
          {toast.kind === "success" ? <CheckCircle2 size={15} /> : <Info size={15} />}
          <span>{toast.text}</span>
        </div>
      ) : null}
    </section>
  );
}
