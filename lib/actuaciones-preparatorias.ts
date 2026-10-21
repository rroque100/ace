// Detalle de dominio de la FASE 1 · Actuaciones Preparatorias (Ley N° 32069).
//
// Fuente: "Guía de Actuaciones Preparatorias" del MEF/OECE, versión vigente
// R.D. 019-2026-EF/54.01 (Ley 32069 y su Reglamento D.S. 009-2025-EF, modificado
// por D.S. 001-2026-EF). El catálogo de sub-pasos (códigos A1..A10, orden y
// responsable resumido) vive en lib/procurement-fases.ts; aquí se agrega el
// contenido procedimental: objetivo, base legal, formatos/artefactos y el
// esquema de formulario que cada paso persiste en el jsonb `hitos[code].data`.

import { FUENTES_ANEXO1, HERRAMIENTAS_ANEXO1, tipoDeNivel } from "./anexo1-interaccion";
import {
  OPCIONES_AGRUPACION,
  OPCIONES_MODALIDAD_EFICIENTE,
  OPCIONES_SISTEMA_ENTREGA,
  OTRAS_VARIABLES_CAMPOS,
} from "./estrategia-formato";
import { CAUSALES_ART_55 } from "./regimen-seleccion";
import { PROCESOS_COMPETITIVOS_OPCIONES } from "./procesos-seleccion";
import { diasCalendarioEntre, restarDiasCalendario } from "./cronograma-fechas";

export type TipoCampo =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "boolean"
  | "date"
  // Editor estructurado de requisitos de calificación (obligatorios/facultativos).
  | "requisitos"
  // Tabla de proveedores consultados (Anexo N° 1): RUC, razón social,
  // documento, fecha y propuesta económica.
  | "proveedores"
  // o) Cronograma estimado: fase, actividad, inicio y fin.
  | "cronograma"
  // p) Roles y responsabilidades: rol y etapa de la fase de selección.
  | "roles"
  // g) Factores de evaluación: nombre y sustento.
  | "factores"
  // j) Puntos no negociables: punto y su sustento (tabla de 2 columnas).
  | "puntos"
  // l) Tabla de adelantos: tres filas fijas (marcar, mecanismo de garantía, %).
  | "adelantos"
  // A6) Integrantes del panel evaluador: se eligen del catálogo de usuarios.
  | "evaluadores"
  // B2) Registro de participantes: RUC, razón social, admitido/no y motivo.
  | "postores"
  // B6) Orden de prelación de la evaluación: razón social, puntaje y admitida.
  | "puntajes";

export type CampoFormulario = {
  name: string;
  label: string;
  tipo: TipoCampo;
  opciones?: { value: string; label: string }[];
  ayuda?: string;
  placeholder?: string;
  // Pista de maquetación: "full" ocupa toda la fila.
  ancho?: "full" | "half";
  /** Si es true, el campo debe llenarse obligatoriamente */
  required?: boolean;
  /**
   * Campo de solo lectura: se muestra su valor pero no se edita en el formulario.
   * Es para datos que el paso HEREDA de otro sitio y no decide aquí —p. ej. a)
   * Tipo de procedimiento, que sale del "Tipo de proceso de selección" de la ficha
   * de la necesidad y no se elige de una lista en A4.
   */
  soloLectura?: boolean;
  /** Referencia legal que sustenta el campo */
  baseLegal?: string;
  /**
   * Subtítulo de agrupación visual. Los campos con el mismo `grupo` consecutivo
   * se muestran bajo un mismo encabezado; sin `grupo` el paso se renderiza plano
   * (comportamiento por defecto). Solo se usa para partir A4 (Art. 46.1), que
   * tiene ~20 variables, en bloques legibles.
   */
  grupo?: string;
  /**
   * El campo solo se muestra si otro tiene cierto valor.
   *
   * El formato condiciona secciones enteras ("Si seleccionó SÍ, debe registrar
   * lo siguiente…"). Enseñarlas siempre invita a rellenar lo que no procede, y
   * esconderlas tras el desplegable de opcionales hace que no se encuentren
   * cuando SÍ proceden.
   */
  dependeDe?: { campo: string; valor: string | string[] };

  /**
   * El campo es obligatorio SOLO cuando otro tiene cierto valor.
   *
   * Distinto de `dependeDe`, que OCULTA el campo cuando no se cumple. Aquí el
   * campo se ve siempre —puede rellenarse igual— pero solo bloquea cuando la
   * condición lo hace exigible. Es el caso de la versión del CMN: si se afirma
   * que la necesidad está incluida en el CMN, hay que decir en cuál; si no se
   * afirma, no hay versión que citar y exigirla sería absurdo.
   *
   * Los valores se comparan como texto, así que un booleano se declara como
   * "true".
   */
  requeridoSi?: { campo: string; valor: string | string[] };

  /**
   * El campo solo se muestra para estos objetos contractuales
   * ("bien" | "servicio" | "obra" | "consultoria_obra").
   *
   * La Fase 1 pide los mismos ~46 campos para una compra de útiles y para una
   * obra. Buena parte de la norma sí distingue —el Art. 44.4 acota las
   * prestaciones accesorias a bienes y obras, el 154.1 es de obras— y sin este
   * eje el área usuaria tiene que decidir campo por campo si le toca, que es
   * justo lo que el articulado ya responde.
   *
   * Con el objeto sin definir NO se filtra: quien todavía no lo eligió debe
   * poder ver el campo.
   */
  mostrarParaObjeto?: string[];

  /**
   * El campo se muestra "NO CORRESPONDE." (solo lectura) mientras OTRO campo esté
   * VACÍO, y se vuelve editable en cuanto ese campo tiene valor.
   *
   * Distinto de `dependeDe`, que OCULTA: aquí el campo se ve siempre, pero deja
   * claro que no aplica en vez de invitar a rellenarlo. Es el caso del documento
   * que sustenta el no competitivo: sin causal del Art. 55 no hay documento que
   * citar, así que la casilla dice "NO CORRESPONDE." en lugar de una caja vacía.
   */
  noCorrespondeSalvoQue?: { campo: string };

  /**
   * En un booleano, responder NO cuenta como respuesta.
   *
   * Por defecto un check sin marcar se considera "sin llenar", que es lo
   * correcto en los que afirman un hecho exigido ("está incluida en el CMN"):
   * dejarlo en No no completa nada. Pero hay preguntas donde el No es una
   * respuesta final y legítima —"¿es contratación programada?"— y sin esta
   * marca el paso se quedaba pidiendo un campo eternamente: una contratación no
   * programada no podía completar A1 jamás.
   */
  negativaEsRespuesta?: boolean;

  /**
   * Contenido que la norma exige "como mínimo, de corresponder": no bloquea el
   * guardado, pero tampoco es relleno. Se muestra aunque el paso esté en modo
   * "solo obligatorios" — si se oculta, nadie lo llena y el documento sale
   * incompleto.
   */
  recomendado?: boolean;

  /**
   * Enlace oficial para verificar el dato del campo (p. ej. las bases estándar
   * vigentes en el portal del MEF). Se muestra como enlace junto a la ayuda:
   * la versión de un documento normativo no debería confiarse a lo que recuerde
   * la DEC cuando la norma está a un clic.
   */
  enlace?: { texto: string; url: string };

  /**
   * Campo de fecha CALCULABLE a partir de otra fecha del expediente (p. ej. la
   * fecha de consentimiento de la buena pro = fecha de otorgamiento + plazo).
   * La UI ofrece un botón "Calcular" que suma el plazo (en días hábiles —con
   * feriados— o calendario) a la fecha base tomada de otro hito/campo. Es una
   * sugerencia editable; nunca sobrescribe sola.
   */
  calcularDesde?: {
    hito: string;
    campo: string;
    dias: number;
    habiles: boolean;
    etiqueta: string;
    /**
     * Plazos que dependen del procedimiento de selección elegido en A4
     * (var_a_procedimiento). Si el procedimiento está en el mapa, manda sobre
     * `dias`; si no, se usa `dias`.
     */
    diasPorProcedimiento?: Readonly<Record<string, number>>;
  };

  /**
   * Un campo `number` que representa dinero: se muestra con separador de miles
   * (,) y dos decimales (.) —"1,234,567.89"— en reposo, y en crudo al editarlo.
   * El input nativo type="number" no puede agrupar miles, así que la UI usa un
   * input de texto formateado que igualmente guarda un número (no una cadena),
   * para que la cuantía siga siendo comparable en A7/A8 y en los exportadores.
   */
  moneda?: boolean;
  /**
   * Prefijo fijo que se muestra dentro del campo de texto, antes del valor (p. ej.
   * "Memorándum N° "). El input sigue guardando SOLO lo que se teclea (el número),
   * así que quien lo consume no lo duplica; el prefijo es una ayuda visual para que
   * en el formulario se lea la referencia completa.
   */
  prefijo?: string;
  /**
   * Fija el campo a la columna 1 o 2 del grid del paso (en la disposición de dos
   * columnas). Sirve para agrupar en una columna una lista de campos dejando la
   * otra con un solo campo. En móvil (una columna) no aplica. Los campos que van
   * DEBAJO de un bloque así deben ir a ancho completo, o el grid los mete en los
   * huecos que queden en la otra columna.
   */
  columna?: 1 | 2;
  /**
   * El campo es un `select` cuyas opciones son las OFICINAS de Configuración →
   * Oficinas (el panel las inyecta). El valor guardado es el NOMBRE de la oficina;
   * el documento que lo consume resuelve su responsable. Lo usan los destinatarios
   * de los informes (A8 · AL/DE, A7 · AL/ATENCIÓN de la solicitud).
   */
  opcionesOficinas?: boolean;
  /**
   * No se muestra en el formulario, pero SIGUE existiendo: se siembra y el
   * documento (previa y exportable) lo consume igual. Para datos que el usuario no
   * necesita tocar pero que deben salir en el formato con su valor por defecto —el
   * DE (remitente) de A8, que es siempre la dependencia de contrataciones—.
   */
  oculto?: boolean;
};

export type PasoDetalle = {
  code: string;
  // Acción oficial de la guía (I..VII) a la que pertenece el sub-paso.
  accionGuia: string;
  baseLegal: string;
  objetivo: string;
  responsables: string;
  // Artefactos/formatos que produce el paso.
  formatos: string[];
  // Campos del formulario del paso (se guardan en hitos[code].data).
  campos: CampoFormulario[];
  // Marca de renderizado especial (formularios con lógica propia).
  especial?: "segmentacion";
  // Nota o consideración clave para el usuario.
  nota?: string;
};

// ===== Segmentación de las contrataciones (Art. 42 / 125 / 153 del Reglamento) =====

export type ObjetoSegmentacion = "bienes_servicios" | "obras_consultoria_obras";

/**
 * Objeto de la segmentación (A2) que corresponde al "Tipo de objeto" de la ficha.
 * La segmentación es BINARIA (Art. 125 vs 153): los cuatro objetos de la necesidad
 * —bien, servicio, obra, consultoría de obra— se agrupan en dos. Se usa para
 * proponer el valor por defecto de A2; devuelve undefined si el objeto no se
 * reconoce (no se fuerza un valor). Acepta el objeto en singular ("bien", de A3)
 * y en plural ("bienes", tipo_objeto de la ficha).
 */
export function objetoSegmentacionDe(objeto: string | null | undefined): ObjetoSegmentacion | undefined {
  const v = (objeto ?? "").trim().toLowerCase();
  if (!v) return undefined;
  if (/^(obra|consultor)/.test(v)) return "obras_consultoria_obras";
  if (/^(bien|servicio)/.test(v)) return "bienes_servicios";
  return undefined;
}

export type CategoriaSegmentacion =
  | "rutinaria"
  | "operacional"
  | "critico"
  | "estrategico"
  | "contratacion_basica"
  | "contratacion_avanzada";

export type NivelInteraccion =
  | "indagacion_basica"
  | "indagacion_avanzada"
  | "consulta_mercado_basica"
  | "consulta_mercado_avanzada";

export const NIVEL_INTERACCION_META: Record<
  NivelInteraccion,
  { label: string; requisito: string; tipo: "indagacion" | "consulta_mercado" }
> = {
  indagacion_basica: {
    label: "Indagación básica",
    requisito: "Al menos una (1) fuente de información.",
    tipo: "indagacion",
  },
  indagacion_avanzada: {
    label: "Indagación avanzada",
    // Art. 48.3: la avanzada exige DOS O MÁS fuentes. El contacto con proveedores
    // es una fuente OPCIONAL del 48.2 ("se puede solicitar información a los
    // potenciales proveedores"), no un requisito: por eso va como "puede incluir".
    requisito: "Dos (2) o más fuentes de información; puede incluir solicitar información a potenciales proveedores.",
    tipo: "indagacion",
  },
  consulta_mercado_basica: {
    label: "Consulta al mercado básica",
    requisito: "Al menos una (1) herramienta de consulta al mercado.",
    tipo: "consulta_mercado",
  },
  consulta_mercado_avanzada: {
    label: "Consulta al mercado avanzada",
    requisito: "Dos (2) o más herramientas de consulta al mercado.",
    tipo: "consulta_mercado",
  },
};

export const CATEGORIA_SEGMENTACION_META: Record<
  CategoriaSegmentacion,
  { label: string; nivel: NivelInteraccion; objeto: ObjetoSegmentacion }
> = {
  rutinaria: { label: "Rutinaria", nivel: "indagacion_basica", objeto: "bienes_servicios" },
  operacional: { label: "Operacional", nivel: "indagacion_avanzada", objeto: "bienes_servicios" },
  critico: { label: "Crítico", nivel: "consulta_mercado_basica", objeto: "bienes_servicios" },
  estrategico: { label: "Estratégico", nivel: "consulta_mercado_avanzada", objeto: "bienes_servicios" },
  contratacion_basica: {
    label: "Contratación básica",
    nivel: "consulta_mercado_basica",
    objeto: "obras_consultoria_obras",
  },
  contratacion_avanzada: {
    label: "Contratación avanzada",
    nivel: "consulta_mercado_avanzada",
    objeto: "obras_consultoria_obras",
  },
};

// Condiciones de ALTO RIESGO para bienes y servicios (numeral 125.3 del Art. 125).
// Condiciones de ALTO RIESGO para bienes y servicios.
//
// Ojo con la fuente: el numeral 125.3 del Reglamento lista SOLO TRES
// condiciones (i, ii, iii). La cuarta —"no ha sido contratado anteriormente"—
// NO está en el Reglamento: la añade la Guía de Actuaciones Preparatorias, que
// desarrolla la norma. Por eso cada condición lleva su `fuente`: atribuirlas
// todas al 125.3 haría que quien verifique el Reglamento encuentre solo tres y
// observe el informe.
export const CONDICIONES_RIESGO_BS: {
  key: string;
  label: string;
  fuente: "reglamento" | "guia";
}[] = [
  {
    key: "desierto_2anios",
    fuente: "reglamento",
    label:
      "En los 2 últimos años previos a la convocatoria, el procedimiento para contratar el objeto fue declarado desierto.",
  },
  {
    key: "postores_bajos",
    fuente: "reglamento",
    label:
      "El promedio de postores en procedimientos similares (2 últimos años) fue ≤ 3 (bienes) o ≤ 2 (servicios).",
  },
  {
    key: "disponibilidad_limitada",
    fuente: "reglamento",
    label: "Disponibilidad limitada en el mercado por las características o especialización del bien o servicio.",
  },
  {
    key: "no_contratado_antes",
    fuente: "guia",
    label: "Es un bien o servicio que no ha sido contratado anteriormente por la entidad contratante.",
  },
];

// Criterios CONCURRENTES que definen "contratación básica" en obras y
// consultoría de obras (Capítulo I, Título V del Reglamento, Art. 153).
export const CRITERIOS_OBRA_BASICA: { key: string; label: string }[] = [
  {
    key: "baja_innovacion_complejidad",
    label: "La inversión es de bajo grado de innovación y de complejidad baja o media.",
  },
  {
    key: "experiencia_previa",
    label: "La entidad contratante ha ejecutado previamente obras o consultorías de obras similares.",
  },
  {
    key: "postores_suficientes",
    label: "En los 2 últimos años el promedio de postores en procedimientos con objeto similar fue ≥ 3.",
  },
  {
    key: "no_saldo_obra",
    label: "El objeto contractual no corresponde a un saldo de obra.",
  },
];

export type SegmentacionInput = {
  objeto: ObjetoSegmentacion;
  // Bienes y servicios:
  cuantiaAlta?: boolean; // > 10% del monto total del PAC para el objeto
  condicionesRiesgo?: string[]; // keys de CONDICIONES_RIESGO_BS marcadas
  // Obras y consultoría de obras:
  criteriosBasica?: string[]; // keys de CRITERIOS_OBRA_BASICA cumplidos
  /**
   * El requerimiento corresponde a una IOARR.
   *
   * Art. 153.2, última frase: "Los requerimientos de IOARR se consideran
   * básicos". Es una clasificación AUTOMÁTICA que no depende de los cuatro
   * criterios: sin ella, una IOARR que no cumpliera alguno —p. ej. que la
   * entidad no hubiera ejecutado obras similares— salía avanzada y se le exigía
   * consulta al mercado avanzada.
   */
  esIoarr?: boolean;
  // Compra centralizada o corporativa: fuerza categoría (estratégico / contratación avanzada).
  centralizada?: boolean;
};

export type SegmentacionResultado = {
  /** La categoría salió básica por ser IOARR, no por cumplir los criterios. */
  porIoarr?: boolean;
  categoria: CategoriaSegmentacion;
  categoriaLabel: string;
  nivel: NivelInteraccion;
  nivelLabel: string;
  nivelRequisito: string;
  riesgoAlto: boolean;
  cuantiaAlta: boolean;
};

// Clasifica una contratación según los criterios de la guía y devuelve la
// categoría de segmentación y el nivel mínimo de interacción con el mercado.
export function clasificarSegmentacion(input: SegmentacionInput): SegmentacionResultado {
  // Regla de compras centralizadas o corporativas (Importante, Cap. I Guía):
  // bienes/servicios → estratégico; obras/consultoría → contratación avanzada.
  if (input.centralizada) {
    const categoria: CategoriaSegmentacion =
      input.objeto === "obras_consultoria_obras" ? "contratacion_avanzada" : "estrategico";
    const meta = CATEGORIA_SEGMENTACION_META[categoria];
    const nivelMeta = NIVEL_INTERACCION_META[meta.nivel];
    return {
      categoria,
      categoriaLabel: meta.label,
      nivel: meta.nivel,
      nivelLabel: nivelMeta.label,
      nivelRequisito: nivelMeta.requisito,
      riesgoAlto: true,
      cuantiaAlta: categoria === "estrategico",
    };
  }

  if (input.objeto === "obras_consultoria_obras") {
    // Básica solo si cumple TODOS los criterios concurrentes (Art. 153.2 i-iv);
    // si falta alguno, avanzada (Art. 153.3).
    //
    // Salvo las IOARR: el propio 153.2 las declara básicas sin más condición.
    const cumplidos = new Set(input.criteriosBasica ?? []);
    const esBasica = input.esIoarr === true || CRITERIOS_OBRA_BASICA.every((c) => cumplidos.has(c.key));
    const categoria: CategoriaSegmentacion = esBasica ? "contratacion_basica" : "contratacion_avanzada";
    const meta = CATEGORIA_SEGMENTACION_META[categoria];
    const nivelMeta = NIVEL_INTERACCION_META[meta.nivel];
    return {
      categoria,
      categoriaLabel: meta.label,
      nivel: meta.nivel,
      nivelLabel: nivelMeta.label,
      nivelRequisito: nivelMeta.requisito,
      riesgoAlto: !esBasica,
      cuantiaAlta: false,
      // Se devuelve para que la UI y el informe puedan decir POR QUÉ salió
      // básica sin cumplir los cuatro criterios.
      porIoarr: input.esIoarr === true && !CRITERIOS_OBRA_BASICA.every((c) => cumplidos.has(c.key)),
    };
  }

  // Bienes y servicios: cruce cuantía (alta/baja) × riesgo (alto/bajo).
  const cuantiaAlta = Boolean(input.cuantiaAlta);
  const riesgoAlto = (input.condicionesRiesgo ?? []).length > 0;
  const categoria: CategoriaSegmentacion = riesgoAlto
    ? cuantiaAlta
      ? "estrategico"
      : "critico"
    : cuantiaAlta
      ? "operacional"
      : "rutinaria";
  const meta = CATEGORIA_SEGMENTACION_META[categoria];
  const nivelMeta = NIVEL_INTERACCION_META[meta.nivel];
  return {
    categoria,
    categoriaLabel: meta.label,
    nivel: meta.nivel,
    nivelLabel: nivelMeta.label,
    nivelRequisito: nivelMeta.requisito,
    riesgoAlto,
    cuantiaAlta,
  };
}

// ===== Nivel de interacción realmente ejecutado en A5 =====

/**
 * Los cuatro niveles de menor a mayor exigencia. La interacción de A5 debe
 * alcanzar, como mínimo, el que determina la segmentación (A2). Una consulta al
 * mercado está por ENCIMA de una indagación: hacer más de lo exigido cumple;
 * hacer una indagación cuando tocaba consulta, no.
 */
export const NIVEL_ORDEN: readonly NivelInteraccion[] = [
  "indagacion_basica",
  "indagacion_avanzada",
  "consulta_mercado_basica",
  "consulta_mercado_avanzada",
];

/**
 * Nivel de interacción REALMENTE alcanzado en A5, deducido de las casillas
 * marcadas —no del radio elegido—.
 *
 * El radio `a5.nivel` dice qué se quiso hacer; las fuentes/herramientas marcadas
 * dicen qué se hizo. El Art. 48.3 mide la indagación por el nº de FUENTES
 * (básica ≥1, avanzada ≥2) y el 49.2 mide la consulta por el nº de HERRAMIENTAS
 * (básica ≥1, avanzada ≥2). Con el tipo elegido y el conteo real se sabe el
 * nivel efectivo. `null` si no se declaró el tipo o no se marcó nada de él: un
 * A5 que elige «consulta avanzada» pero no marca ninguna herramienta no ha
 * ejecutado ninguna consulta, por muy bien redactado que esté el sustento.
 */
export function nivelAlcanzadoA5(a5: Record<string, unknown>): NivelInteraccion | null {
  const tipo = tipoDeNivel(typeof a5.nivel === "string" ? a5.nivel : "");
  if (tipo === "indagacion") {
    const n = FUENTES_ANEXO1.filter((f) => a5[f.key]).length;
    return n >= 2 ? "indagacion_avanzada" : n >= 1 ? "indagacion_basica" : null;
  }
  if (tipo === "consulta_mercado") {
    const n = HERRAMIENTAS_ANEXO1.filter((h) => a5[h.key]).length;
    return n >= 2 ? "consulta_mercado_avanzada" : n >= 1 ? "consulta_mercado_basica" : null;
  }
  return null;
}

/**
 * ¿La interacción ejecutada en A5 alcanza, como mínimo, el nivel `requerido`
 * (el que fija la segmentación de A2)?
 *
 * Compara por jerarquía (NIVEL_ORDEN), no por igualdad: una consulta satisface
 * un requisito de indagación, pero una indagación —por avanzada que sea— no
 * satisface uno de consulta. Sin nada ejecutado (`null`) nunca alcanza.
 */
export function interaccionAlcanzaNivel(
  a5: Record<string, unknown>,
  requerido: NivelInteraccion,
): boolean {
  const alcanzado = nivelAlcanzadoA5(a5);
  if (!alcanzado) return false;
  return NIVEL_ORDEN.indexOf(alcanzado) >= NIVEL_ORDEN.indexOf(requerido);
}

// ===== Opciones reutilizables para los formularios =====

/** Los SÍ/NO del Formato de Estrategia. El vacío significa "sin analizar". */
/** k) Fuentes de financiamiento del Formato de Estrategia (Art. 46.1.k). */
export const OPCIONES_FUENTE_FINANCIAMIENTO = [
  { value: "recursos_ordinarios", label: "Recursos ordinarios" },
  { value: "recursos_directamente_recaudados", label: "Recursos directamente recaudados" },
  { value: "operaciones_credito", label: "Recursos por operaciones oficiales de crédito" },
  { value: "donaciones_transferencias", label: "Donaciones y transferencias" },
  { value: "recursos_determinados", label: "Recursos determinados" },
  { value: "otros", label: "Otros" },
];

export const OPCIONES_SI_NO = [
  { value: "si", label: "SÍ" },
  { value: "no", label: "NO" },
];

// Lista compartida con la ficha de necesidad: vive en lib/opciones-contratacion.ts
// (módulo puro) y se reexporta aquí para no romper a quien ya la importaba.
export { OPCIONES_MODALIDAD_PAGO } from "./opciones-contratacion";
import { OPCIONES_MODALIDAD_PAGO, etiquetas } from "./opciones-contratacion";

export const OPCIONES_TIPO_EVALUADOR = [
  { value: "oficial_compra", label: "Oficial de compra" },
  { value: "comite", label: "Comité (3 integrantes)" },
  { value: "jurado", label: "Jurado (3 o 5 expertos)" },
];

// Variables de la Estrategia de Contratación (numeral 46.1 del Art. 46 del
// Reglamento; la variable t) fue incorporada por el D.S. 001-2026-EF).
const CAMPOS_ESTRATEGIA: CampoFormulario[] = [
      // El orden sigue el del Formato de Estrategia que se exporta: las variables
      // van intercaladas por letra a)…t), y bajo cada letra van juntos su SÍ/NO,
      // su selección y su sustento (no todos los SÍ/NO arriba y los sustentos
      // abajo). Al cierre, la variable "II)" y la fecha; y por último, solo para
      // obras, las variables del Art. 154.
      //
      // Los SÍ/NO del formato (Art. 46.1) son selects de TRES estados, no
      // checkboxes: en el formato firmado están TODOS marcados, y dejar las dos
      // casillas en blanco no significa "no", significa "sin analizar". Un
      // checkbox sin marcar no distingue "no" de "no lo he mirado".

      // ===== a) Procedimiento de selección =====
      // El régimen manda sobre toda la fase: el Art. 101.1 excluye la
      // segmentación (A2) y la interacción (A5) en los no competitivos, y el
      // resto de las actuaciones preparatorias sigue aplicando igual.
      // El régimen NO se pregunta aquí: se deduce de la causal del Art. 55
      // registrada en A1. Cuando A4 se ejecuta, A2 y A3 ya se hicieron, y el
      // el Art. 101.1 excluye la segmentación de los no competitivos ("No
      // corresponde realizar la segmentación de contrataciones"): hay que
      // saberlo ANTES de A2, no en el paso 4.
      { name: "var_a_proceso", label: "a) Tipo de procedimiento de selección", tipo: "text", required: true, soloLectura: true, baseLegal: "Art. 54 de la Ley 32069 · el procedimiento que el área usuaria anticipó en la ficha (Tipo de proceso de selección, Arts. 93/94/95).", ayuda: "Se trae del «Tipo de proceso de selección» de la necesidad; no se elige de una lista aquí. Los no competitivos van en la variable b)." },
      { name: "var_a_nomenclatura", label: "a) Nomenclatura del procedimiento", tipo: "text", recomendado: true, baseLegal: "Art. 54 de la Ley 32069", placeholder: "N° 42-2026-DEC-MDCH", ayuda: "Solo el número: el tipo ya sale del campo de arriba." },
      { name: "var_a_sustento_cambio", label: "a) Sustento del cambio del procedimiento respecto del PAC", tipo: "textarea", ancho: "full", baseLegal: "Art. 46.1.a Reglamento", ayuda: "Solo si la estrategia cambia el procedimiento que venía programado en el PAC. Si no lo cambia, el formato imprime “NO CORRESPONDE.” solo." },

      // ===== b) Procedimiento no competitivo =====
      { name: "si_sustenta_no_competitivo", label: "b) ¿Del análisis se sustenta correctamente el uso de un procedimiento no competitivo?", tipo: "select", opciones: OPCIONES_SI_NO, baseLegal: "Art. 46.1.b Reglamento" , recomendado: true },
      { name: "var_b_no_competitivo", label: "b) Sustento para uso de procedimiento de selección no competitivo", tipo: "textarea", ancho: "full", ayuda: "Solo si el área usuaria sustenta un no competitivo (Art. 55 Ley / 100 Regl.), previa opinión técnica de la DEC." , recomendado: true },

      // ===== c) Inversión (CUI) =====
      { name: "si_es_inversion", label: "c) ¿Esta contratación es una inversión?", tipo: "select", opciones: OPCIONES_SI_NO, baseLegal: "Art. 46.1.c Reglamento" , recomendado: true },
      { name: "cui", label: "c) Código Único de Inversión (CUI)", tipo: "text", recomendado: true, dependeDe: { campo: "si_es_inversion", valor: "si" }, baseLegal: "Art. 46.1.c Reglamento", placeholder: "2661009", ayuda: "El formato lo pide solo si la contratación es una inversión. Si la ficha declaró proyecto de inversión o IOARR, se rescata de ahí al exportar." },
      { name: "si_inversion_viable", label: "c) ¿El proyecto de inversión es viable o el IOARR fue aprobado?", tipo: "select", opciones: OPCIONES_SI_NO, baseLegal: "Art. 46.1.c Reglamento" , recomendado: true, dependeDe: { campo: "si_es_inversion", valor: "si" } },
      { name: "var_c_viabilidad", label: "c) Declaración de viabilidad (proyecto de inversión) o aprobación de IOARR", tipo: "textarea", ancho: "full", ayuda: "Consultar https://ofi5.mef.gob.pe/invierte/consultaPublica/. Incluir N° de viabilidad y fecha." },

      // ===== d) Modalidad de contratación pública eficiente =====
      { name: "si_modalidad_eficiente", label: "d) ¿Se desarrollará mediante una modalidad de contratación pública eficiente?", tipo: "select", opciones: OPCIONES_SI_NO, baseLegal: "Art. 46.1.d Reglamento" , recomendado: true },
      { name: "modalidad_eficiente_tipo", label: "d) Modalidad de contratación pública eficiente elegida", tipo: "select", opciones: OPCIONES_MODALIDAD_EFICIENTE, recomendado: true, dependeDe: { campo: "si_modalidad_eficiente", valor: "si" }, baseLegal: "Art. 46.1.d Reglamento", ayuda: "El formato la marca con una (X). Solo aplica si arriba respondiste SÍ." },
      { name: "var_d_modalidad_eficiente", label: "d) Posibilidad de usar una modalidad de contratación pública eficiente", tipo: "textarea", ancho: "full", ayuda: "Contratos menores, catálogo electrónico, compra por innovación, centralizada, encargo, corporativa, acuerdo marco (Art. 55 Ley/Arts. 102-109 Regl.)." },

      // ===== e) Evaluador =====
      { name: "var_e_tipo_evaluador", label: "e) Tipo de evaluador", tipo: "select", required: true, opciones: OPCIONES_TIPO_EVALUADOR, ayuda: "Ver Cuadro N° 6 y 7 de la Guía. Oficial de compra (DEC), Comité (3 integrantes, al menos 1 comprador público), Jurado (3 o 5 expertos).", baseLegal: "Arts. 56-60 Reglamento (56 Evaluadores, 58 Oficial de compra, 59 Comité, 60 Jurados)" },
      // Aparece —y es obligatorio— en cuanto se elige un tipo de evaluador. Sin
      // el `dependeDe` + `required`, era un campo opcional que quedaba escondido
      // tras "Mostrar campos opcionales": elegías el tipo, la verificación pedía
      // su sustento y no había dónde escribirlo. Al elegir oficial de compra o
      // comité, el botón "Usar el sustento sugerido" lo redacta de un clic.
      { name: "var_e_perfil_evaluador", label: "e) Perfil del evaluador (sustento)", tipo: "textarea", ancho: "full", required: true, dependeDe: { campo: "var_e_tipo_evaluador", valor: ["oficial_compra", "comite", "jurado"] }, ayuda: "Sustenta el conocimiento técnico y la experiencia del evaluador. Con oficial de compra o comité, usa el botón «Usar el sustento sugerido». Los expertos del jurado requieren ≥8 años de experiencia general y ≥5 en la especialidad (Cuadro N° 6 de la Guía)." },

      // ===== f) Requisitos de calificación =====
      { name: "var_f_requisitos_calificacion", label: "f) Requisitos de calificación y/o precalificación", tipo: "requisitos", ancho: "full", recomendado: true, baseLegal: "Arts. 72.3-72.4, 46.1.f Reglamento", ayuda: "Los 5 tipos son los del Art. 72.3; las bases estándar (R.D. 0001-2026-EF/54.01) definen cuáles son OBLIGATORIOS según el procedimiento (Art. 72.4): el formato los incluye solo. Aquí registras los FACULTATIVOS que decida la DEC con su sustento; puede excluir uno si limita la concurrencia, con no objeción del área usuaria (Art. 44.8). La capacidad económica solo aplica con precalificación. Si está estandarizado, rigen los de la ficha (Art. 44.9)." },

      // ===== g) Factores de evaluación =====
      // `recomendado` para que g) se vea al ABRIR A4 (no escondido tras «Mostrar
      // campos opcionales»): la propuesta de factores es contenido de la estrategia
      // (Art. 46.1.g) y aplica «de corresponder» al procedimiento —queda vacío en
      // subasta inversa / comparación de precios (menor monto, Art. 74.3)—, que es
      // justo lo que la etiqueta «de corresponder» comunica. No bloquea el paso.
      { name: "factores_items", label: "g) Propuesta de factores de evaluación", tipo: "factores", ancho: "full", recomendado: true, baseLegal: "Art. 46.1.g · 73.3 · 74.3 Reglamento", ayuda: "Un factor por fila. El menú lista los aplicables según el procedimiento de a) (la subasta inversa y la comparación de precios van por menor monto, sin factores técnicos, Art. 74.3). Al elegir un factor, su sustento se precarga con una recomendación EDITABLE; la lista definitiva la fijan las bases estándar (Art. 73.3). Van a la tabla del formato (B56:C58)." },

      // ===== h) Modalidad de pago =====
      // h) e i) van a media rejilla (sin `ancho:"full"`) para que cada SELECT
      // quede en la misma fila que su SUSTENTO: modalidad ↔ su sustento, sistema
      // de entrega ↔ el suyo. Comparten grupo ("h–j"), así que nada se interpone.
      { name: "var_h_modalidad_pago", label: "h) Modalidad de pago", tipo: "select", recomendado: true, opciones: OPCIONES_MODALIDAD_PAGO, ayuda: "Bienes/Servicios: suma alzada, precios unitarios, esquema mixto, tarifas, porcentajes, honorario+comisión, pago por consumo. Obras: + costo reembolsable, pago disponibilidad/activación/mixto. Se usa tal cual en la Sección Específica de las Bases (A9): sin elegirla, esa condición de contratación sale sin completar." },
      { name: "var_h_sustento_pago", label: "h) Sustento de la elección de la modalidad de pago", tipo: "textarea", recomendado: true, baseLegal: "Art. 46.1.h Reglamento", ayuda: "Por qué esa modalidad de pago y no otra. La modalidad marca su casilla en el formato; esta celda (B70) lleva el sustento, que se precarga con su norma (Art. 130/286) al elegirla." },

      // ===== i) Sistema de entrega =====
      { name: "var_i_sistema_entrega", label: "i) Sistema de entrega", tipo: "select", recomendado: true, opciones: OPCIONES_SISTEMA_ENTREGA, baseLegal: "Art. 46.1.i Reglamento", ayuda: "Marca su casilla en el formato. Lo decide la DEC (Art. 72.1); si el área usuaria propuso uno, se ofrece al lado para adoptarlo. Se usa tal cual en la Sección Específica de las Bases (A9), donde aplique (no en obras, que lo fija con la variante del capítulo)." },
      { name: "var_i_sustento_entrega", label: "i) Sustento de la elección del sistema de entrega", tipo: "textarea", recomendado: true, baseLegal: "Art. 46.1.i Reglamento", ayuda: "Por qué ese sistema de entrega y no otro. El sistema marca su casilla en el formato; esta celda (B83) lleva el sustento, que se precarga con su norma (Art. 129 bienes/servicios · Art. 158 obras) al elegirlo." },

      // ===== j) Puntos no negociables =====
      { name: "var_j_puntos_no_negociables", label: "j) Puntos no negociables del requerimiento (etapa de negociación o diálogo competitivo)", tipo: "puntos", ancho: "full", baseLegal: "Art. 46.1.j Reglamento", ayuda: "Un punto no negociable por fila, con su sustento. Aplican durante la etapa de negociación o el diálogo competitivo (Art. 46.1.j). Los puntos van a la celda C87 del formato y sus sustentos a C88 (numerados para que correspondan)." },

      // ===== k) Financiamiento y actualización de la cuantía =====
      { name: "fuente_financiamiento", label: "k) Tipo de fuente de financiamiento", tipo: "select", opciones: OPCIONES_FUENTE_FINANCIAMIENTO, baseLegal: "Art. 46.1.k Reglamento", ayuda: "Se precarga desde la ficha de la necesidad; cámbialo si la estrategia lo corrige." , recomendado: true },
      { name: "si_cuantia_actualizada", label: "k) ¿La cuantía se actualizó con motivo de la estrategia?", tipo: "select", opciones: OPCIONES_SI_NO, baseLegal: "Art. 46.1.k Reglamento" , recomendado: true },
      { name: "var_k_financiamiento_cuantia", label: "k) Fuente de financiamiento y actualización de la cuantía", tipo: "textarea", ancho: "full", recomendado: true, baseLegal: "Art. 46.1.k Reglamento", ayuda: "Incluir fuente (RO, RDR, etc.) y si la cuantía se actualizó tras la interacción con el mercado. Al marcar «SÍ» en la actualización de la cuantía, se precarga aquí el sustento con las fuentes/herramientas de A5." },

      // ===== l) Garantías y adelantos =====
      { name: "si_garantia_fiel_cumplimiento", label: "l) ¿Corresponde garantía de fiel cumplimiento?", tipo: "select", opciones: OPCIONES_SI_NO, baseLegal: "Art. 46.1.l Reglamento" , recomendado: true },
      { name: "si_garantia_accesorias", label: "l) ¿Corresponde garantía por prestaciones accesorias?", tipo: "select", opciones: OPCIONES_SI_NO, baseLegal: "Art. 46.1.l Reglamento" , recomendado: true },
      { name: "si_garantia_adelantos", label: "l) ¿Se selecciona la garantía por adelantos directos?", tipo: "select", opciones: OPCIONES_SI_NO, baseLegal: "Art. 46.1.l Reglamento" , recomendado: true },
      // Tabla de adelantos: tres filas fijas del formato (Art. 46.1.l), como una
      // rejilla igual a la del exportable (marcar / mecanismo / %). Visible solo si
      // arriba se seleccionó la garantía por adelantos.
      // La tabla se muestra SIEMPRE, igual que en el formato exportable (las tres
      // filas están siempre, con "NO CORRESPONDE" en las no marcadas). Antes
      // dependía de la casilla SÍ/NO de arriba y, si no se marcaba SÍ, no aparecía.
      { name: "adelantos_items", label: "l) Tabla de adelantos", tipo: "adelantos", ancho: "full", recomendado: true, baseLegal: "Art. 46.1.l Reglamento", ayuda: "Marca el/los adelanto(s) que aplican e indica su mecanismo de garantía y porcentaje. Los de materiales y por avance solo se usan en obras. Va a la tabla de adelantos del formato (filas 108-110); las filas sin marcar salen «NO CORRESPONDE»." },
      // El textarea "l) Garantías y adelantos" se retiró: los adelantos se capturan
      // en la tabla de arriba (`adelantos_items`), de la que se DERIVA el sustento de
      // B112. La clave `var_l_garantias_adelantos` sigue existiendo como dato —se
      // siembra con la propuesta del área usuaria y es columna del expediente— y sirve
      // de respaldo de B112 cuando no hay adelantos marcados.

      // ===== m) Consumo histórico =====
      { name: "si_consumo_historico", label: "m) ¿Se contrató anteriormente un bien igual o similar?", tipo: "select", opciones: OPCIONES_SI_NO, baseLegal: "Art. 46.1.m Reglamento" , recomendado: true },
      { name: "var_m_consumo_historico", label: "m) Análisis del consumo histórico del bien (de corresponder)", tipo: "textarea", ancho: "full", ayuda: "Para bienes de consumo recurrente, analizar el histórico de consumo de la entidad (cantidades, frecuencia, estacionalidad)." },

      // ===== n) Interacción con el mercado =====
      { name: "var_n_tipo_interaccion", label: "n) Verificación del tipo de interacción con el mercado", tipo: "textarea", ancho: "full", baseLegal: "Art. 46.1.n Reglamento", ayuda: "Verificar que la interacción realmente ejecutada (paso A5) alcanza el nivel mínimo que determinó la segmentación (paso A2)." },

      // ===== o) Cronograma =====
      { name: "cronograma_items", label: "o) Cronograma estimado del proceso de contratación (fase de selección y ejecución contractual)", tipo: "cronograma", ancho: "full", baseLegal: "Art. 46.1.o Reglamento", ayuda: "El Art. 46.1.o abarca la fase de selección Y la ejecución contractual: incluye actividades de ambas. Debe considerar las actividades según el tipo de procedimiento y el objeto contractual, por eso son editables y no una lista fija." },

      // ===== p) Roles y responsabilidades =====
      { name: "roles_items", label: "p) Roles y responsabilidades de los involucrados", tipo: "roles", ancho: "full", baseLegal: "Art. 46.1.p Reglamento", ayuda: "Un rol por fila, con la etapa de la fase de selección en la que actúa." },
      { name: "var_p_roles", label: "p) Sustento para la asignación de roles y responsabilidades", tipo: "textarea", ancho: "full", ayuda: "Identificar los actores (DEC, AU, evaluadores, AGA, OPP, etc.) y sus responsabilidades en el proceso." },

      // ===== q) Agrupación de prestaciones =====
      { name: "agrupacion_tipo", label: "q) Tipo de agrupación de prestaciones", tipo: "select", opciones: OPCIONES_AGRUPACION, recomendado: true, baseLegal: "Art. 46.1.q Reglamento", ayuda: "Marca su casilla en el formato (paquete / ítems / lotes / tramos). El sustento va en el campo q)." },
      { name: "var_q_agrupar", label: "q) Evaluación de la posibilidad de agrupar prestaciones", tipo: "textarea", ancho: "full", ayuda: "Analizar si procede agrupar prestaciones en un mismo procedimiento o si conviene separarlas." },

      // ===== r) Estandarización =====
      { name: "var_r_estandarizado", label: "r) Verificación de si el requerimiento está estandarizado", tipo: "textarea", ancho: "full", ayuda: "Si tiene ficha de homologación o ficha técnica vigente, los requisitos de calificación son los de dicha ficha." },

      // ===== s) Objetivo del proceso =====
      { name: "var_s_objetivo", label: "s) Identificación de lo que afecta o impulsa el objetivo del proceso (incluida la gestión de riesgos)", tipo: "textarea", ancho: "full", required: true, ayuda: "Analizar factores internos o externos que pueden afectar el éxito de la contratación y su alineamiento con los objetivos institucionales. El Art. 46.1.s incluye EXPRESAMENTE la gestión de riesgos: identifica los riesgos del proceso y su tratamiento (si el requerimiento trae matriz de riesgos, recógela aquí).", baseLegal: "Art. 46.1.s Reglamento · incluye la gestión de riesgos" },

      // ===== t) Otras variables (Art. 46.1.t): cada checkbox marca su casilla =====
      ...OTRAS_VARIABLES_CAMPOS.map((v) => ({
        name: v.campo,
        label: `t) ${v.label}`,
        tipo: "boolean" as const,
        ayuda: v.ayuda,
        baseLegal: "Art. 46.1.t Reglamento",
      })),
      { name: "var_t_otras", label: "t) Otras variables según el objeto de la contratación", tipo: "textarea", ancho: "full", ayuda: "Incorporada por el D.S. N° 001-2026-EF." },

      // ===== Cierre del formato: variable II) y fecha al pie =====
      { name: "si_cuantia_referencia", label: "II) ¿La cuantía de la contratación es punto de referencia?", tipo: "select", opciones: OPCIONES_SI_NO, recomendado: true, ayuda: "Marca SÍ solo cuando la ley usa la cuantía como referencia y no como tope: expertos y gerentes de proyecto (Art. 134.1) y Concurso de Proyectos Arquitectónicos (Art. 135.1) siempre; obras bajo «solo construcción» (Art. 165), «diseño y construcción» (Art. 166.1/166.2) y consultoría de obra «solo formulación o solo diseño» (Art. 166.4, mínimo 90%). En gestión al riesgo/de agencia y entrega integrada (Art. 166.3) NO aplica: siguen las reglas generales. Se rellena solo para el procedimiento de a) o el sistema de entrega de i); para servicios con diseño ya definido (Art. 133), márcalo a mano.", baseLegal: "Art. 48.2 Ley 32069" },
      { name: "fecha_elaboracion", label: "Fecha de elaboración del formato", tipo: "date", ayuda: "Se imprime al pie. Arranca con la fecha de hoy y es editable." },

      // Variables adicionales obligatorias para OBRAS y CONSULTORÍA DE OBRAS (Art. 154).,
      { name: "obra_a_tipo_contrato", label: "[Obras] a) Tipo de contrato a emplear", tipo: "textarea", ancho: "full", required: true, ayuda: "Suma alzada, precios unitarios, esquema mixto, costo reembolsable, etc. según el objeto de la obra/consultoría.", baseLegal: "Art. 154.1.a Reglamento" },
      { name: "obra_b_bim", label: "[Obras] b) Necesidad de emplear metodología BIM", tipo: "textarea", ancho: "full", required: true, ayuda: "Evaluar si por la complejidad de la obra se requiere BIM. Sustentar la decisión.", baseLegal: "Art. 154.1.b Reglamento" },
      { name: "obra_c_incentivos", label: "[Obras] c) Propuesta de incentivos por beneficios o mejoras", tipo: "textarea", ancho: "full", required: true, ayuda: "Describir incentivos por cumplimiento de hitos, mejoras técnicas, reducción de plazos, etc.", baseLegal: "Art. 154.1.c Reglamento" },
      { name: "obra_d_fast_track", label: "[Obras] d) Posibilidad de ejecución rápida (fast track)", tipo: "textarea", ancho: "full", required: true, ayuda: "Evaluar si procede ejecución superpuesta de actividades (diseño y construcción simultáneos).", baseLegal: "Art. 154.1.d Reglamento" },
      { name: "obra_e_terreno", label: "[Obras] e) Sustento de la disponibilidad física del terreno", tipo: "textarea", ancho: "full", required: true, ayuda: "Acreditar que la entidad tiene la posesión o disponibilidad jurídica y física del terreno.", baseLegal: "Art. 154.1.e Reglamento" },
      { name: "obra_f_licencias", label: "[Obras] f) Plan para licencias, autorizaciones, permisos y servidumbres", tipo: "textarea", ancho: "full", required: true, ayuda: "Identificar licencias municipales, autorizaciones sectoriales, permisos ambientales y servidumbres necesarias.", baseLegal: "Art. 154.1.f Reglamento" },
      { name: "obra_g_expediente_tecnico", label: "[Obras] g) Responsable de la elaboración del expediente técnico", tipo: "textarea", ancho: "full", required: true, ayuda: "Indicar si lo elabora la entidad o se contrata externamente. Incluir plazos estimados.", baseLegal: "Art. 154.1.g Reglamento" },
      { name: "obra_h_estructura_costos", label: "[Obras/Consultoría] h) Estructura de costos", tipo: "textarea", ancho: "full", required: true, ayuda: "Desglose de costos directos, indirectos, utilidad, gastos generales e IGV.", baseLegal: "Art. 154.1.h Reglamento" },
      { name: "obra_i_metodologias_colaborativas", label: "[Obras/Consultoría] i) Metodologías colaborativas", tipo: "textarea", ancho: "full", required: true, ayuda: "Lean Construction, VDC (Virtual Design and Construction) u otras que optimicen procesos, sostenibilidad y eficiencia en la ejecución de la obra/consultoría. Sustentar cuáles se usarán y por qué.", baseLegal: "Art. 154.1.i Reglamento" },
];

// A4 tiene ~20 variables (Art. 46.1 a–t) + cierre + obras: demasiadas para una
// lista plana. Se agrupan por afinidad temática para que se lean por bloques. El
// grupo se deriva de la letra que ya abre cada label ("a) …", "II) …", "[Obras]
// …"), así no hay que anotar 40 objetos a mano ni pueden desincronizarse.
const G_A4 = {
  proc: "a–b · Procedimiento y régimen",
  obj: "c–d · Inversión y modalidad eficiente",
  eval: "e–g · Evaluador, requisitos y factores",
  ejec: "h–j · Pago, entrega y puntos no negociables",
  econ: "k–m · Financiamiento, garantías y consumo",
  merc: "n–p · Interacción, cronograma y roles",
  ana: "q–t · Agrupación, estandarización, objetivo y otras",
  cierre: "Cierre del formato",
  obra: "Obras y consultoría de obra (Art. 154)",
} as const;

const GRUPO_POR_LETRA_A4: Record<string, string> = {
  a: G_A4.proc, b: G_A4.proc,
  c: G_A4.obj, d: G_A4.obj,
  e: G_A4.eval, f: G_A4.eval, g: G_A4.eval,
  h: G_A4.ejec, i: G_A4.ejec, j: G_A4.ejec,
  k: G_A4.econ, l: G_A4.econ, m: G_A4.econ,
  n: G_A4.merc, o: G_A4.merc, p: G_A4.merc,
  q: G_A4.ana, r: G_A4.ana, s: G_A4.ana, t: G_A4.ana,
};

/** Asigna a cada campo de A4 su subtítulo de grupo, derivado de la letra del label. */
function conGruposA4(campos: CampoFormulario[]): CampoFormulario[] {
  return campos.map((c) => {
    if (c.grupo) return c;
    if (c.label.startsWith("[Obras")) return { ...c, grupo: G_A4.obra };
    const letra = /^([a-z]{1,2}|II)\)/.exec(c.label)?.[1];
    return { ...c, grupo: (letra && GRUPO_POR_LETRA_A4[letra]) || G_A4.cierre };
  });
}

export const PASOS_F1: Record<string, PasoDetalle> = {
  A1: {
      code: "A1",
      accionGuia: "Programación (precondición)",
      baseLegal: "Art. 14.2.c del Reglamento (la DEC verifica que la necesidad esté registrada y aprobada en el CMN y sus modificaciones); Art. 41 (las actuaciones preparatorias arrancan en la segmentación del PAC del CMN); Art. 42.3 (contrataciones no planificadas)",
      objetivo: "Verificar que la necesidad esté prevista en el Cuadro Multianual de Necesidades (CMN) y programada en el Plan Anual de Contrataciones (PAC) antes de iniciar la contratación.",
      responsables: "Área usuaria / DEC",
      formatos: [
      "Constancia de inclusión en CMN",
      "Referencia en el PAC"
      ],
      nota: "La necesidad debe estar registrada y aprobada en el CMN y sus modificaciones; la DEC lo verifica (Art. 14.2.c). Las actuaciones preparatorias arrancan en la segmentación de las contrataciones del PAC del CMN (Art. 41). Las NO PLANIFICADAS que no figuran en el PAC del CMN se segmentan una vez que el área usuaria ha solicitado la modificación del CMN (Art. 42.3). Los contratos menores quedan fuera de la segmentación (Art. 42.1).",
      campos: [
      {
        // Un solo control gobierna la programación. Antes A1 preguntaba lo mismo dos
        // veces —"¿está en el PAC?" y "¿es programada?"— con dos casillas que podían
        // contradecirse. Este select es la FUENTE ÚNICA; los flags `en_pac` y
        // `programada` que el resto del código lee (línea de corte de A2, "¿modifica
        // el PAC?" de A4, C6 del export) se sincronizan desde aquí en el panel. Según
        // lo elegido se muestran solo los campos de cada camino (Art. 42.1 / 42.3).
        name: "situacion_pac",
        label: "Situación de la contratación en el PAC",
        tipo: "select",
        opciones: [
          { value: "programado", label: "Programado" },
          { value: "no_programado", label: "No programado" },
        ],
        required: true,
        baseLegal: "Art. 42.1 Reglamento (programado) · Art. 42.3 (no programado)",
        ayuda: "Programado: la contratación figura en el PAC del CMN del ejercicio. No programado: contratación no planificada (Art. 42.3); se segmenta una vez que el área usuaria solicita la modificación del CMN. Según lo elegido, A1 muestra solo los campos que aplican.",
      },
      {
          name: "en_cmn",
          label: "La necesidad está incluida en el CMN",
          tipo: "boolean",
          required: true,
          baseLegal: "Art. 14.2.c Reglamento",
          ayuda: "Verificar que la necesidad esté registrada en el Cuadro Multianual de Necesidades aprobado por la entidad."
      },
      {
          name: "version_cmn",
          // La clave sigue siendo `version_cmn` (renombrarla huerfanizaría lo ya
          // grabado), pero la etiqueta abandona "versión": la norma no conoce
          // versiones del CMN, conoce el CMN «y sus modificaciones» (Art. 14.2.c).
          // Y este mismo dato se cita como N.° de CMN en la solicitud de
          // certificación (lib/solicitud-certificacion-data.ts): identifica un
          // documento, no una iteración.
          label: "N.° del CMN (y su modificatoria, si aplica)",
          tipo: "text",
          requeridoSi: { campo: "en_cmn", valor: "true" },
          ayuda: "Año del CMN y, si la necesidad entró por una modificación, su modificatoria (ej.: CMN 2026, Modificatoria N.° 2). La DEC verifica aquí el registro y aprobación (Art. 14.2.c); este dato viaja como N.° de CMN a la solicitud de certificación. Obligatorio si arriba se marca que la necesidad está incluida en el CMN.",
          baseLegal: "Art. 14.2.c Reglamento · la DEC verifica el registro y aprobación en el CMN «y sus modificaciones»"
      },
      {
        // Precondición del Art. 42.3 para las NO programadas: la DEC segmenta
        // "una vez que el área usuaria haya solicitado la modificación del
        // CMN". A2 ya avisa de que falta, pero A1 —que es donde se declara la
        // no programación— no pedía la constancia. Sin ella, la segmentación se
        // adelanta a su precondición. Va aquí, tras el N.° del CMN, porque el
        // orden pedido para la rama no programada es: N.° del CMN → esta
        // solicitud → valor estimado → el resto.
        name: "documento_modificacion_cmn",
        label: "Solicitud de modificación del Cuadro Multianual de Necesidades N°",
        // Solo el número correlativo. Al ser `number` se guarda como cifra, así
        // que quien lo imprime NO puede leerlo con `str()` (ignora los
        // no-string y lo dejaría caer en silencio): se lee con
        // `documentoModificacionCmnTexto`, que además respeta las referencias
        // completas grabadas antes de este cambio.
        tipo: "number",
        // Solo aplica —y es obligatorio— en las NO programadas (Art. 42.3).
        dependeDe: { campo: "situacion_pac", valor: "no_programado" },
        requeridoSi: { campo: "situacion_pac", valor: "no_programado" },
        baseLegal: "Art. 42.3 Reglamento · la segmentación procede una vez solicitada la modificación del CMN",
        ayuda: "Número correlativo del documento con que el área usuaria pidió incluir la necesidad en el CMN. Obligatorio en las contrataciones NO programadas.",
        placeholder: "045",
      },
      {
        // Valor estimado de la contratación. En una NO programada aún no consta
        // en el PAC del CMN, así que se registra aquí, junto a la solicitud de
        // modificación. Se precarga desde el "Monto estimado (S/)" de la
        // necesidad (fase1-precarga); el usuario puede ajustarlo.
        name: "valor_estimado",
        label: "Valor estimado (S/)",
        tipo: "number",
        moneda: true,
        recomendado: true,
        // Solo aplica —y es obligatorio— en las NO programadas: es el valor de
        // partida de una contratación que aún no consta en el PAC del CMN.
        dependeDe: { campo: "situacion_pac", valor: "no_programado" },
        requeridoSi: { campo: "situacion_pac", valor: "no_programado" },
        baseLegal: "Ley 32069, Art. 48 · la entidad establece la cuantía de la contratación para gestionar los recursos presupuestales",
        ayuda: "Valor estimado de la contratación. Se precarga desde el «Monto estimado (S/)» de la necesidad; ajústalo si cambió. Obligatorio en las contrataciones NO programadas.",
      },
      {
          name: "referencia_pac",
          label: "Referencia/ítem del PAC",
          tipo: "text",
          ayuda: "N° de ítem en el PAC del CMN",
        // Se imprime en la cabecera de la variable a) del formato de estrategia.
        recomendado: true,
        // Solo hay referencia/ítem del PAC si la contratación está programada.
        dependeDe: { campo: "situacion_pac", valor: "programado" },
      },
      {
        name: "causal_art_55",
        label: "Causal de procedimiento NO competitivo (Art. 55 de la Ley)",
        tipo: "select",
        opciones: CAUSALES_ART_55,
        baseLegal: "Art. 55.1 de la Ley 32069",
        ayuda: "Déjalo vacío si es competitivo, que es la regla general (Art. 54.3). La lista es cerrada: si no encaja en ninguna causal, el procedimiento es competitivo. Marcarla excluye la segmentación (A2) y la interacción (A5) por el Art. 101.1.",
        // Determina el régimen: con causal, el Art. 101.1 excluye la segmentación (A2) y la interacción (A5).
        recomendado: true
      },
      {
        name: "documento_causal_art_55",
        label: "Documento del área usuaria que sustenta el no competitivo",
        tipo: "text",
        ayuda: "Tipo y número. Lo emite el área usuaria o el área técnica estratégica; la DEC lo analiza en la variable b) de la estrategia.",
        baseLegal: "Art. 46.1.b Reglamento",
        placeholder: "INFORME N° 012-2026-AU-MDCH",
        // Sin causal del Art. 55 (procedimiento competitivo) no hay documento que
        // citar: la casilla sale "NO CORRESPONDE." en vez de una caja editable.
        noCorrespondeSalvoQue: { campo: "causal_art_55" },
        // Visible siempre (no tras "ver opcionales"): con causal es donde se
        // registra el documento, y sin causal muestra el "NO CORRESPONDE.".
        recomendado: true,
      },
      {
        name: "procedimiento_pac",
        label: "Procedimiento de selección registrado en el PAC",
        tipo: "select",
        // El proceso ESPECÍFICO (los 21 de los Arts. 93/94/95), no el genérico:
        // registrar aquí la submodalidad ("con precalificación", "con negociación",
        // MDA…) es lo que permite que un cambio de submodalidad frente a lo que la
        // DEC determina en A4 se detecte como modificación del PAC en la variable a).
        opciones: PROCESOS_COMPETITIVOS_OPCIONES,
        // El 46.1.a es la variable de la ESTRATEGIA ("Tipo de procedimiento de
        // selección y su modalidad"), no una norma sobre lo que se registra en
        // el PAC. Se cita porque este dato es el antecedente contra el que esa
        // variable se contrasta; poner solo "Art. 46.1.a" sugería que el
        // artículo regula el registro en el PAC, y no lo hace.
        baseLegal:
          "Antecedente del PAC contra el que se contrasta la variable a) de la estrategia (Art. 46.1.a Reglamento · tipo de procedimiento de selección y su modalidad)",
        ayuda: "El procedimiento —con su modalidad— tal como quedó registrado en el PAC. La DEC determina el definitivo en A4.",
        // El formato de estrategia pregunta si se modifica: sin este dato, esa casilla sale en blanco.
        recomendado: true,
        // En una no programada no hay nada registrado en el PAC: se oculta.
        dependeDe: { campo: "situacion_pac", valor: "programado" },
      },
      // Programación del CMN/PAC. Estos cuatro datos los captura el área usuaria
      // en la ficha de necesidad y su dueño natural es A1, que es el paso del
      // Art. 42. Hasta ahora se guardaban en la necesidad y no los leía nadie:
      // parecían campos muertos cuando en realidad les faltaba el destino.
      {
        name: "periodo_programacion",
        label: "Periodo de programación del CMN",
        tipo: "text",
        // Sin artículo: el Reglamento no fija un "periodo de programación" como
        // dato del CMN. Es el horizonte multianual con que la entidad lo
        // formula, útil para localizar el documento, no una exigencia.
        ayuda: "Horizonte multianual con el que la entidad formuló el CMN. Sirve para identificar el documento; viene de la ficha.",
        placeholder: "2026-2028",
        recomendado: true,
      },
      {
        name: "trimestre",
        label: "Trimestre programado en el PAC",
        tipo: "select",
        opciones: [
          { value: "1", label: "I Trimestre" },
          { value: "2", label: "II Trimestre" },
          { value: "3", label: "III Trimestre" },
          { value: "4", label: "IV Trimestre" },
        ],
        // Sin artículo: la periodificación del PAC la fija la directiva de
        // programación (PMBSO), no el Reglamento. Se captura porque el PAC la
        // trae, no porque el Reglamento la exija aquí.
        ayuda: "Trimestre en que el PAC prevé ejecutar la contratación. Viene de la ficha.",
        recomendado: true,
        dependeDe: { campo: "situacion_pac", valor: "programado" },
      },
      {
        name: "mes_programado",
        label: "Mes programado en el PAC",
        tipo: "number",
        ayuda: "Mes (1-12) previsto en el PAC. Viene de la ficha.",
        recomendado: true,
        dependeDe: { campo: "situacion_pac", valor: "programado" },
      },
      {
        name: "poi_actividad",
        label: "Actividad del POI vinculada",
        tipo: "text",
        // Sin artículo: la articulación CMN-POI es materia de la directiva de
        // programación (PMBSO) a la que remite el Art. 14.2.c, no del Reglamento.
        ayuda: "Actividad operativa del POI que financia la necesidad. Viene de la ficha.",
        recomendado: true,
      },
      {
        // Art. 42.2, literal: "Aprobado el CMN, la DEC informa mediante
        // documento interno a todas las áreas usuarias la clasificación en
        // categorías efectuada a sus contrataciones, adjuntando un CRONOGRAMA
        // PARA LA PRESENTACIÓN DE LOS REQUERIMIENTOS".
        //
        // Ese cronograma es lo que fija cuándo debe llegar el requerimiento
        // para que quepan las actuaciones preparatorias. A1 no lo capturaba, así
        // que no había contra qué contrastar la fecha de remisión a la DEC.
        name: "fecha_limite_requerimiento",
        label: "Fecha límite para presentar el requerimiento (cronograma de la DEC)",
        tipo: "date",
        recomendado: true,
        baseLegal: "Art. 42.2 Reglamento · cronograma que la DEC adjunta al informar la clasificación en categorías",
        ayuda: "Del documento interno con que la DEC comunicó la segmentación y el cronograma de presentación de requerimientos.",
        dependeDe: { campo: "situacion_pac", valor: "programado" },
      },
      {
          name: "observaciones",
          label: "Observaciones",
          tipo: "textarea",
          ancho: "full"
      }
      ]
  },
  A2: {
      code: "A2",
      accionGuia: "I. Segmentación de las contrataciones",
      baseLegal: "Art. 42 del Reglamento (bienes/servicios: Art. 125; obras/consultoría: Art. 153)",
      objetivo: "Clasificar las contrataciones del PAC según cuantía y riesgo para definir el alcance de la estrategia y el nivel mínimo de interacción con el mercado. Responsable: DEC.",
      responsables: "DEC",
      // La Guía NO tiene un "Registro/Formato de segmentación": su Anexo N° 3 es el
      // EJERCICIO PRÁCTICO (un ejemplo), y el resultado de la segmentación "no se
      // aprueba mediante un documento específico; se indica en el contenido del
      // Anexo N° 2, a través del cual se aprueba el expediente". El .docx que genera
      // el paso es un Informe de Segmentación INTERNO de la app, no un anexo oficial.
      formatos: [
      "Informe de Segmentación (su resultado se recoge en el Anexo N° 2, aprobación del expediente)"
      ],
      especial: "segmentacion",
      nota: "No se segmentan: contratos menores, procedimientos no competitivos, catálogos electrónicos de acuerdo marco ni supuestos excluidos de la Ley. Las compras centralizadas o corporativas se clasifican como estratégicas (bienes/servicios) o contratación avanzada (obras/consultoría).",
      campos: []
  },
  A3: {
      code: "A3",
      accionGuia: "II. Requerimiento",
      baseLegal: "Art. 44 del Reglamento; Bases estándar vigentes (Capítulo III de la Sección Específica)",
      objetivo: "Describir de forma clara y objetiva qué se necesita contratar, para qué (finalidad pública) y en qué condiciones debe ejecutarse, de preferencia en base a desempeño y funcionalidad, evitando características meramente descriptivas. El área usuaria formula; la DEC verifica el cumplimiento normativo y perfecciona previa NO OBJECIÓN del área usuaria.",
      responsables: "Área usuaria / ATE (formula) → DEC (verifica y perfecciona, con no objeción)",
      formatos: [
      "Requerimiento final (estructura Cap. III bases estándar)",
      "TDR / Especificaciones técnicas / Expediente técnico"
      ],
      nota: "El requerimiento no es estático: puede perfeccionarse durante la estrategia de contratación e interacción con el mercado. La DEC debe obtener la no objeción del área usuaria cada vez que lo modifique. Al elaborar las bases, los evaluadores incluyen el requerimiento del área usuaria sin modificarlo.",
      campos: [
      {
          name: "objeto_contractual",
          label: "Tipo de objeto contractual",
          tipo: "select",
          required: true,
          opciones: [
              {
                  value: "bien",
                  label: "Bien"
              },
              {
                  value: "servicio",
                  label: "Servicio"
              },
              {
                  value: "obra",
                  label: "Obra"
              },
              {
                  value: "consultoria_obra",
                  label: "Consultoría de obra"
              }
          ],
          baseLegal: "Art. 44.10 Reglamento",
          ayuda: "Se determina según la naturaleza de la contratación. Si involucra varios tipos de prestaciones, manda la que represente el mayor costo, siempre que no desvirtúe la naturaleza de la contratación."
      },
      {
          name: "descripcion",
          label: "a) Alcance de la contratación y condiciones de ejecución",
          tipo: "textarea",
          ancho: "full",
          required: true,
          ayuda: "En función del desempeño y la funcionalidad. Usar la estructura del Capítulo III de las bases estándar. Evitar características meramente descriptivas que no impactan en funcionalidad o desempeño.",
          baseLegal: "Art. 44.2.a Reglamento"
      },
      {
          name: "finalidad_publica",
          label: "Finalidad pública (para qué se necesita)",
          tipo: "textarea",
          ancho: "full",
          required: true,
          ayuda: "El 'para qué' de la contratación, vinculado al objetivo institucional.",
          baseLegal: "Art. 44.1 Reglamento"
      },
      // Condiciones de contratación del Art. 44.2. Son PROPUESTAS del área
      // usuaria: la DEC las decide después en la estrategia (Art. 46.1.f/h/i).
      // Conservarlas aquí es lo que permite ver qué se propuso frente a qué se
      // decidió, que es lo que sustenta la no objeción del 44.7.
      {
          name: "propuesta_requisitos_calificacion",
          recomendado: true,
          label: "b) Requisitos de calificación y/o precalificación",
          tipo: "requisitos",
          ancho: "full",
          baseLegal: "Art. 44.2.b Reglamento",
          ayuda: "Lo que PROPONE el área usuaria. La DEC decide los definitivos en la estrategia (A4); si los cambia, requiere la no objeción del área usuaria."
      },
      {
          name: "propuesta_modalidad_pago",
          recomendado: true,
          label: "c.1) Modalidad de pago",
          tipo: "select",
          opciones: OPCIONES_MODALIDAD_PAGO,
          baseLegal: "Art. 44.2.c Reglamento",
          ayuda: "Lo que propone el área usuaria. La decisión final se toma en la estrategia (A4)."
      },
      {
          name: "propuesta_sistema_entrega",
          recomendado: true,
          label: "c.2) Sistema de entrega",
          tipo: "select",
          // Mismas opciones que el campo de la ficha (label-valued vía `etiquetas`),
          // para que la "Propuesta de sistema de entrega" de la necesidad encaje tal
          // cual como valor por defecto. Es ELEGIBLE: la DEC puede cambiarlo.
          opciones: etiquetas(OPCIONES_SISTEMA_ENTREGA),
          baseLegal: "Art. 44.2.c Reglamento",
          ayuda: "Se precarga con la propuesta del área usuaria (ficha de la necesidad) y es editable. La decisión final se toma en la estrategia (A4 · i)."
      },
      {
          name: "recursos_contratista",
          recomendado: true,
          label: "d) Equipamiento, permisos y otros recursos que necesita el contratista",
          tipo: "textarea",
          ancho: "full",
          baseLegal: "Art. 44.2.d Reglamento",
          ayuda: "Recursos que el contratista necesita para ejecutar la contratación."
      },
      {
          name: "formula_reajuste",
          recomendado: true,
          label: "e) Fórmula de reajuste",
          tipo: "textarea",
          baseLegal: "Art. 44.2.e Reglamento",
          ayuda: "Indicar la fórmula aplicable o 'No aplica' cuando no corresponda."
      },
      // Resto de contenidos del requerimiento (Art. 44.2, "como mínimo lo
      // siguiente, DE CORRESPONDER"). Los captura el área usuaria en la ficha y
      // hasta ahora no tenían destino en el expediente: se quedaban en la
      // necesidad y el requerimiento del Art. 44 llegaba a A3 incompleto.
      //
      // No se les asigna letra de literal porque las letras a)-e) de arriba son
      // las que el formato ya numera; inventar una f) o g) sería atribuirle al
      // Reglamento un orden que no he verificado.
      {
        name: "cantidad_unidad",
        recomendado: true,
        label: "Cantidad y unidad de medida",
        tipo: "text",
        // El 44.10 fija el OBJETO por naturaleza (mayor costo), no la cantidad ni
        // la unidad de medida, que no figuran entre los literales a)-e) del 44.2:
        // proceden de la estructura del Cap. III de las bases estándar.
        baseLegal: "Bases estándar, Cap. III · cantidad y unidad de medida del requerimiento (no figura entre los literales a)-e) del Art. 44.2)",
        ayuda: "Lo que se cotiza en la interacción con el mercado (A5). Viene de la ficha.",
        placeholder: "500 UNIDAD",
      },
      {
        name: "lugar_entrega",
        recomendado: true,
        label: "Lugar de entrega o de prestación",
        tipo: "textarea",
        ancho: "full",
        // El Art. 44.2 enumera SOLO cinco literales (a-e) y el lugar de entrega
        // no está entre ellos: procede de la estructura del Capítulo III de las
        // bases estándar, que es la que sigue el requerimiento.
        baseLegal: "Bases estándar, Cap. III · condición de contratación del requerimiento (no figura entre los literales a)-e) del Art. 44.2)",
        ayuda: "Departamento, provincia, distrito y el lugar concreto. Viene de la ficha.",
      },
      {
        name: "recepcion_conformidad",
        recomendado: true,
        label: "Recepción y conformidad de la prestación",
        tipo: "textarea",
        ancho: "full",
        baseLegal: "Art. 144 Reglamento · recepción y conformidad de la prestación (no figura entre los literales a)-e) del Art. 44.2)",
        ayuda: "Quién recibe y quién otorga la conformidad. Es el insumo de C6 en la fase de ejecución.",
      },
      {
        name: "penalidad_mora",
        recomendado: true,
        label: "Penalidad por mora",
        tipo: "textarea",
        ancho: "full",
        // El 161 es "modalidades de pago en ejecución para obras", no la mora. La
        // penalidad por mora es el Art. 120 (fórmula 0.10 × monto / F × plazo) y
        // el 119 fija el tope conjunto del 10% del monto del contrato.
        baseLegal: "Art. 120 Reglamento · penalidad por mora en la ejecución (fórmula 0.10 × monto / F × plazo); Art. 119 · tope conjunto del 10%",
        ayuda: "Fórmula de la penalidad por mora propuesta por el área usuaria.",
      },
      {
        // Antes compartía campo con la mora; se separa porque el área usuaria las
        // captura por separado en la ficha (columna `otras_penalidades`) y así
        // viajan intactas sin mezclarse con la fórmula de mora.
        name: "otras_penalidades",
        label: "Otras penalidades",
        tipo: "textarea",
        ancho: "full",
        recomendado: true,
        baseLegal: "Art. 119.1 Reglamento · el contrato establece la penalidad por mora y OTRAS penalidades aplicables (bases estándar, Cap. III); Art. 119.2 · el tope conjunto es el 10%",
        ayuda: "Penalidades distintas de la mora (supuesto, forma de cálculo y verificación), o 'No aplica'. Viene de la ficha. Se usa tal cual en la Sección Específica de las Bases (A9): sin llenarla, esa condición de contratación sale sin completar.",
      },
      {
        name: "subcontratacion",
        label: "Subcontratación",
        tipo: "textarea",
        ancho: "full",
        recomendado: true,
        baseLegal: "Bases estándar, Cap. III · condición de contratación del requerimiento (no figura entre los literales a)-e) del Art. 44.2)",
        ayuda: "Si se admite subcontratar y en qué porcentaje/prestaciones, o 'No aplica'. Se usa tal cual en la Sección Específica de las Bases (A9): sin llenarla, esa condición de contratación sale sin completar.",
      },
      {
        name: "solucion_controversias",
        label: "Solución de controversias",
        tipo: "textarea",
        ancho: "full",
        recomendado: true,
        baseLegal: "Arts. 330-332 Reglamento · conciliación y arbitraje; las instituciones arbitrales requieren inscripción vigente en el REGAJU (Art. 332.1)",
        ayuda: "Medios de solución de controversias e instituciones arbitrales designadas, o 'No aplica'. Viene de la ficha. Se usa tal cual en la Sección Específica de las Bases (A9): sin llenarla, esa condición de contratación sale sin completar.",
      },
      {
        name: "condiciones_obra",
        label: "Condiciones específicas de obra / consultoría de obra",
        tipo: "textarea",
        ancho: "full",
        mostrarParaObjeto: ["obra", "consultoria_obra"],
        baseLegal: "Arts. 46.4 y 154.1 Reglamento",
        ayuda: "Metas físicas u objetivos funcionales, disponibilidad del terreno, seguros, BIM, gestión de la calidad y anexos técnicos. Viene de la ficha. (La gestión de riesgos tiene su propio campo: «Riesgos identificados y su asignación», que aplica a todo objeto.)",
      },
      // Insumos del Art. 126.2: el plazo de los rutinarios/operacionales de
      // provisión continua no puede ser menor a un año.
      {
        // Art. 44.3, literal: "Al elaborar el requerimiento se inicia la
        // identificación y evaluación de riesgos asociados al proceso de
        // contratación, así como SU ASIGNACIÓN A ALGUNA DE LAS PARTES, lo cual
        // sirve de insumo para la elaboración de la estrategia de contratación".
        //
        // La asignación es lo que faltaba: la matriz de la ficha identifica y
        // valora, pero no dice quién asume cada riesgo, que es justo el insumo
        // que la estrategia necesita.
        name: "riesgos_asignacion",
        label: "Riesgos identificados y su asignación a las partes",
        tipo: "textarea",
        ancho: "full",
        recomendado: true,
        baseLegal: "Art. 44.3 Reglamento · la identificación, evaluación y asignación de riesgos se inicia en el requerimiento y es insumo de la estrategia",
        ayuda: "Qué riesgos se han identificado y cuál asume la entidad y cuál el contratista. La matriz de la ficha los identifica; aquí se reparten.",
      },
      {
        // Art. 44.4: "en el caso de bienes y obras, se evalúa la necesidad de
        // contar con prestaciones accesorias como el mantenimiento y la
        // operación, considerando el CICLO DE VIDA del activo".
        name: "prestaciones_accesorias",
        label: "Prestaciones accesorias (mantenimiento, operación)",
        tipo: "textarea",
        ancho: "full",
        recomendado: true,
        // 44.4, literal: "en el caso de bienes y obras".
        mostrarParaObjeto: ["bien", "obra"],
        baseLegal: "Art. 44.4 Reglamento · en bienes y obras se evalúa la necesidad de prestaciones accesorias considerando el ciclo de vida del activo",
        ayuda: "Solo bienes y obras. Si no corresponden, déjalo dicho: en blanco no se distingue de «no lo he evaluado».",
      },
      {
        // Art. 44.5: el requerimiento INCLUYE las normas de cumplimiento
        // obligatorio; las voluntarias solo con sustento en la estrategia y
        // cumpliendo las cuatro condiciones i)-iv).
        name: "normas_tecnicas",
        label: "Normas técnicas aplicables",
        tipo: "textarea",
        ancho: "full",
        recomendado: true,
        baseLegal: "Art. 44.5 Reglamento · leyes, reglamentos, normas metrológicas y normas técnicas de cumplimiento OBLIGATORIO; las voluntarias requieren sustento en la estrategia",
        ayuda: "Las obligatorias se incluyen sin más. Una norma técnica voluntaria solo cabe si se sustenta en la estrategia y hay quien acredite su cumplimiento en el mercado (Art. 44.5.i-iv).",
      },
      {
          name: "plazo_dias",
          recomendado: true,
          label: "Plazo de ejecución (días)",
          tipo: "number",
          baseLegal: "Art. 126.2 Reglamento",
          ayuda: "En bienes y servicios rutinarios u operacionales de provisión continua o periódica, el plazo no puede ser menor a un año (365 días)."
      },
      {
          // El cómputo (calendario/hábiles) lo elige el área usuaria en la ficha
          // (Art. 105.3) y hasta ahora no viajaba: el plazo llegaba como número
          // suelto y A3 lo daba por «calendario». Se trae para no cambiar en
          // silencio la base de cómputo cuando la ficha dijo «hábiles».
          name: "plazo_unidad",
          recomendado: true,
          label: "Cómputo del plazo",
          tipo: "select",
          opciones: [
            { value: "calendario", label: "Días calendario" },
            { value: "habiles", label: "Días hábiles" },
          ],
          baseLegal: "Art. 105.3 Reglamento · durante la ejecución los plazos se cuentan en días CALENDARIO salvo indicación en contrario.",
          ayuda: "Días calendario salvo que el requerimiento diga hábiles. Viene de la ficha."
      },
      {
          // 126.2: el plazo mínimo de un año rige en BIENES Y SERVICIOS
          // rutinarios u operacionales de provisión continua.
          mostrarParaObjeto: ["bien", "servicio"],
          name: "provision_continua",
          recomendado: true,
          label: "¿La provisión se realiza de manera continua o periódica?",
          tipo: "boolean",
          baseLegal: "Art. 126.2 Reglamento",
          ayuda: "Marca si la prestación se entrega de forma continua o periódica (p. ej. entregas diarias, mantenimiento mensual). Activa el plazo mínimo de un año."
      },
      {
          name: "estructura_bases",
          label: "Elaborado según estructura del Capítulo III de las bases estándar",
          tipo: "boolean",
          // Recomendado, no obligatorio: el Art. 44 no exige esta declaración y
          // nada aguas abajo la lee. Bloquear el paso por ella era pedir una
          // afirmación que no se usa.
          recomendado: true,
          baseLegal: "Cap. III Sección Específica bases estándar",
          ayuda: "El requerimiento debe seguir la estructura del Capítulo III de las bases estándar aplicables."
      },
      {
          name: "verificado_formal",
          label: "La DEC verificó el cumplimiento normativo del requerimiento",
          tipo: "boolean",
          // El 44.7 describe una ACTUACIÓN de la DEC ("verifica que el
          // requerimiento cumpla las disposiciones de la Ley y el Reglamento"),
          // no una casilla que condicione el paso. Se conserva como constancia.
          recomendado: true,
          baseLegal: "Art. 44.7 Reglamento · la DEC verifica que el requerimiento cumpla la Ley y el Reglamento",
          ayuda: "La DEC verifica que el requerimiento cumple los requisitos formales y de contenido del Reglamento."
      },
      {
          name: "fecha_recepcion_dec",
          label: "Fecha de recepción del requerimiento por la DEC",
          tipo: "date",
          recomendado: true,
          ayuda: "Fecha en que el área usuaria remite el requerimiento a la DEC. Viene de la ficha.",
          // El 44.2 dice que "el área usuaria remite el requerimiento a la DEC",
          // pero no exige registrar la fecha: es trazabilidad, no un requisito.
          baseLegal: "Art. 44.2 Reglamento · el área usuaria remite el requerimiento a la DEC (la fecha es trazabilidad, no una exigencia)"
      },
      // "La DEC verificó que la necesidad está en el CMN" se retiró de A3:
      // duplicaba `en_cmn` de A1, que es el paso del Art. 42 y el que comprueba
      // el Art. 54.3 para aprobar el expediente. Preguntar el mismo hecho en dos
      // pasos solo permite que se respondan distinto.
      {
        // Art. 14.2.e: antes de contratar, la DEC verifica —con las oficinas de
        // almacén y patrimonio— si la necesidad puede cubrirse con existencias
        // disponibles o bienes patrimoniales sin asignar. El área usuaria/DEC ya
        // lo marca en la ficha (`verificacion_almacen`), pero no llegaba a A3.
        name: "verificacion_almacen",
        label: "La DEC verificó las existencias de almacén / bienes patrimoniales",
        tipo: "boolean",
        recomendado: true,
        baseLegal: "Art. 14.2.e Reglamento · la DEC verifica si la necesidad puede cubrirse con existencias de almacén disponibles o bienes patrimoniales sin asignar",
        ayuda: "Marca que la DEC comprobó (con almacén y patrimonio) que la necesidad no se cubre con stock ni bienes sin asignar, y por eso procede contratar. Viene de la ficha de necesidad.",
      },
      {
          // Select Sí/NO y no casilla: el Art. 54.2.a pide "indicando SI está
          // estandarizado", es decir una declaración afirmativa. Una casilla sin
          // marcar no distingue "NO" de "no lo he respondido", así que el
          // expediente nunca daba por cumplido el 54.2.a en las contrataciones
          // NO estandarizadas (la mayoría).
          name: "estandarizado",
          label: "¿El requerimiento está estandarizado (ficha técnica/homologación)?",
          tipo: "select",
          opciones: OPCIONES_SI_NO,
          required: true,
          baseLegal: "Art. 46.1.r (verificación de si está estandarizado) · Art. 44.9 (fichas de homologación) Reglamento · integra el expediente (Art. 54.2.a)",
          ayuda: "Responde SÍ o NO. Es SÍ si tiene ficha técnica o de homologación vigente (Art. 44.9). Lo pide el Art. 54.2.a para aprobar el expediente (A8)."
      },
      {
          name: "dec_perfecciono",
          label: "¿La DEC propuso modificaciones/perfeccionamiento?",
          tipo: "boolean",
          baseLegal: "Art. 44.7 Reglamento"
      },
      {
          name: "no_objecion",
          label: "Estado de la no objeción del área usuaria",
          tipo: "select",
          required: true,
          opciones: [
              {
                  value: "no_aplica",
                  label: "No aplica (sin modificaciones)"
              },
              {
                  value: "otorgada",
                  label: "No objeción otorgada"
              },
              {
                  value: "objetado",
                  label: "Objetado (devuelto al área usuaria)"
              }
          ],
          baseLegal: "Art. 44.7-8 Reglamento",
          ayuda: "Si la DEC modificó el requerimiento, debe obtener la no objeción del área usuaria. Si es objetado, se devuelve con sustento."
      },
      {
          name: "sustento_objecion",
          label: "Sustento de la objeción (solo si aplica)",
          tipo: "textarea",
          ancho: "full",
          ayuda: "El área usuaria sustenta cómo las modificaciones no permitirían satisfacer la necesidad y finalidad pública.",
          baseLegal: "Art. 44.8 Reglamento"
      },
      {
          name: "ciclo_no_objecion",
          label: "N° de ciclo de no objeción (si hubo múltiples iteraciones)",
          tipo: "number",
          ayuda: "Si la DEC modificó más de una vez, registrar el número de iteración.",
          baseLegal: "Art. 44.7 Reglamento"
      },
      {
          name: "mejoras_estrategia",
          label: "¿Se perfeccionó durante la estrategia de contratación o interacción con el mercado?",
          tipo: "boolean",
          baseLegal: "Art. 44.7 Reglamento"
      }
      ]
  },
  A4: {
      code: "A4",
      accionGuia: "III. Estrategia de contratación",
      baseLegal: "Art. 46 del Reglamento (obras: Art. 154). Formato de Estrategia de Contratación aprobado por R.D. 013-2026-EF/54.01, dentro de la Guía de Actuaciones Preparatorias vigente (R.D. 019-2026-EF/54.01)",
      objetivo: "Analizar estratégicamente las variables de la contratación para lograr valor por dinero, considerando el requerimiento, la interacción con el mercado y la información del área usuaria. Proceso flexible; puede ajustarse hasta antes de la aprobación del expediente.",
      responsables: "DEC, en coordinación con el área usuaria",
      formatos: [
      "Formato de Estrategia de Contratación",
      "Formato de Estrategia para Catálogo Electrónico de Acuerdo Marco"
      ],
      nota: "La estrategia de contratación es un proceso flexible de análisis. NO es el mero llenado del formato. Puede variarse hasta antes de la aprobación del expediente (Art. 46.2 Reglamento). Los actos son discrecionales de la DEC (Art. 27 Ley) y se sustentan en el principio de valor por dinero (Art. 5.c Ley). Para Catálogos Electrónicos de Acuerdo Marco, usar el Formato específico.",
      campos: conGruposA4(CAMPOS_ESTRATEGIA)
  },
  A5: {
      code: "A5",
      accionGuia: "IV. Interacción con el mercado",
      baseLegal: "Art. 47 de la Ley; Arts. 47 al 50 del Reglamento",
      objetivo: "Conjunto de actividades de análisis y consulta que realiza la DEC para perfeccionar el requerimiento, evaluar la oferta y competencia, medir riesgos y actualizar la cuantía. Insumo esencial de la estrategia.",
      responsables: "DEC",
      formatos: [
      "Anexo N° 1: Formato de interacción con el mercado"
      ],
      nota: "No se realiza en contratos menores ni catálogos electrónicos de acuerdo marco. El nivel mínimo lo fija la segmentación (paso A2). Si el evaluador participa en la estrategia, puede solicitar verificar factores de evaluación en la interacción.",
      campos: [
      // El "Tipo de interacción" NO es un campo: se deduce del nivel.
      //
      // Eran dos selects independientes y el nivel ya lleva el tipo dentro
      // ("consulta_mercado_basica" es una consulta). Con Tipo=consulta y
      // Nivel=indagación básica, el Anexo salía con las DOS casillas marcadas
      // y las DOS secciones rellenas. Una decisión, un campo.
      {
          name: "nivel",
          label: "Nivel de interacción realizado",
          tipo: "select",
          required: true,
          opciones: [
              {
                  value: "indagacion_basica",
                  label: "Indagación básica (1 fuente)"
              },
              {
                  value: "indagacion_avanzada",
                  label: "Indagación avanzada (2+ fuentes)"
              },
              {
                  value: "consulta_mercado_basica",
                  label: "Consulta al mercado básica (1 herramienta)"
              },
              {
                  value: "consulta_mercado_avanzada",
                  label: "Consulta al mercado avanzada (2+ herramientas)"
              }
          ],
          baseLegal: "Arts. 48-50 Reglamento",
          ayuda: "Debe ser igual o superior al nivel mínimo determinado en la segmentación (paso A2)."
      },
      {
          name: "interaccion_fecha",
          label: "Fecha(s) de la interacción",
          tipo: "date",
          ayuda: "Registrar cuándo se realizaron las actividades de consulta o indagación."
      },
      // Fuentes de la indagación (Art. 48.2). Casillas, no texto libre: el
      // Anexo N° 1 las marca con una (X) y una textarea no puede rellenarlas.
      // Visibles según el nivel elegido: el Anexo N° 1 parte en dos secciones
      // y enseñar las fuentes en una consulta (o las herramientas en una
      // indagación) invita a marcar lo que no corresponde.
      ...FUENTES_ANEXO1.map((f) => ({
        name: f.key,
        label: `Fuente: ${f.label}`,
        tipo: "boolean" as const,
        recomendado: true,
        dependeDe: { campo: "nivel", valor: ["indagacion_basica", "indagacion_avanzada"] },
        baseLegal: "Art. 48.2 Reglamento",
        ayuda: f.ayuda,
      })),
      {
          name: "fuente_otras_detalle",
          label: "Detalle de las otras fuentes",
          tipo: "text",
          ancho: "full",
          ayuda: "Se imprime en la línea “Otras: ______” del Anexo N° 1.",
          baseLegal: "Art. 48.2.iii Reglamento"
      },
      // Herramientas de consulta al mercado (Art. 50.1), también casillas.
      ...HERRAMIENTAS_ANEXO1.map((h) => ({
        name: h.key,
        label: `Herramienta (${h.clase}): ${h.label}`,
        tipo: "boolean" as const,
        recomendado: true,
        dependeDe: { campo: "nivel", valor: ["consulta_mercado_basica", "consulta_mercado_avanzada"] },
        baseLegal: "Art. 50.1 Reglamento",
      })),
      {
          name: "herr_escrita_otro_detalle",
          label: "Detalle de la otra herramienta escrita",
          tipo: "text",
          ancho: "full",
          baseLegal: "Art. 50.1.a Reglamento"
      },
      {
          name: "herr_reunion_otros_detalle",
          label: "Detalle de las otras reuniones",
          tipo: "text",
          ancho: "full",
          baseLegal: "Art. 50.1.b Reglamento"
      },
      // Reuniones (Art. 50.1.b) sin acta como la difusión (no la exige el
      // Reglamento), pero SÍ con fecha y resumen: sin esto, el Anexo N° 1
      // terminaba imprimiendo solo la etiqueta pelada ("Herramienta de consulta
      // al mercado utilizada(s): Reuniones informativas.") sin ningún sustento
      // real de lo hecho. Se excluyen "Otro/Otros" (ya tienen su campo de
      // detalle arriba) y la difusión (tiene su propio flujo de actas, Art. 51).
      ...HERRAMIENTAS_ANEXO1.filter((h) => h.clase.startsWith("Reuniones") && !("detalleCelda" in h)).flatMap((h) => [
        {
          name: `${h.key}_fecha`,
          recomendado: true,
          label: `Fecha: ${h.label}`,
          tipo: "date" as const,
          dependeDe: { campo: h.key, valor: ["true"] },
          baseLegal: "Art. 50.1.b Reglamento",
          ayuda: `Solo si marcaste "${h.label}". Fecha en que se realizó.`,
        },
        {
          name: `${h.key}_resumen`,
          recomendado: true,
          label: `Resumen: ${h.label}`,
          tipo: "textarea" as const,
          ancho: "full" as const,
          dependeDe: { campo: h.key, valor: ["true"] },
          baseLegal: "Art. 50.1.b Reglamento",
          ayuda: `Solo si marcaste "${h.label}". Quiénes participaron y qué se trató.`,
        },
      ]),
      // Difusión del requerimiento (Art. 51): su flujo —consultas técnicas,
      // absolución y acta— ocurre EN la Pladicop, así que aquí solo se REFERENCIA
      // (N° y fecha del acta, resumen), no se replica. Visible solo si se marcó la
      // difusión como herramienta usada.
      {
          name: "difusion_acta_numero",
          recomendado: true,
          label: "N° del acta de absolución (difusión del requerimiento)",
          tipo: "text",
          dependeDe: { campo: "herr_difusion", valor: ["true"] },
          baseLegal: "Art. 51.3 Reglamento · el área usuaria y la DEC publican en la Pladicop un acta con el resultado de la absolución de las consultas/comentarios técnicos",
          ayuda: "Solo si usaste la difusión del requerimiento. N° del acta de absolución publicada en la Pladicop.",
          placeholder: "ACTA N° 003-2026-DEC-MDCH"
      },
      {
          name: "difusion_acta_fecha",
          recomendado: true,
          label: "Fecha de publicación del acta en la Pladicop",
          tipo: "date",
          dependeDe: { campo: "herr_difusion", valor: ["true"] },
          baseLegal: "Art. 51.3 Reglamento",
          ayuda: "Fecha en que se publicó en la Pladicop el acta con el resultado de la absolución."
      },
      {
          name: "difusion_consultas_resumen",
          recomendado: true,
          label: "Consultas/comentarios técnicos y su absolución (resumen)",
          tipo: "textarea",
          ancho: "full",
          dependeDe: { campo: "herr_difusion", valor: ["true"] },
          baseLegal: "Art. 51.1-51.3 Reglamento · consultas técnicas absueltas obligatoriamente por el área usuaria y la DEC",
          ayuda: "Resumen de los comentarios recibidos de los proveedores y cómo se absolvieron. El detalle completo y el acta viven en la Pladicop."
      },
      // La absolución (51.3) y la reunión de confirmación/aclaración (51.4) son
      // DOS actos con DOS actas distintas —la de la reunión la dirige la DEC y se
      // publica al día hábil siguiente de realizada (51.5)—; antes solo se
      // referenciaba la de la absolución, así que si la entidad hacía la reunión
      // no había dónde registrarla.
      {
          name: "difusion_reunion_acta_numero",
          recomendado: true,
          label: "N° del acta de la reunión de confirmación y/o aclaración",
          tipo: "text",
          dependeDe: { campo: "herr_difusion", valor: ["true"] },
          baseLegal: "Art. 51.4-51.5 Reglamento · la DEC dirige la reunión de confirmación y/o aclaración con los proveedores, dentro de los 3 días hábiles siguientes a la absolución; el acta se publica en la Pladicop al día hábil siguiente de realizada",
          ayuda: "Solo si, tras la absolución, se realizó la reunión de confirmación y/o aclaración con los proveedores. N° del acta publicada en la Pladicop.",
          placeholder: "ACTA N° 004-2026-DEC-MDCH"
      },
      {
          name: "difusion_reunion_acta_fecha",
          recomendado: true,
          label: "Fecha de publicación del acta de la reunión en la Pladicop",
          tipo: "date",
          dependeDe: { campo: "herr_difusion", valor: ["true"] },
          baseLegal: "Art. 51.5 Reglamento",
          ayuda: "Fecha en que se publicó en la Pladicop el acta de la reunión de confirmación y/o aclaración. Déjala vacía si esa reunión no se realizó."
      },
      // Proveedores con los que se cotizó. Se registran en la CONSULTA al mercado
      // (Art. 49) y también en la INDAGACIÓN AVANZADA, donde el Art. 48.2 permite
      // "solicitar información a los potenciales proveedores". NO en la indagación
      // básica: esa se apoya en fuentes secundarias (histórico, Pladicop) y no
      // cotiza, así que enseñar la tabla ahí invita a inventar propuestas.
      {
          name: "proveedores",
          dependeDe: { campo: "nivel", valor: ["indagacion_avanzada", "consulta_mercado_basica", "consulta_mercado_avanzada"] },
          recomendado: true,
          label: "Proveedores consultados",
          tipo: "proveedores",
          ancho: "full",
          baseLegal: "Art. 49 Reglamento (consulta) · Art. 48.2 Reglamento (indagación avanzada: solicitar información a los potenciales proveedores)",
          ayuda: "Las propuestas recibidas determinan la cuantía de la contratación (Art. 47.1). Añade una fila por proveedor."
      },
      {
          name: "criterio_cuantia",
          dependeDe: { campo: "nivel", valor: ["indagacion_avanzada", "consulta_mercado_basica", "consulta_mercado_avanzada"] },
          recomendado: true,
          label: "Criterio para determinar la cuantía",
          tipo: "select",
          opciones: [
              {
                  value: "menor",
                  label: "Menor propuesta recibida"
              },
              {
                  value: "promedio",
                  label: "Promedio de las propuestas"
              }
          ],
          // El Art. 5.1.c de la Ley (valor por dinero) NO respalda "menor propuesta
          // por defecto": dice explícitamente "que no procure únicamente el menor
          // precio", y regula la evaluación de ofertas en la fase de SELECCIÓN, no
          // la determinación de la cuantía en actuaciones preparatorias. El
          // Reglamento no fija un método (menor/promedio) para esto —es un criterio
          // operativo de la DEC—, así que se cita solo el Art. 53 (cuantía de la
          // contratación), que sí es el artículo del que depende este campo.
          baseLegal: "Art. 53 Reglamento (cuantía de la contratación)",
          ayuda: "Con qué criterio se obtiene la cuantía de las propuestas de la tabla. Por defecto, la menor. El Reglamento no fija un método específico: es un criterio operativo de la DEC."
      },
      {
          name: "sustento_citas",
          label: "Sustento legal de la interacción con el mercado",
          tipo: "textarea",
          ancho: "full",
          ayuda: "Precargado literal del Reglamento SEGÚN EL NIVEL elegido arriba: la indagación se sustenta en el Art. 48 y la consulta al mercado en los Arts. 49-50. Editable: puedes ajustarlo antes de exportar.",
          baseLegal: "Art. 48 (indagación) · Arts. 49-50 (consulta al mercado) del Reglamento"
      },
      {
          name: "fecha_elaboracion",
          label: "Fecha de elaboración del Anexo N° 1",
          recomendado: true,
          tipo: "date",
          ayuda: "Se imprime al pie del formato. Si se deja vacía, se usa la fecha de descarga."
      },
      {
          name: "resultado_perfeccionamiento",
          recomendado: true,
          label: "Perfeccionamiento del requerimiento (conclusiones)",
          tipo: "textarea",
          ancho: "full",
          ayuda: "¿Qué ajustes, precisiones o mejoras se incorporaron al requerimiento como resultado de la interacción?"
      },
      {
          name: "resultado_competencia",
          recomendado: true,
          label: "Evaluación de la competencia del mercado",
          tipo: "textarea",
          ancho: "full",
          ayuda: "Análisis de proveedores disponibles, nivel de concurrencia esperado, capacidad del mercado para cumplir el objeto."
      },
      {
          name: "resultado_riesgos",
          recomendado: true,
          label: "Identificación de riesgos del mercado",
          tipo: "textarea",
          ancho: "full",
          ayuda: "Riesgos identificados en la interacción (disponibilidad, plazos, calidad, precios) que afectan la estrategia."
      },
      {
          name: "resultado_cuantia",
          recomendado: true,
          label: "Actualización de la cuantía de la contratación",
          tipo: "textarea",
          ancho: "full",
          ayuda: "¿La interacción generó una actualización de la cuantía de la contratación? Sustentar el nuevo monto."
      },
      {
          name: "cuantia_actualizada",
          label: "Cuantía actualizada (S/)",
          tipo: "number",
          // Se muestra con separador de miles (1,234,567.89): es un importe que se
          // firma y se compara, y sin agrupar los dígitos es fácil equivocar el orden
          // de magnitud (100000 vs 1000000).
          moneda: true,
          // Actualizar la cuantía es un FIN de la interacción (Art. 47.1), no un
          // dato opcional: de aquí salen el CCP (A7) y la aprobación (A8). Va
          // recomendado para que no quede escondido bajo "campos opcionales".
          recomendado: true,
          baseLegal: "Art. 47.1 Reglamento (actualizar la cuantía) · Art. 46.1.k (cuantía en la estrategia)"
      }
      ]
  },
  A6: {
      code: "A6",
      accionGuia: "V. Contenido del expediente: designación de evaluadores",
      baseLegal: "Arts. 56 a 60 del Reglamento (56 Evaluadores, 57 Expertos, 58 Oficial de compra, 59 Comité, 60 Jurados)",
      objetivo: "Designar al evaluador que conducirá la fase de selección según el tipo de procedimiento y modalidad: oficial de compra, comité o jurado. En caso de jurado, se designa también al responsable de la DEC.",
      responsables: "AGA (designa) / DEC (propone)",
      formatos: [
      "Documento de designación de evaluadores",
      "Acta de conformación de comité (si aplica)"
      ],
      nota: "Ver Cuadros N° 6 y 7 de la Guía para la matriz evaluador-procedimiento. Oficial de compra: comprador público de la DEC (Art. 58.1). Comité: 3 integrantes —al menos uno comprador público de la DEC y al menos uno experto o profesional con conocimiento técnico y/o experiencia en el objeto (Art. 56.1.b); no se les exige umbral de años—. Jurado: 3 o 5 expertos individuales, y SOLO en su caso rige el mínimo de ≥8 años de experiencia general y ≥5 en la especialidad (Art. 57.2). Tanto el comité como el jurado se designan con titulares Y suplentes (Arts. 59.1 y 60.1).",
      campos: [
      {
          name: "tipo_evaluador",
          label: "Tipo de evaluador",
          tipo: "select",
          required: true,
          opciones: OPCIONES_TIPO_EVALUADOR,
          baseLegal: "Arts. 56-60 Reglamento",
          ayuda: "Oficial de compra: comprador público DEC. Comité: 3 integrantes, decisión colegiada. Jurado: 3 o 5 expertos, decisión individual."
      },
      {
          name: "cantidad_integrantes",
          label: "Número de integrantes",
          tipo: "select",
          required: true,
          opciones: [
              {
                  value: "1",
                  label: "1 (oficial de compra)"
              },
              {
                  value: "3",
                  label: "3 (comité o jurado)"
              },
              {
                  value: "5",
                  label: "5 (jurado)"
              }
          ],
          baseLegal: "Arts. 56-60 Reglamento",
          ayuda: "Comité siempre 3. Jurado: 3 o 5 según complejidad."
      },
      {
          name: "integrantes",
          label: "Nombres y roles de los integrantes",
          tipo: "evaluadores",
          ancho: "full",
          required: true,
          grupo: "PROPUESTA DE LA DEPENDENCIA ENCARGADA DE LAS CONTRATACIONES (DEC)",
          baseLegal: "Arts. 56-60 Reglamento",
          ayuda: "En COMITÉ, la DEC propone a su comprador público (titular) y su suplente. En oficial de compra o jurado, aquí van todos los integrantes del panel. Elige a los usuarios de Configuración o añade a mano; marca titular/suplente. En el .xls de comité, el titular va a D30 y su suplente a D31."
      },
      {
          // Segunda propuesta del comité (Art. 56.1.b): los expertos/profesionales
          // con conocimiento técnico que propone el área usuaria. Solo COMITÉ.
          name: "integrantes_area_usuaria",
          label: "Miembros propuestos por el área usuaria",
          tipo: "evaluadores",
          ancho: "full",
          recomendado: true,
          grupo: "PROPUESTA DE MIEMBROS DEL COMITÉ DE SELECCIÓN · ÁREA USUARIA",
          dependeDe: { campo: "tipo_evaluador", valor: ["comite"] },
          baseLegal: "Art. 56.1.b Reglamento",
          ayuda: "Los dos expertos o profesionales con conocimiento técnico en el objeto que propone el área usuaria, con sus suplentes. En el .xls: 1er miembro D54 y su suplente D55; 2º miembro D56 y su suplente D57."
      },
      {
          name: "experiencia_expertos",
          label: "Sustento de experiencia de los expertos (si aplica)",
          tipo: "textarea",
          ancho: "full",
          baseLegal: "Art. 57.2 Reglamento (umbral solo del jurado); Art. 56.1.b (experto del comité)",
          ayuda: "SOLO en el JURADO sus expertos requieren ≥8 años de experiencia general y ≥5 en la especialidad del objeto (Art. 57.2). El experto del comité solo necesita conocimiento técnico y/o experiencia (Art. 56.1.b), sin umbral de años. Incluir CV o referencia cuando aplique."
      },
      {
          name: "responsable_dec",
          label: "Responsable de la DEC (para jurado)",
          tipo: "text",
          ayuda: "Cuando se designa jurado, se debe identificar al responsable de la DEC que conduce el procedimiento."
      },
      {
          name: "documento_designacion",
          label: "N° del memorándum de designación",
          tipo: "text",
          required: true,
          prefijo: "Memorándum N° ",
          baseLegal: "Arts. 56-60 Reglamento",
          ayuda: "Solo el número: el «Memorándum N° » ya va delante. Es el documento que formaliza la designación y encabeza el memorándum que se exporta.",
          placeholder: "52-2026-JRM-OL-OGA/MDCH"
      },
      // Cabecera de la solicitud de comité (AL/ATENCIÓN/DE, Art. 42.2). Solo para
      // COMITÉ: es la solicitud de propuesta de miembros que se exporta en Excel.
      // Misma mecánica que el informe A8: AL elige la OFICINA del catálogo (el .xls
      // pone a su responsable, por defecto la OGA); ATENCIÓN es texto que, si se
      // deja vacío, se rellena solo con la AGA de Configuración → Municipalidad; y
      // el DE va oculto porque siempre es la DEC.
      {
          name: "destinatario",
          label: "AL (destinatario)",
          tipo: "select",
          ancho: "full",
          required: true,
          opcionesOficinas: true,
          dependeDe: { campo: "tipo_evaluador", valor: ["comite"] },
          baseLegal: "Art. 42.2 Reglamento",
          ayuda: "Elige la oficina a la que se dirige la solicitud de propuesta de miembros. Por defecto la OFICINA GENERAL DE ADMINISTRACIÓN. En el Excel sale su responsable (grado, nombre y cargo)."
      },
      {
          // Desplegable de autoridad, preseleccionado en la AGA. No es una oficina
          // del catálogo (la AGA es un rol, no una oficina emisora): sus opciones
          // son las autoridades de la entidad. El Excel imprime su grado, nombre y
          // cargo, tomados de Configuración → Municipalidad.
          name: "atencion",
          label: "ATENCIÓN",
          tipo: "select",
          ancho: "full",
          required: true,
          opciones: [
              { value: "aga", label: "AUTORIDAD DE GESTIÓN ADMINISTRATIVA" },
              { value: "gerente", label: "GERENTE DE LA ENTIDAD" }
          ],
          dependeDe: { campo: "tipo_evaluador", valor: ["comite"] },
          ayuda: "Autoridad a cuya atención se dirige la solicitud. Por defecto la Autoridad de Gestión Administrativa (AGA). En el Excel sale su grado, nombre y cargo, de Configuración → Municipalidad."
      },
      {
          // Oculto en el formulario: el DE es SIEMPRE la dependencia encargada de
          // las contrataciones (la DEC), así que no hace falta elegirlo. Se sigue
          // consumiendo: la previa y el .xls lo imprimen con su responsable.
          name: "remitente",
          label: "DE (remitente)",
          tipo: "textarea",
          ancho: "full",
          oculto: true,
          dependeDe: { campo: "tipo_evaluador", valor: ["comite"] },
          ayuda: "Se toma de la dependencia encargada de las contrataciones. Sale en la previa y el .xls con su responsable."
      },
      {
          name: "fecha_designacion",
          label: "Fecha de designación",
          tipo: "date",
          required: true,
          ayuda: "Fecha del documento de designación. Va en el memorándum, la declaración jurada y el consentimiento.",
          baseLegal: "Arts. 56-60 Reglamento"
      },
      {
          // Art. 56.7: cada evaluador suscribe la jurada de no conflicto ANTES de
          // ser designado. El paso genera esa jurada por integrante; aquí la DEC
          // confirma que están firmadas. No bloquea (recomendado): es constancia.
          name: "declaraciones_juradas_suscritas",
          label: "Las declaraciones juradas de no conflicto de intereses están suscritas",
          tipo: "boolean",
          ancho: "full",
          recomendado: true,
          baseLegal: "Art. 56.7 Reglamento",
          ayuda: "Cada integrante suscribe, PREVIO a su designación, la declaración jurada de no tener conflicto de intereses (Art. 56.7). Descárgala desde este paso (una por integrante) y confirma aquí que están firmadas."
      }
      // El memorándum lo emite el jefe de la DEC (Art. 58.1): su grado y nombre
      // salen de Configuración › Usuarios (el usuario con rol de la DEC), no de
      // un campo aquí. Antes había campos firmante_*; se retiraron.
      ]
  },
  A7: {
      code: "A7",
      accionGuia: "V. Contenido del expediente (CCP)",
      baseLegal: "Art. 14.2.j (la DEC solicita la certificación o previsión presupuestal); Art. 53 (la cuantía —actualizada por la interacción con el mercado— es la base para gestionarla); Art. 54.2.f (integra el expediente que aprueba la AGA) del Reglamento",
      objetivo: "Contar con la certificación de crédito presupuestario (CCP) o la previsión presupuestal que respalde la contratación. Integra el expediente de contratación (Art. 54.2.f), así que es requisito para su aprobación por la AGA (A8).",
      responsables: "DEC / Oficina de Presupuesto o la que haga sus veces",
      formatos: [
      "Certificación de Crédito Presupuestario (CCP)",
      "Previsión presupuestal"
      ],
      nota: "La DEC solicita la certificación o previsión a la oficina de presupuesto (Art. 14.2.j), considerando la cuantía de la contratación —la del PAC del CMN, actualizada por la interacción con el mercado del paso A5 (Art. 53.1)—. La norma usa la fórmula 'y/o' (Art. 53.1 y 54.2.f): la CCP acredita disponibilidad del ejercicio vigente; la previsión aplica cuando el devengado se imputa a ejercicios futuros —de acuerdo con la normativa presupuestal vigente a la que remite el Art. 54.2.f—; y se requieren AMBAS cuando la ejecución contractual cruza años fiscales, caso en que la cobertura se juzga sobre la suma de las dos. Como integra el expediente (Art. 54.2.f), sin CCP ni previsión la AGA no puede aprobarlo (A8).",
      campos: [
      {
          // Fecha del documento con el que la DEC solicita la certificación/previsión
          // (Art. 14.2.j). Se siembra con la de hoy y queda editable; alimenta la
          // celda C12 de la solicitud. Es la fecha de la SOLICITUD, distinta de la
          // fecha de EMISIÓN de la CCP/previsión (que responde Presupuesto).
          name: "fecha_solicitud",
          label: "Fecha de la solicitud de certificación",
          tipo: "date",
          required: true,
          baseLegal: "Art. 14.2.j Reglamento",
          ayuda: "Por defecto la fecha de hoy; editable. Es la fecha con la que la DEC pide la certificación o previsión a Presupuesto, y sale en la celda C12 de la solicitud."
      },
      {
          // Correlativo de la solicitud (mismo tratamiento que el informe de A8): se
          // propone el siguiente de la serie INFORME de la DEC y, al descargar, se
          // CONSUME de forma atómica y se congela, para que no se repita ni choque
          // con el informe de A8 (comparten la misma serie).
          name: "numero_solicitud",
          label: "Número de la solicitud de certificación",
          tipo: "text",
          prefijo: "INFORME N° ",
          placeholder: "001-2026-JRM-UA-OGA/MDCH",
          ayuda: "Solo el número: el «INFORME N° » ya va delante. Se propone el siguiente correlativo de la DEC (Configuración → Numeración); no consume el número hasta que descargas la solicitud."
      },
      {
          // Destinatarios de la solicitud, como oficinas (igual que el AL/DE de A8):
          // el .xls imprime a su responsable, tomándolo del jefe en Usuarios. Por
          // defecto la OGA (AL) y Presupuesto (ATENCIÓN); editables por si la entidad
          // los nombra distinto. Antes se resolvían solo por nombre "hardcodeado".
          name: "solicitud_al",
          label: "A (destinatario de la solicitud)",
          tipo: "select",
          recomendado: true,
          opcionesOficinas: true,
          baseLegal: "Art. 14.2.j Reglamento",
          ayuda: "Oficina a la que la DEC eleva la solicitud. Por defecto la OFICINA GENERAL DE ADMINISTRACION. En el .xls sale su responsable."
      },
      {
          name: "solicitud_atencion",
          label: "ATENCIÓN de la solicitud (Presupuesto)",
          tipo: "select",
          recomendado: true,
          opcionesOficinas: true,
          baseLegal: "Art. 14.2.j Reglamento",
          ayuda: "Oficina de presupuesto que certifica (la que emite la CCP/previsión). Por defecto la de Planeamiento y Presupuesto. En el .xls sale su responsable."
      },
      {
          name: "tipo",
          label: "Tipo de documento presupuestal",
          tipo: "select",
          required: true,
          opciones: [
              {
                  value: "ccp",
                  label: "Certificación de Crédito Presupuestario"
              },
              {
                  value: "prevision",
                  label: "Previsión presupuestal"
              },
              {
                  value: "ambas",
                  label: "Ambas (CCP + previsión)"
              }
          ],
          baseLegal: "Art. 53.1 y 54.2.f Reglamento",
          ayuda: "La norma usa la fórmula 'y/o' (Art. 53.1 y 54.2.f): CCP para el gasto del ejercicio vigente; previsión cuando el devengado se imputa a ejercicios futuros; ambas cuando la ejecución contractual cruza años fiscales, según la normativa presupuestal vigente a la que remite el Art. 54.2.f."
      },
      // Documento único (CCP o previsión). Se ocultan si se eligió "ambas". El N°
      // de la certificación va agrupado con su Fecha de emisión (más abajo).
      {
          name: "monto",
          label: "Monto certificado o previsto (S/)",
          tipo: "number",
          moneda: true,
          required: true,
          dependeDe: { campo: "tipo", valor: ["ccp", "prevision"] },
          baseLegal: "Art. 53 Reglamento",
          ayuda: "Debe cubrir la cuantía de la contratación: la del PAC del CMN actualizada por la interacción con el mercado (A5, Art. 53.1). Si no la cubre, no procede aprobar el expediente."
      },
      // "Ambas": la ejecución cruza años fiscales, así que hay dos documentos
      // —CCP (año en curso) y previsión (años siguientes)—, cada uno con su N°,
      // monto y fecha. La cobertura se juzga sobre la SUMA de ambos montos.
      {
          name: "numero_ccp",
          label: "N° de la CCP (año en curso)",
          tipo: "text",
          required: true,
          dependeDe: { campo: "tipo", valor: "ambas" },
          ayuda: "Número de la Certificación de Crédito Presupuestario del ejercicio vigente."
      },
      {
          name: "monto_ccp",
          label: "Monto de la CCP (S/)",
          tipo: "number",
          moneda: true,
          required: true,
          dependeDe: { campo: "tipo", valor: "ambas" },
          baseLegal: "Art. 53 Reglamento",
          ayuda: "Parte de la cuantía imputable al año fiscal en curso."
      },
      {
          name: "fecha_ccp",
          label: "Fecha de emisión de la CCP",
          tipo: "date",
          required: true,
          dependeDe: { campo: "tipo", valor: "ambas" }
      },
      {
          name: "numero_prevision",
          label: "N° de la previsión (años siguientes)",
          tipo: "text",
          required: true,
          dependeDe: { campo: "tipo", valor: "ambas" },
          ayuda: "Número de la nota de previsión presupuestal para los ejercicios futuros (Art. 54.2.f, de acuerdo con la normativa presupuestal vigente)."
      },
      {
          name: "monto_prevision",
          label: "Monto de la previsión (S/)",
          tipo: "number",
          moneda: true,
          required: true,
          dependeDe: { campo: "tipo", valor: "ambas" },
          baseLegal: "Art. 53 Reglamento",
          ayuda: "Parte de la cuantía por ejecutar en años fiscales siguientes."
      },
      {
          name: "fecha_prevision",
          label: "Fecha de emisión de la previsión",
          tipo: "date",
          required: true,
          dependeDe: { campo: "tipo", valor: "ambas" }
      },
      {
          name: "vigencia",
          label: "Ejercicio presupuestal / año de imputación",
          tipo: "number",
          ayuda: "Año fiscal al que corresponde el crédito (ej. 2026). Para previsiones, puede ser plurianual.",
          placeholder: "2026"
      },
      {
          name: "meta_presupuestal",
          label: "Meta presupuestal",
          tipo: "text",
          required: true,
          ayuda: "Código y/o nombre de la meta a la que se imputa el gasto."
      },
      {
          name: "fuente_financiamiento",
          label: "Fuente de financiamiento",
          tipo: "text",
          required: true,
          baseLegal: "Art. 46.1.k Reglamento",
          ayuda: "RO, RDR, RRC, DON, OP, etc. según clasificador de fuentes."
      },
      {
          name: "area_emisora",
          label: "Área que emite el documento",
          tipo: "text",
          ayuda: "Oficina de Presupuesto, OPP, OFINA o la que corresponda.",
          placeholder: "Ej. Oficina de Presupuesto"
      },
      {
          name: "numero",
          label: "Número de certificación/nota",
          tipo: "text",
          required: true,
          dependeDe: { campo: "tipo", valor: ["ccp", "prevision"] },
          ayuda: "N° de CCP, nota de previsión o documento equivalente."
      },
      {
          name: "fecha",
          label: "Fecha de emisión",
          tipo: "date",
          required: true,
          dependeDe: { campo: "tipo", valor: ["ccp", "prevision"] },
          ayuda: "Fecha de emisión de la CCP o previsión presupuestal.",
          baseLegal: "Art. 14.2.j Reglamento"
      }
      ]
  },
  A8: {
      code: "A8",
      accionGuia: "V. Aprobación del Expediente de Contratación",
      // La cita era "Art. 41 del Reglamento (contenido)", y el 41 no dice eso:
      // define el ALCANCE de la fase ("comprende todas aquellas acciones desde
      // la segmentación... hasta antes de la convocatoria"). El contenido del
      // expediente es el Art. 54.2 y el requisito del CMN, el 54.3. La lista de
      // abajo ya era la del 54.2; solo el número estaba mal.
      baseLegal: "Art. 54.2 del Reglamento (contenido); Art. 54.3 (previsto en el CMN); Anexo N° 2 (formato); aprobación por la AGA (Art. 19 Reglamento; facultad delegable Art. 25.2 Ley)",
      objetivo: "Recopilar y sistematizar toda la información del proceso en un expediente único para su aprobación por la autoridad competente (AGA), mediante el formato del Anexo N° 2. Requisito previo: la necesidad debe estar prevista en el CMN (Art. 54.3).",
      responsables: "AGA (aprueba); DEC (elabora y consolida)",
      formatos: [
      "Anexo N° 2: Formato de aprobación del expediente de contratación"
      ],
      nota: "Contenido del expediente (Art. 54.2 Reglamento): a) requerimiento final, indicando si está estandarizado; b) documento que aprueba la compatibilización, cuando corresponda; c) la estrategia de contratación, que incluye la interacción con el mercado realizada; d) la cuantía de la contratación; e) el documento de designación de evaluadores; f) la CCP y/o previsión presupuestal; g) otra documentación necesaria. La AGA puede delegar la aprobación mediante resolución (Art. 25.2 Ley). La DEC es responsable de la consolidación del expediente.",
      // La presencia de cada literal del Art. 54.2 (requerimiento, estrategia,
      // cuantía, evaluadores, CCP, CMN) NO se re-pregunta con casillas: es un
      // hecho de los pasos A1/A3/A4/A5/A6/A7 que la app verifica sola y muestra
      // como puerta de aprobación (lib/expediente-contenido.ts). Aquí solo se
      // capturan los datos PROPIOS del acto aprobatorio. Antes había siete
      // casillas req_* que duplicaban esa verificación, no alimentaban el Anexo
      // N° 2 y podían contradecir la realidad; se retiraron.
      // Disposición en dos columnas: el acto aprobatorio arriba (documento de
      // aprobación · fecha) y, debajo en la MISMA columna izquierda, la cabecera del
      // informe (número, AL, ATENCIÓN, DE). La columna derecha solo lleva la fecha,
      // así que los campos que van después se ponen a ancho completo para caer
      // debajo del bloque y no rellenar los huecos de la derecha.
      campos: [
      {
          name: "numero_documento",
          label: "Número del documento de aprobación",
          tipo: "text",
          required: true,
          columna: 1,
          baseLegal: "Art. 54.2 Reglamento; Anexo N° 2",
          ayuda: "N° del Anexo N° 2 o documento de aprobación del expediente."
      },
      {
          name: "fecha_aprobacion",
          label: "Fecha de aprobación",
          tipo: "date",
          required: true,
          columna: 2,
          ayuda: "Fecha de suscripción del Anexo N° 2 o documento de aprobación.",
          baseLegal: "Art. 54.2 Reglamento"
      },
      // ── Cabecera del informe de solicitud de aprobación ──────────────────
      //
      // Estos campos existen porque el .docx los sacaba de los perfiles con rol
      // `aga` y `titular`, que en una municipalidad distrital no existen: el gerente
      // municipal no usa la aplicación. La cabecera salía en blanco. Ahora son campos
      // del paso —visibles, editables y prellenados de donde el dato SÍ está—, igual
      // que la cabecera del informe de segmentación (A2).
      {
          name: "numero_informe",
          label: "Número del informe (solicitud de aprobación)",
          tipo: "text",
          prefijo: "INFORME N° ",
          columna: 1,
          placeholder: "001-2026-JRM-UA-OGA/MDCH",
          ayuda: "Solo el número: el «INFORME N° » ya va delante. Se propone el siguiente correlativo de la oficina según Configuración → Numeración; es una sugerencia y no consume el número hasta que emitas el documento."
      },
      {
          // Se elige la OFICINA (no el nombre a mano): el informe imprime a su
          // responsable —grado, nombre y cargo— tomándolo de Configuración →
          // Oficinas, así que el dato no puede quedar desfasado ni mal tecleado.
          // Las opciones (el catálogo de oficinas) las inyecta el panel.
          name: "autoridad",
          label: "AL (destinatario que aprueba)",
          tipo: "select",
          required: true,
          columna: 1,
          opcionesOficinas: true,
          baseLegal: "Art. 54.2 Reglamento (la AGA aprueba); Art. 19 Reglamento",
          ayuda: "Elige la oficina destinataria. Por defecto la OFICINA GENERAL DE ADMINISTRACION (inmediata superior de la que gestiona contrataciones). En la previa y el .docx sale su responsable."
      },
      {
          // Mismo desplegable que la ATENCIÓN de A6: la AGA y el gerente son ROLES
          // de la entidad, no oficinas del catálogo. Por defecto la AGA ("aga"). El
          // informe imprime su grado, nombre y cargo, de Configuración → Municipalidad.
          // Antes era texto libre y quedaba tecleado a mano (desalineado con A6).
          name: "atencion",
          label: "ATENCIÓN (gerencia de la entidad)",
          tipo: "select",
          required: true,
          columna: 1,
          opciones: [
              { value: "aga", label: "AUTORIDAD DE GESTIÓN ADMINISTRATIVA" },
              { value: "gerente", label: "GERENTE DE LA ENTIDAD" }
          ],
          ayuda: "Autoridad a cuya atención se dirige el informe. Por defecto la Autoridad de Gestión Administrativa (AGA). En la previa y el .docx sale su grado, nombre y cargo, de Configuración → Municipalidad."
      },
      {
          // Igual que el AL: se elige la OFICINA y el informe pone a su jefatura.
          // Oculto en el formulario: el DE es SIEMPRE la dependencia de
          // contrataciones, así que no hace falta elegirlo. Se sigue sembrando y la
          // previa/.docx lo imprimen con su responsable.
          name: "remitente",
          label: "DE (remitente)",
          tipo: "select",
          oculto: true,
          opcionesOficinas: true,
          ayuda: "Se toma de la dependencia encargada de las contrataciones. Sale en la previa y el .docx con su responsable."
      },
      {
          name: "delegacion",
          label: "¿Aprobación por facultad delegada?",
          tipo: "boolean",
          ancho: "full",
          baseLegal: "Art. 25.2 Ley",
          ayuda: "El titular o la AGA pueden delegar, mediante resolución, las facultades que la Ley les otorga, salvo las excepciones del Reglamento (Art. 25.2 Ley)."
      },
      {
          // La delegación se hace SIEMPRE mediante resolución (Art. 25.2 Ley), así
          // que si se aprueba por facultad delegada hay que identificarla: el
          // informe la cita para dejar constancia de la habilitación de quien firma.
          name: "resolucion_delegacion",
          label: "Resolución que delega la facultad",
          tipo: "text",
          prefijo: "Resolución N° ",
          ancho: "full",
          dependeDe: { campo: "delegacion", valor: ["true"] },
          requeridoSi: { campo: "delegacion", valor: "true" },
          baseLegal: "Art. 25.2 Ley",
          placeholder: "001-2026-MDCH/GM",
          ayuda: "Solo el número: el «Resolución N° » ya va delante. Es la resolución con la que el titular o la AGA delegó la facultad de aprobar el expediente."
      },
      {
          name: "fecha_delegacion",
          label: "Fecha de la resolución de delegación",
          tipo: "date",
          ancho: "full",
          dependeDe: { campo: "delegacion", valor: ["true"] },
          baseLegal: "Art. 25.2 Ley"
      },
      {
          name: "req_otros",
          label: "Otros documentos aplicables (Art. 54.2.g)",
          tipo: "textarea",
          ancho: "full",
          baseLegal: "Art. 54.2.g Reglamento",
          ayuda: "Estudios, informes técnicos, opiniones legales, autorizaciones sectoriales, etc. que correspondan según el objeto y la normativa que lo regula."
      },
      {
          name: "observaciones",
          label: "Observaciones / notas del acto aprobatorio",
          tipo: "textarea",
          ancho: "full",
          ayuda: "Condiciones, salvedades o precisiones incluidas en el acto de aprobación."
      }
      ]
  },
  A9: {
      code: "A9",
      accionGuia: "VI. Elaboración de Bases",
      baseLegal: "Bases estándar vigentes (R.D. 001-2026-EF/54.01)",
      objetivo: "Establecer las reglas claras, objetivas y obligatorias del procedimiento de selección, desde la convocatoria hasta la adjudicación de la buena pro. Uso obligatorio de las bases estándar vigentes.",
      responsables: "Oficial de compra o comité; DEC si hubiera jurado",
      formatos: [
      "Bases del procedimiento de selección"
      ],
      nota: "Las bases NO requieren aprobación: basta con su publicación en el SEACE (PLADICOP). El contenido varía según tipo y modalidad del procedimiento. Uso obligatorio de bases estándar.",
      campos: [
      {
          name: "elaborado_por",
          label: "Elaborado por",
          tipo: "select",
          required: true,
          opciones: [
              {
                  value: "oficial_compra",
                  label: "Oficial de compra"
              },
              {
                  value: "comite",
                  label: "Comité de selección"
              },
              {
                  value: "dec",
                  label: "DEC (en caso de jurado)"
              }
          ],
          baseLegal: "Bases estándar vigentes",
          ayuda: "Las bases son elaboradas por quien conduce la fase de selección según el tipo de evaluador designado."
      },
      {
          name: "usa_bases_estandar",
          label: "Se usaron las bases estándar vigentes",
          tipo: "boolean",
          required: true,
          baseLegal: "R.D. 001-2026-EF/54.01",
          ayuda: "Es obligatorio usar las bases estándar aprobadas por la DGA para cada tipo de procedimiento."
      },
      {
          name: "version_bases_estandar",
          label: "Versión de las bases estándar",
          tipo: "text",
          ayuda: "R.D. y fecha de aprobación de la versión de bases estándar utilizada.",
          placeholder: "Ej. R.D. 001-2026-EF/54.01",
          enlace: {
              texto: "Ver las bases estándar vigentes en el portal del MEF",
              url: "https://www.gob.pe/institucion/mef/normas-legales/7614342-001-2026-ef-54-01"
          }
      },
      {
          name: "tipo_procedimiento",
          label: "Tipo/modalidad del procedimiento",
          tipo: "text",
          required: true,
          baseLegal: "Art. 46.1.a Reglamento",
          ayuda: "Licitación pública, concurso público, subasta inversa, etc. según objeto y cuantía."
      },
      {
          name: "contiene_requerimiento",
          label: "Incluye el requerimiento (estructura de bases estándar)",
          tipo: "boolean",
          required: true,
          baseLegal: "Bases estándar vigentes",
          ayuda: "El requerimiento debe incluirse conforme a la estructura de las bases estándar aplicables."
      },
      {
          name: "contiene_documentos_oferta",
          label: "Incluye documentos para presentación de ofertas",
          tipo: "boolean",
          required: true,
          baseLegal: "Bases estándar vigentes",
          ayuda: "Declaraciones juradas, garantías, promesas de consorcio, etc. según las bases estándar."
      },
      {
          name: "contiene_condiciones_contractuales",
          label: "Incluye condiciones para la ejecución contractual",
          tipo: "boolean",
          required: true,
          baseLegal: "Bases estándar vigentes",
          ayuda: "Plazo de ejecución, forma de pago, penalidades, anticipos, garantías, etc."
      },
      {
          name: "factores_evaluacion_definidos",
          label: "Factores de evaluación definidos en las bases",
          tipo: "boolean",
          required: true,
          baseLegal: "Bases estándar vigentes",
          ayuda: "Los factores con los que se calificará la oferta técnica/económica, conforme a la estructura de las bases estándar aplicables."
      },
      {
          name: "publicada_seace",
          label: "Bases publicadas en el SEACE/PLADICOP",
          tipo: "boolean",
          required: true,
          baseLegal: "Bases estándar vigentes",
          ayuda: "La publicación en PLADICOP es el acto que formaliza las bases; no requieren aprobación."
      },
      {
          name: "fecha_publicacion",
          label: "Fecha de publicación",
          tipo: "date",
          required: true,
          ayuda: "Fecha de publicación de las bases en el SEACE/PLADICOP.",
          baseLegal: "Bases estándar vigentes"
      },
      {
          name: "observaciones",
          label: "Observaciones",
          tipo: "textarea",
          ancho: "full",
          ayuda: "Precisiones sobre el contenido de las bases, factores de evaluación, cronograma, etc."
      }
      ]
  },
  A10: {
      code: "A10",
      accionGuia: "VII. Anuncio de contratación futura (opcional)",
      baseLegal: "Art. 43 del Reglamento (Anuncio de contratación futura); beneficio de reducción de plazo: numeral 64.3 del Art. 64",
      objetivo: "Informar anticipadamente al mercado la intención de convocar un procedimiento de selección, con el fin de promover la participación de proveedores y lograr una contratación más eficiente y competitiva.",
      responsables: "DEC",
      formatos: [
      "Anuncio de contratación futura (PLADICOP / sede digital)"
      ],
      nota: "Herramienta de gestión discrecional y OPCIONAL (Art. 41 · «de corresponder»). Aunque aparece al final de la lista, NO va al terminar las actuaciones preparatorias: se publica CON ANTICIPACIÓN —normalmente en paralelo con la segmentación, el requerimiento y la estrategia—, porque publicarlo ≥ 40 días CALENDARIO antes de la convocatoria es justo lo que permite reducir el plazo entre convocatoria y presentación de ofertas (Art. 64.3 Reglamento). No sustituye la convocatoria oficial ni genera derechos u obligaciones. Se publica en PLADICOP y en la sede digital de la entidad.",
      campos: [
      {
          name: "se_publica",
          label: "¿Se publicará anuncio de contratación futura?",
          tipo: "boolean",
          baseLegal: "Art. 43 Reglamento"
      },
      {
          name: "datos_entidad",
          label: "Datos de la entidad contratante",
          tipo: "text",
          baseLegal: "Art. 43.a Reglamento",
          ayuda: "Nombre, RUC, dirección y datos de contacto de la entidad."
      },
      {
          name: "descripcion_preliminar",
          label: "Descripción preliminar del requerimiento",
          tipo: "textarea",
          ancho: "full",
          baseLegal: "Art. 43.b Reglamento",
          ayuda: "Alcance, plazo de entrega/ejecución, cantidad aproximada."
      },
      {
          name: "tipo_procedimiento_previsto",
          label: "Tipo de procedimiento de selección previsto",
          tipo: "text",
          required: true,
          baseLegal: "Art. 43.c Reglamento",
          ayuda: "Indicar el tipo de procedimiento que se prevé convocar (ej. Licitación pública, concurso público, etc.)."
      },
      {
          name: "fecha_aprox_convocatoria",
          label: "Fecha aproximada de convocatoria",
          tipo: "date",
          required: true,
          baseLegal: "Art. 43.d Reglamento",
          ayuda: "Fecha estimada en que se publicaría la convocatoria oficial."
      },
      {
          name: "publicado_pladicop",
          label: "Publicado en PLADICOP",
          tipo: "boolean",
          baseLegal: "Art. 43 Reglamento",
          ayuda: "El anuncio se publica en la Plataforma Digital de Contrataciones Públicas."
      },
      {
          name: "publicado_sede_digital",
          label: "Publicado en sede digital de la entidad",
          tipo: "boolean",
          ayuda: "Adicionalmente se publica en la sede digital de la entidad, si cuenta con ella."
      },
      {
          name: "fecha_publicacion_anuncio",
          label: "Fecha de publicación del anuncio",
          tipo: "date",
          required: true,
          ayuda: "Fecha en que se publicó el anuncio en PLADICOP y/o sede digital.",
          baseLegal: "Art. 43 Reglamento"
      },
      {
          name: "aplica_beneficio_40dias",
          label: "¿Se publicó con ≥ 40 días de anticipación a la convocatoria?",
          tipo: "boolean",
          ayuda: "Art. 64.3 Reglamento: si se publica ≥ 40 días calendario antes, se puede reducir el plazo entre convocatoria y presentación de ofertas."
      },
      {
          name: "plazo_reducido",
          label: "Plazo reducido aplicado (días)",
          tipo: "number",
          ayuda: "Si aplica el beneficio, indicar el nuevo plazo entre convocatoria y presentación de ofertas en días calendario."
      }
      ]
  }
};
export function pasoF1(code: string): PasoDetalle | undefined {
  return PASOS_F1[code];
}

/**
 * ¿El campo es obligatorio con los datos actuales del paso?
 *
 * Contempla el obligatorio fijo (`required`) y el CONDICIONAL (`requeridoSi`),
 * que depende del valor de otro campo del mismo paso. Vive aquí, junto a la
 * definición de los campos, para que la validación y el contador de pendientes
 * usen la misma regla que el rótulo "obligatorio" de la UI: si divergen, el
 * paso dice que falta algo que no marca, o al revés.
 */
export function campoEsRequerido(
  campo: CampoFormulario,
  data: Record<string, unknown> | undefined,
): boolean {
  if (campo.required) return true;
  if (!campo.requeridoSi) return false;
  // Se compara como TEXTO: el valor de un check llega como booleano y el de un
  // select como cadena, y la condición se declara igual en ambos casos.
  const actual = String(data?.[campo.requeridoSi.campo] ?? "");
  return Array.isArray(campo.requeridoSi.valor)
    ? campo.requeridoSi.valor.includes(actual)
    : campo.requeridoSi.valor === actual;
}

export type AvisoPaso = { nivel: "warn" | "error"; mensaje: string };

/**
 * Coherencia interna de A1 (Programación).
 *
 * "¿Está programada en el PAC?" y "¿Es contratación programada?" son el MISMO
 * hecho preguntado dos veces, y son dos casillas independientes: se podían
 * marcar en sentidos opuestos sin que nada avisara. El desajuste no es
 * cosmético — de `programada` depende que la línea de corte sume o no el monto
 * de esta contratación (Art. 125.2), así que una respuesta contradice a la otra
 * en un número que decide si el procedimiento es de alta cuantía.
 */
export function avisosA1(data: Record<string, unknown> | undefined): AvisoPaso[] {
  const d = data ?? {};
  // `situacion_pac` es la respuesta directa y única de A1 (un select
  // Programado/No programado). Si está respondida, no hay ambigüedad que
  // señalar. Los avisos de abajo son para datos LEGADOS que solo tienen las dos
  // casillas antiguas (`en_pac`, `programada`) y podían contradecirse.
  if (d.situacion_pac === "programado" || d.situacion_pac === "no_programado") {
    return [];
  }
  const enPac = d.en_pac;
  const programada = d.programada;
  const out: AvisoPaso[] = [];

  // Endurece la regla del Art. 42.3 sin bloqueos: de `programada` depende la
  // línea de corte (Art. 125.2) y el orden A3→A2. Si la DEC no respondió,
  // `esNoProgramada` presume programada; que ese supuesto quede a la vista en
  // vez de actuar en silencio.
  if (typeof programada !== "boolean") {
    out.push({
      nivel: "warn",
      mensaje:
        "No consta si la contratación es programada o no: sin respuesta se tratará como programada. De eso depende que su monto sume a la base de la línea de corte (Art. 125.2) y el aviso del orden A3→A2 del Art. 42.3.",
    });
  }

  if (enPac === true && programada === false) {
    out.push({
      nivel: "warn",
      mensaje:
        "Se declara que la contratación está programada en el PAC pero se responde que NO es programada. De esa respuesta depende que la línea de corte sume el monto de esta contratación (Art. 125.2): revisa cuál de las dos corresponde.",
    });
  }
  if (enPac === false && programada === true) {
    out.push({
      nivel: "warn",
      mensaje:
        "Se responde que es contratación programada pero no consta programada en el PAC. Si es no programada, márcalo: el Art. 42.3 exige segmentarla tras solicitar la modificación del CMN.",
    });
  }

  return out;
}

/**
 * ¿Es contratación NO programada (Art. 42.3)?
 *
 * La respuesta directa es `situacion_pac` del A1 (select Programado/No
 * programado). Los fallbacks a `programada` y `en_pac` existen solo para datos
 * legados grabados con las casillas antiguas; si nada consta, se presume
 * programada (el flujo normal) y `avisosA1` denuncia la ausencia. Es la única
 * fuente de esta decisión: antes vivía replicada en cinco sitios con variantes
 * que divergían entre sí.
 */
export function esNoProgramada(a1: Record<string, unknown> | undefined): boolean {
  const d = a1 ?? {};
  if (d.situacion_pac === "no_programado") return true;
  if (d.situacion_pac === "programado") return false;
  if (typeof d.programada === "boolean") return d.programada === false;
  return d.en_pac === false;
}

/** Contraparte positiva de `esNoProgramada`: se usa donde la línea de corte
 * pregunta «¿está programada?» (Art. 125.2). */
export function esProgramada(a1: Record<string, unknown> | undefined): boolean {
  return !esNoProgramada(a1);
}

/**
 * Texto del documento de modificación del CMN (A1) listo para incrustar en
 * frase ("…solicitada mediante {esto}").
 *
 * El campo guarda hoy SOLO el número correlativo (`tipo: number`), pero los
 * informes lo meten a mitad de oración, donde "45" a secas queda cojo. Aquí sale
 * como "documento N.° 45". Y los expedientes anteriores a este cambio guardaron
 * la referencia completa como texto ("INFORME N° 045-2026-AU-MDCH"): esa se
 * respeta tal cual. Devuelve "" si no hay nada.
 *
 * Existe porque los consumidores leían con `str()`, que ignora los no-string:
 * sin esto, el número recién guardado desaparecía de los informes sin un aviso.
 */
export function documentoModificacionCmnTexto(a1: Record<string, unknown> | undefined): string {
  const v = a1?.["documento_modificacion_cmn"];
  if (typeof v === "number" && Number.isFinite(v)) return `documento N.° ${v}`;
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Valor estimado que DECLARA A1: el campo obligatorio de las contrataciones no
 * programadas. Es el número que alimenta la fila "+ Esta contratación" de la base
 * y, con ella, la cuantía y la línea de corte de A2. Devuelve null si A1 no lo
 * trae (programada, o aún vacío), para que quien lo consuma caiga a su propio
 * respaldo (el valor estimado del expediente o el monto de la necesidad).
 *
 * Vive aquí, y no duplicado, para que la PANTALLA (segParametros de fase-panel) y
 * el .docx del Informe de Segmentación (ruta del servidor) apliquen exactamente
 * la misma preferencia: lo que se ve es lo que se imprime.
 */
export function valorEstimadoDeA1(a1: Record<string, unknown> | undefined): number | null {
  const v = a1?.["valor_estimado"];
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Variables OBLIGATORIAS de A4 que bloquean el cierre de la estrategia. Son las
 * del Art. 46.1 que la norma NO condiciona a "de corresponder" y que sostienen el
 * análisis: a) el tipo de procedimiento (sin él no hay estrategia), e) el tipo de
 * evaluador y su perfil, y s) la identificación del objetivo, que INCLUYE la
 * gestión de riesgos (46.1.s). El resto de obligatorios de A4 no bloquea "Hecho";
 * estas sí, por su peso.
 *
 * Devuelve las que siguen vacías (con el texto para el aviso); [] si están todas.
 * e) es condicional: el PERFIL solo se exige cuando ya hay un tipo de evaluador
 * elegido (su `dependeDe`); sin tipo, lo que falta es el tipo.
 */
export function variablesClaveA4Faltantes(a4: Record<string, unknown> | undefined): { campo: string; falta: string }[] {
  const d = a4 ?? {};
  const vacio = (campo: string) => {
    const v = d[campo];
    return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
  };
  const faltan: { campo: string; falta: string }[] = [];
  if (vacio("var_a_proceso")) {
    faltan.push({ campo: "var_a_proceso", falta: "a) el tipo de procedimiento (viene de la clasificación del proceso en la necesidad)" });
  }
  if (vacio("var_e_tipo_evaluador")) {
    faltan.push({ campo: "var_e_tipo_evaluador", falta: "e) el tipo de evaluador" });
  } else if (vacio("var_e_perfil_evaluador")) {
    faltan.push({ campo: "var_e_perfil_evaluador", falta: "e) el perfil del evaluador (sustento)" });
  }
  if (vacio("var_s_objetivo")) {
    faltan.push({ campo: "var_s_objetivo", falta: "s) la identificación del objetivo y la gestión de riesgos" });
  }
  return faltan;
}

/**
 * ¿`esProgramada` devolvió true por PRESUNCIÓN, no por confirmación de A1?
 *
 * Cierto cuando A1 no respondió NI "¿programada?" NI "¿está en el PAC?": entonces
 * `esProgramada` presume programada (default seguro del Art. 42.3), pero es un
 * supuesto, no un hecho. Lo consume A2 para no afirmar "está programada" antes de
 * que A1 lo confirme.
 */
export function programadaPresumida(a1: Record<string, unknown> | undefined): boolean {
  const d = a1 ?? {};
  if (d.situacion_pac === "programado" || d.situacion_pac === "no_programado") return false;
  return typeof d.programada !== "boolean" && typeof d.en_pac !== "boolean";
}

// Contenidos del requerimiento que el Art. 44 CONDICIONA ("de corresponder"):
// no bloquean A3, pero dejarlos en blanco no se distingue de "no lo evalué". El
// aviso recuerda declararlos —aunque sea con "No aplica"— para dejar constancia.
// Solo los que la norma ata a un supuesto concreto; los demás recomendado del
// 44.2 (b-e) son propuestas cuya decisión final es de la DEC en A4, y ausentes
// no dejan un vacío normativo que señalar.
const A3_CONTENIDOS_DE_CORRESPONDER: { name: string; label: string; objetos?: string[] }[] = [
  { name: "riesgos_asignacion", label: "riesgos identificados y su asignación (Art. 44.3)" },
  {
    name: "prestaciones_accesorias",
    label: "prestaciones accesorias (Art. 44.4)",
    objetos: ["bien", "obra"],
  },
  { name: "normas_tecnicas", label: "normas técnicas aplicables (Art. 44.5)" },
];

/**
 * Recordatorio de los contenidos "de corresponder" del requerimiento (Art. 44)
 * que siguen en blanco. No bloquea el paso: es un empujón para que un contenido
 * que SÍ correspondía no se omita en silencio. Se acota al objeto contractual
 * (p. ej. las prestaciones accesorias solo aplican a bienes y obras, Art. 44.4).
 */
export function avisosA3(data: Record<string, unknown> | undefined): AvisoPaso[] {
  const d = data ?? {};
  const objeto = typeof d.objeto_contractual === "string" ? d.objeto_contractual : undefined;
  const vacio = (name: string) => {
    const v = d[name];
    return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
  };
  const faltan = A3_CONTENIDOS_DE_CORRESPONDER.filter(
    (c) => (!c.objetos || (objeto ? c.objetos.includes(objeto) : false)) && vacio(c.name),
  );
  if (faltan.length === 0) return [];
  return [
    {
      nivel: "warn",
      mensaje: `Contenidos del requerimiento que el Art. 44 pide «de corresponder» y siguen en blanco: ${faltan
        .map((c) => c.label)
        .join("; ")}. Si NO corresponden, decláralo con «No aplica» para dejar constancia; en blanco no se distingue de «no lo he evaluado».`,
    },
  ];
}

/**
 * Beneficio del anuncio de contratación futura (Art. 64.3 del Reglamento).
 *
 * Si el anuncio se publica con al menos 40 días CALENDARIO de anticipación a la
 * convocatoria, se puede reducir el plazo entre la convocatoria y la
 * presentación de ofertas. El aviso calcula la fecha límite de publicación
 * (`fecha_aprox_convocatoria − 40 días`) y, si ya se registró
 * `fecha_publicacion_anuncio`, verifica que de verdad cumpla el mínimo antes de
 * dar por bueno el beneficio. Es un cálculo, no un candado: la DEC decide.
 */
export function avisosA10(data: Record<string, unknown> | undefined): AvisoPaso[] {
  const d = data ?? {};
  const convocatoria = d.fecha_aprox_convocatoria;
  if (typeof convocatoria !== "string" || !convocatoria) return [];

  const fechaLimite = restarDiasCalendario(convocatoria, 40);
  const fechaFormato = (iso: string): string => {
    const [y, m, dd] = iso.split("-");
    return `${dd}/${m}/${y}`;
  };

  const publicacion = d.fecha_publicacion_anuncio;
  if (typeof publicacion !== "string" || !publicacion) {
    return [
      {
        nivel: "warn",
        mensaje: `Para acceder al beneficio del Art. 64.3, publica el anuncio a más tardar el ${fechaFormato(fechaLimite)} (40 días calendario antes de la convocatoria del ${fechaFormato(convocatoria)}). Con eso puedes reducir el plazo entre la convocatoria y la presentación de ofertas.`,
      },
    ];
  }

  const diasAnticipo = diasCalendarioEntre(publicacion, convocatoria);
  if (diasAnticipo >= 40) {
    if (d.aplica_beneficio_40dias !== true) {
      return [
        {
          nivel: "warn",
          mensaje: `El anuncio se publicó con ${diasAnticipo} días de anticipación a la convocatoria: cumple el mínimo del Art. 64.3, así que sí corresponde marcar el beneficio y reducir el plazo entre convocatoria y presentación de ofertas.`,
        },
      ];
    }
    return [];
  }

  const avisos: AvisoPaso[] = [
    {
      nivel: "warn",
      mensaje: `El anuncio se publicó solo ${diasAnticipo} días antes de la convocatoria, menos de los 40 que exige el Art. 64.3: no corresponde reducir el plazo entre convocatoria y presentación de ofertas.`,
    },
  ];
  if (d.aplica_beneficio_40dias === true) {
    avisos.push({
      nivel: "error",
      mensaje: "Se marcó que aplica el beneficio de los 40 días, pero la publicación del anuncio no cumple el mínimo del Art. 64.3: revisa la fecha de publicación o desmarca el beneficio.",
    });
  }
  return avisos;
}

/**
 * Detalle de la comunicación del cronograma de presentación de requerimientos
 * (Art. 42.2 y Guía, sección I): la DEC comunica a las áreas usuarias las
 * fechas estimadas para la remisión de sus requerimientos.
 *
 * Devuelve un mensaje legible y la lista de áreas con su fecha, para la
 * notificación que se dispara al completar A2 y para la línea de tiempo. Si no
 * hay cronograma registrado (contrataciones no programadas no lo tienen), se
 * queda en el mensaje genérico.
 */
export function cronogramaRequerimientosDetalle(
  items: unknown,
): { mensaje: string; filas: Array<{ area: string; fecha: string }> } {
  const crudas = Array.isArray(items) ? items : [];
  const filas = crudas
    .map((i) => {
      const fila = (i ?? {}) as Record<string, unknown>;
      return {
        area: typeof fila.area === "string" ? fila.area.trim() : "",
        fecha: typeof fila.fecha === "string" ? fila.fecha.trim() : "",
      };
    })
    .filter((f) => f.area && f.fecha);
  if (filas.length === 0) {
    return {
      mensaje:
        "La DEC completó la segmentación de contrataciones. El cronograma de presentación de requerimientos está listo para las áreas usuarias.",
      filas: [],
    };
  }
  const fechas = filas.map((f) => `${f.area}: ${f.fecha}`).join(" · ");
  return {
    mensaje: `La DEC comunicó a las áreas usuarias el cronograma con las fechas estimadas para la presentación de requerimientos: ${fechas}.`,
    filas,
  };
}
