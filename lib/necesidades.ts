import { z } from "zod";
import type { NecesidadStatus, NoObjecionEstado, TipoArea } from "./necesidad-workflow";

// Modulo 1: Gestion de Necesidades. La Necesidad es el inicio del ciclo de la
// contratacion: el area usuaria (o ATE) registra la necesidad publica, genera
// la Ficha de Necesidad con codigo unico y, tras la validacion, se deriva a un
// Expediente de Contratacion. El workflow por actor (formulacion, revision DEC,
// no objecion) vive en lib/necesidad-workflow.ts.

export type { NecesidadStatus } from "./necesidad-workflow";

/**
 * Los cuatro objetos contractuales del dominio necesidad (Ley 32069): bienes,
 * servicios, obras y consultoría de obra. Fuente ÚNICA para el desplegable de
 * «Tipo de objeto», su filtro en la lista y la etiqueta que se muestra.
 *
 * OJO — no es la misma taxonomía que `OBJECT_TYPES` de lib/legal-taxonomy.ts. Ahí
 * la consultoría vale "consultoria"; aquí, "consultoria_obra". La columna
 * `necesidades.tipo_objeto` y los `z.enum` de este módulo exigen "consultoria_obra",
 * así que ofrecer el valor de legal-taxonomy hacía que guardar «Consultoría» diera
 * 400, que el filtro de la lista no encontrara nada y que la etiqueta saliera en
 * crudo ("consultoria_obra"). El dominio de procesos/expedientes sí usa la otra.
 */
export const OBJETOS_NECESIDAD = [
  { value: "bienes", label: "Bienes" },
  { value: "servicios", label: "Servicios" },
  { value: "obras", label: "Obras" },
  { value: "consultoria_obra", label: "Consultoría de obra" },
] as const;

export function objetoNecesidadLabel(value?: string | null): string {
  if (!value) return "";
  return OBJETOS_NECESIDAD.find((o) => o.value === value)?.label ?? value;
}

/** Observación por campo (D2): la DEC comenta un campo; el área usuaria subsana. */
export type ObservacionNecesidad = {
  id: string;
  necesidad_id: string;
  campo: string;
  comentario: string;
  autor_referencia: string | null;
  autor_rol: string | null;
  resuelto: boolean;
  resuelto_por: string | null;
  created_at: string;
  resuelto_at: string | null;
};

export type Necesidad = {
  id: string;
  codigo: string | null;
  anio_fiscal: number | null;
  periodo_programacion: string | null;
  version_cmn: string | null;
  entidad: string | null;
  unidad_ejecutora: string | null;
  area_usuaria: string | null;
  centro_costo: string | null;
  responsable: string | null;
  nombre: string;
  finalidad_publica: string | null;
  pei_objetivo: string | null;
  pei_accion: string | null;
  poi_actividad: string | null;
  meta_presupuestal: string | null;
  proyecto_inversion: string | null;
  /** Código Único de Inversión (act_proy del SIGA). El número, no el nombre. */
  cui: string | null;
  ioarr: string | null;
  tipo_objeto: "bienes" | "servicios" | "obras" | "consultoria_obra";
  // Tipo de proceso de selección ANTICIPADO por el área usuaria (referencia
  // inicial). La DEC lo confirma/decide en la Estrategia A4 (Art. 46.1.a).
  tipo_proceso_seleccion: string | null;
  especialidad: string | null;
  subespecialidad: string | null;
  codigo_catalogo: string | null;
  descripcion_catalogo: string | null;
  descripcion_detallada: string | null;
  cantidad: number | null;
  unidad_medida: string | null;
  frecuencia: string | null;
  fecha_requerida: string | null;
  trimestre: number | null;
  mes_programado: number | null;
  fuente_financiamiento: string | null;
  rubro: string | null;
  cadena_funcional: string | null;
  clasificador_gasto: string | null;
  monto_estimado: number | null;
  costo_unitario: number | null;
  costo_total: number | null;
  moneda: string | null;
  anio_referencia: number | null;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
  lugar_entrega: string | null;
  alcance: string | null;
  condiciones_ejecucion: string | null;
  modalidad_pago: string | null;
  sistema_entrega: string | null;
  plazo_ejecucion: number | null;
  /** Computo del plazo: 'calendario' (regla, Art. 105.3) o 'habiles' (excepcion). */
  plazo_ejecucion_unidad: string | null;
  equipamiento_minimo: string | null;
  habilitaciones: string | null;
  formula_reajuste: string | null;
  // Condiciones de contratación adicionales (EETT/TDR de las Bases Estándar).
  adelanto_directo: string | null;
  penalidad_mora: string | null;
  garantias: string | null;
  recepcion_conformidad: string | null;
  // FORMA DE PAGO (Art. 67 de la Ley). Los cinco huecos del formato + el texto
  // ya compuesto, que es lo que viaja al Word y lo que se firma.
  forma_pago: string | null;
  forma_pago_tipo: string | null;
  forma_pago_detalle: string | null;
  forma_pago_area_conformidad: string | null;
  forma_pago_documentacion: string | null;
  forma_pago_lugar: string | null;
  forma_pago_direccion: string | null;
  // Huecos del apartado del Art. 144 (recepción y conformidad).
  recepcion_area: string | null;
  conformidad_area: string | null;
  conformidad_plazo: number | null;
  conformidad_plazo_subsanacion: number | null;
  subcontratacion: string | null;
  descripcion_general: string | null;
  ficha_tecnica_identificacion: string | null;
  compatibilizacion: string | null;
  normas_tecnicas: string | null;
  prestaciones_accesorias: string | null;
  otras_penalidades: string | null;
  solucion_controversias: string | null;
  plazo_respuestas: number | null;
  plazo_respuestas_texto: string | null;
  requisitos_adicionales: string | null;
  // CAPACIDAD TÉCNICA Y PROFESIONAL · Experiencia del personal clave (Art.
  // 72.3.b): cuadro de puestos serializado (lib/personal-clave.ts) + el texto
  // fijo de cómo se acredita.
  personal_clave_experiencia: string | null;
  personal_clave_acreditacion: string | null;
  // Calificaciones del personal clave · Formación académica (Art. 72.3.b, C.2.1).
  formacion_academica: string | null;
  formacion_academica_acreditacion: string | null;
  // Calificaciones del personal clave · Capacitación (Art. 72.3.b).
  capacitacion_personal_clave: string | null;
  capacitacion_personal_clave_acreditacion: string | null;
  // Equipamiento estratégico (Art. 72.3.b, C.3): requisito + acreditación.
  equipamiento_estrategico: string | null;
  equipamiento_estrategico_acreditacion: string | null;
  infraestructura_estrategica: string | null;
  infraestructura_estrategica_acreditacion: string | null;
  gestion_riesgos: string | null;
  // Específicas de obras / consultoría de obra.
  metas_fisicas: string | null;
  disponibilidad_terreno: string | null;
  seguros: string | null;
  metodologia_bim: string | null;
  gestion_calidad: string | null;
  anexos_tecnicos: string | null;
  requisitos_calificacion: string | null;
  verificacion_ficha_tecnica: boolean;
  verificacion_almacen: boolean;
  certificacion_presupuestal: string | null;
  fecha_remision_dec: string | null;
  // Fechas de versión del requerimiento en el ciclo de no objeción (Art. 44.7).
  fecha_version_dos: string | null;
  fecha_version_n: string | null;
  status: NecesidadStatus;
  // Workflow del Requerimiento (lib/necesidad-workflow.ts).
  tipo_area: TipoArea;
  cmn_verificado: boolean;
  no_objecion: NoObjecionEstado;
  no_objecion_sustento: string | null;
  no_objecion_mecanismo: string | null;
  summary: string | null;
  process_id: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export type NecesidadDocumento = {
  id: string;
  necesidad_id: string;
  kind: string;
  title: string;
  file_name: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  status: "uploaded" | "processing" | "ready" | "error";
  error_message: string | null;
  created_at: string;
};

export const necesidadDocKinds = [
  "requerimiento",
  "tdr",
  "ee_tt",
  "expediente_tecnico",
  "memoria_descriptiva",
  "informe_necesidad",
  "cotizacion",
  "otros",
] as const;

// Los topes viven en su propio modulo, sin zod, para que el cliente pueda
// importarlos sin arrastrar los esquemas. Se reexportan para no romper nada.
export { LIMITES_TEXTO, NOMBRE_MAX, acotarNumero } from "./necesidades-limites";
import { NOMBRE_MAX } from "./necesidades-limites";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const necesidadCreateSchema = z.object({
  nombre: z.string().trim().min(3).max(NOMBRE_MAX),
  tipoObjeto: z.enum(["bienes", "servicios", "obras", "consultoria_obra"]).default("bienes"),
  // Tipo de proceso de selección anticipado (referencia inicial del área usuaria).
  tipoProcesoSeleccion: optionalText(120),
  tipoArea: z.enum(["area_usuaria", "ate"]).default("area_usuaria"),
  anioFiscal: z.number().int().optional(),
  periodoProgramacion: optionalText(50),
  versionCmn: optionalText(50),
  entidad: optionalText(160),
  unidadEjecutora: optionalText(160),
  areaUsuaria: optionalText(160),
  centroCosto: optionalText(120),
  responsable: optionalText(160),
  finalidadPublica: optionalText(2000),
  peiObjetivo: optionalText(120),
  peiAccion: optionalText(120),
  poiActividad: optionalText(120),
  metaPresupuestal: optionalText(120),
  // El NÚMERO del proyecto (act_proy del SIGA), no su nombre: el nombre va
  // en `proyectoInversion`. El Formato de Estrategia los pide por separado.
  cui: optionalText(40),
  // Referencia del pedido SIGA del que se importó. TRANSITORIOS: no son
  // columnas de `necesidades` — el POST los usa para vincular la fila de
  // `pedidos_siga` (necesidad_id) y no entran en el insert.
  nroPedido: optionalText(20),
  pedidoSecuencia: optionalText(10),
  // Un párrafo, no un renglón: el nombre oficial de un proyecto en Invierte.pe
  // arrastra objeto, localidades, distrito, provincia y departamento, y pasa de
  // 160 caracteres con facilidad. Mismo tope que los demás campos de párrafo.
  proyectoInversion: optionalText(2000),
  ioarr: optionalText(160),
  especialidad: optionalText(120),
  subespecialidad: optionalText(120),
  codigoCatalogo: optionalText(50),
  descripcionCatalogo: optionalText(500),
  descripcionDetallada: optionalText(2000),
  cantidad: z.number().optional(),
  unidadMedida: optionalText(50),
  frecuencia: optionalText(50),
  fechaRequerida: optionalText(20),
  trimestre: z.number().int().min(1).max(4).optional(),
  mesProgramado: z.number().int().min(1).max(12).optional(),
  fuenteFinanciamiento: optionalText(120),
  rubro: optionalText(120),
  cadenaFuncional: optionalText(120),
  clasificadorGasto: optionalText(120),
  montoEstimado: z.number().optional(),
  costoUnitario: z.number().optional(),
  costoTotal: z.number().optional(),
  moneda: optionalText(10),
  anioReferencia: z.number().int().optional(),
  departamento: optionalText(100),
  provincia: optionalText(100),
  distrito: optionalText(100),
  lugarEntrega: optionalText(500),
  alcance: optionalText(2000),
  condicionesEjecucion: optionalText(2000),
  modalidadPago: optionalText(500),
  sistemaEntrega: optionalText(100),
  plazoEjecucion: z.number().int().optional(),
  // Lista cerrada: son los dos unicos computos que admite el Art. 105.3, y el
  // numero de dias sin unidad no significa nada en un contrato.
  plazoEjecucionUnidad: z.enum(["calendario", "habiles"]).optional(),
  equipamientoMinimo: optionalText(1000),
  habilitaciones: optionalText(1000),
  formulaReajuste: optionalText(2000),
  // Condiciones de contratación adicionales (EETT/TDR de las Bases Estándar).
  adelantoDirecto: optionalText(1000),
  penalidadMora: optionalText(2000),
  garantias: optionalText(2000),
  // Cabe el texto literal del Art. 144 con sus huecos al maximo. Ver el tope en
  // lib/necesidades-limites.ts.
  recepcionConformidad: optionalText(7000),
  // Cabe el peor caso: todos los huecos al maximo mas el nombre del proyecto de
  // inversion. Ver el tope en lib/necesidades-limites.ts.
  formaPago: optionalText(11000),
  formaPagoTipo: optionalText(1000),
  formaPagoDetalle: optionalText(2000),
  // Cabe la denominacion del area con el proyecto de inversion al que
  // pertenece. Ver el tope en lib/necesidades-limites.ts.
  formaPagoAreaConformidad: optionalText(2400),
  formaPagoDocumentacion: optionalText(1000),
  formaPagoLugar: optionalText(300),
  formaPagoDireccion: optionalText(300),
  recepcionArea: optionalText(300),
  conformidadArea: optionalText(300),
  // Numeros de dias, no prosa. `max(999)` son los tres digitos que caben: un
  // plazo de conformidad de cuatro cifras es un error de tecleo. El tipo TIENE
  // que cuadrar con el `kind: "number"` de la ficha —que envia un numero— o
  // cada guardado responde 400; hay una prueba que recorre el catalogo entero.
  conformidadPlazo: z.number().int().min(1).max(999).optional(),
  conformidadPlazoSubsanacion: z.number().int().min(1).max(999).optional(),
  subcontratacion: optionalText(1000),
  descripcionGeneral: optionalText(4000),
  fichaTecnicaIdentificacion: optionalText(300),
  compatibilizacion: optionalText(300),
  normasTecnicas: optionalText(2000),
  prestacionesAccesorias: optionalText(2000),
  otrasPenalidades: optionalText(3000),
  solucionControversias: optionalText(8000),
  // NUMERO, no texto. La ficha lo declara `kind: "number"` y `construirPayload`
  // lo envia como numero; con `optionalText` aqui, el PATCH respondia 400 en
  // CADA guardado en cuanto alguien escribia algo, y bloqueaba la ficha entera.
  // El desajuste venia de cambiar el campo a numero sin cambiar la validacion.
  plazoRespuestas: z.number().int().min(1).max(365).optional(),
  // El apartado j) ya redactado, que es texto y va aparte: el plazo sigue siendo
  // un dato con el que se puede contar y comparar.
  plazoRespuestasTexto: optionalText(1200),
  requisitosAdicionales: optionalText(4000),
  // Experiencia del personal clave (Art. 72.3.b): cuadro de puestos serializado
  // (lib/personal-clave.ts). Varias filas, por eso el tope es holgado.
  personalClaveExperiencia: optionalText(4000),
  personalClaveAcreditacion: optionalText(3000),
  formacionAcademica: optionalText(3000),
  formacionAcademicaAcreditacion: optionalText(2000),
  capacitacionPersonalClave: optionalText(3000),
  capacitacionPersonalClaveAcreditacion: optionalText(2000),
  equipamientoEstrategico: optionalText(2000),
  equipamientoEstrategicoAcreditacion: optionalText(2000),
  infraestructuraEstrategica: optionalText(2000),
  infraestructuraEstrategicaAcreditacion: optionalText(2000),
  gestionRiesgos: optionalText(20000),
  // Específicas de obras / consultoría de obra.
  metasFisicas: optionalText(2000),
  disponibilidadTerreno: optionalText(2000),
  seguros: optionalText(2000),
  metodologiaBim: optionalText(2000),
  gestionCalidad: optionalText(2000),
  anexosTecnicos: optionalText(2000),
  // No es texto libre corto como los demás: guarda el formato canónico de los 5
  // tipos del Art. 72.3, cada uno con detalle, acreditación y sustento en varios
  // párrafos. El texto real de bases estándar de un solo tipo (p. ej. la
  // experiencia del postor, con sus notas al pie) ronda los 3500 caracteres, así
  // que llenar los cinco supera de largo cualquier tope pequeño. La columna es
  // `text` (sin límite en la base); se deja un cap alto solo como freno anti
  // abuso, no como restricción del contenido legítimo.
  requisitosCalificacion: optionalText(50000),
  verificacionFichaTecnica: z.boolean().optional(),
  verificacionAlmacen: z.boolean().optional(),
  certificacionPresupuestal: optionalText(120),
  fechaRemisionDec: optionalText(20),
  fechaVersionDos: optionalText(20),
  fechaVersionN: optionalText(20),
  summary: optionalText(2000)
});


export const riesgoCreateSchema = z.object({ riesgo: z.string().trim().min(3).max(500), probabilidad: z.enum([ "baja", "media", "alta" ]).optional(), impacto: z.enum([ "bajo", "medio", "alto" ]).optional(), mitigacion: optionalText(1000), responsable: optionalText(160) });

/**
 * Un ítem del desagregado del requerimiento (sección 3.2 de las Bases).
 *
 * `costoTotal` va aparte de cantidad × unitario a propósito: el pedido SIGA trae
 * importes ya redondeados que no siempre reproducen el producto, y el
 * requerimiento debe poder reflejar la cifra tal como viene.
 */
export const necesidadItemSchema = z.object({
  cantidad: z.coerce.number().nonnegative().optional().nullable(),
  codigoCatalogo: optionalText(50),
  costoTotal: z.coerce.number().nonnegative().optional().nullable(),
  costoUnitario: z.coerce.number().nonnegative().optional().nullable(),
  descripcion: z.string().trim().min(2).max(2000),
  // El correlativo lo asigna el servidor renumerando: si llegara del cliente,
  // dos filas podrían pedir el mismo y el índice único lo rechazaría entero.
  nro: z.coerce.number().int().positive().optional(),
  // Paquete al que pertenece (Art. 52.1.a). Nulo = sin empaquetar.
  descripcionPaquete: optionalText(500),
  nroPaquete: z.coerce.number().int().positive().max(99).optional().nullable(),
  tipoObjeto: z.enum(["bienes", "servicios", "obras", "consultoria_obra"]).optional().nullable(),
  unidadMedida: optionalText(50),
});

/** Reemplazo completo de la lista de ítems de una necesidad. */
export const necesidadItemsSchema = z.object({
  items: z.array(necesidadItemSchema).max(500),
});

export type NecesidadItemRow = {
  id: string;
  necesidad_id: string;
  nro: number;
  descripcion: string;
  codigo_catalogo: string | null;
  unidad_medida: string | null;
  cantidad: number | string | null;
  costo_unitario: number | string | null;
  costo_total: number | string | null;
  tipo_objeto: string | null;
  nro_paquete: number | null;
  descripcion_paquete: string | null;
};

/** Alta de una observación por campo (D2): campo observado + comentario. */
export const observacionCreateSchema = z.object({
  campo: z.string().trim().min(1).max(80),
  comentario: z.string().trim().min(2).max(1500),
});

export const necesidadUpdateSchema = necesidadCreateSchema.extend({ nombre: z.string().trim().min(3).max(NOMBRE_MAX).optional(), tipoObjeto: z.enum([ "bienes", "servicios", "obras", "consultoria_obra" ]).optional(), tipoArea: z.enum([ "area_usuaria", "ate" ]).optional(), status: z.enum([ "borrador", "remitido_dec", "en_revision_dec", "observado", "no_objecion_pendiente", "conforme", "incorporado_cmn" ]).optional() });
