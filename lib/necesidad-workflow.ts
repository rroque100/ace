// Workflow del Requerimiento (Módulo 1 · Gestión de Necesidades), alineado a la
// Guía de Actuaciones Preparatorias (Ley 32069), Capítulo II · Requerimiento.
//
// Modela QUIÉN registra y CÓMO interviene la DEC: el área usuaria (o el ATE)
// formula el requerimiento; la DEC verifica el CMN, revisa el cumplimiento
// normativo y puede perfeccionarlo solicitando la "no objeción" del área usuaria,
// que puede otorgarla u objetarla. Es la fuente única de verdad de estados,
// actores y transiciones.

export type NecesidadStatus =
  | "borrador"
  | "remitido_dec"
  | "en_revision_dec"
  | "observado"
  | "no_objecion_pendiente"
  | "conforme"
  | "incorporado_cmn"
  | "anulada";

// Lado que actúa en cada estado/acción. El ATE se trata como área usuaria
// especializada (la guía: "Área Usuaria incluye al área técnica estratégica").
export type LadoActor = "area_usuaria" | "dec";

export type TipoArea = "area_usuaria" | "ate";

export type NoObjecionEstado = "no_aplica" | "solicitada" | "otorgada" | "objetada";

/**
 * Categoría visual del estado, para leer la cola de un vistazo sin abrir cada
 * ficha. No es color por color: agrupa por lo que el estado SIGNIFICA en el
 * flujo, que es lo que el usuario necesita triar.
 *
 *   neutral   → aún no está en marcha (borrador)
 *   progreso  → en manos de la DEC, avanzando (remitido, en revisión)
 *   atencion  → espera una acción de una persona (observado, no objeción)
 *   exito     → aprobado o meta alcanzada (conforme, incorporado)
 *   terminal  → sin efecto (anulada)
 */
export type TonoEstado = "neutral" | "progreso" | "atencion" | "exito" | "terminal";

export type EstadoDef = {
  value: NecesidadStatus;
  label: string;
  // Lado responsable de dar el siguiente paso (null = estado terminal).
  actor: LadoActor | null;
  descripcion: string;
  tono: TonoEstado;
};

export const NECESIDAD_ESTADOS: EstadoDef[] = [
  {
    value: "borrador",
    label: "Borrador",
    actor: "area_usuaria",
    tono: "neutral",
    descripcion: "El área usuaria o ATE redacta la necesidad y formula el requerimiento (estructura de bases estándar).",
  },
  {
    value: "remitido_dec",
    label: "Remitido a la DEC",
    actor: "dec",
    tono: "progreso",
    descripcion: "El requerimiento fue remitido a la DEC para la verificación del CMN y del cumplimiento normativo.",
  },
  {
    value: "en_revision_dec",
    label: "En revisión (DEC)",
    actor: "dec",
    tono: "progreso",
    descripcion: "La DEC verifica que la necesidad esté en el CMN y revisa el cumplimiento de la normativa.",
  },
  {
    value: "observado",
    label: "Observado",
    actor: "area_usuaria",
    tono: "atencion",
    descripcion: "La DEC devolvió el requerimiento con observaciones; el área usuaria debe subsanar.",
  },
  {
    value: "no_objecion_pendiente",
    label: "No objeción pendiente",
    actor: "area_usuaria",
    tono: "atencion",
    descripcion: "La DEC propuso modificaciones; el área usuaria debe otorgar su no objeción u objetar con sustento.",
  },
  {
    value: "conforme",
    label: "Requerimiento conforme",
    actor: "dec",
    tono: "exito",
    descripcion: "CMN verificado y requerimiento perfeccionado. Listo para derivar al Expediente de Contratación.",
  },
  {
    value: "incorporado_cmn",
    label: "Incorporado al CMN (Derivado)",
    actor: null,
    tono: "exito",
    descripcion: "La DEC derivó la necesidad a un Expediente de Contratación.",
  },
  {
    // Una necesidad que se abandona (no se contrata, cambia la prioridad, se
    // agota el año fiscal) se quedaba en el estado donde murió y solo podía
    // borrarse. Borrarla pierde el rastro de que existió y por qué se dejó;
    // anularla lo conserva, con su sustento.
    value: "anulada",
    label: "Anulada",
    actor: null,
    tono: "terminal",
    descripcion:
      "La necesidad se dejó sin efecto y no se contratará. Se conserva con su sustento para el registro; puede reactivarse a borrador.",
  },
];

const ESTADO_MAP = new Map(NECESIDAD_ESTADOS.map((e) => [e.value, e]));

/** Tono visual del estado (para colorear el chip y la franja de la tarjeta). */
export function necesidadStatusTono(status: string | null | undefined): TonoEstado {
  return ESTADO_MAP.get(status as NecesidadStatus)?.tono ?? "neutral";
}

export function estadoNecesidad(status: string | null | undefined): EstadoDef | undefined {
  return status ? ESTADO_MAP.get(status as NecesidadStatus) : undefined;
}

export function necesidadStatusLabel(status: string | null | undefined): string {
  if (!status) return "Sin estado";
  return ESTADO_MAP.get(status as NecesidadStatus)?.label ?? status;
}

export type NecesidadAction =
  | "remitir"
  | "iniciar_revision"
  | "observar"
  | "solicitar_no_objecion"
  | "aprobar_conforme"
  | "otorgar_no_objecion"
  | "objetar"
  | "reabrir"
  | "volver_borrador"
  | "anular"
  | "reactivar";

export type AccionDef = {
  action: NecesidadAction;
  label: string;
  ayuda: string;
  desde: NecesidadStatus[];
  hacia: NecesidadStatus;
  // Lado que normalmente ejecuta la acción.
  actor: LadoActor;
  requiereSustento?: boolean;
  // Efectos colaterales sobre los campos de la necesidad.
  setNoObjecion?: NoObjecionEstado;
  setCmnVerificado?: boolean;
  // Si es verdadero, limpia el vínculo con el expediente (process_id = null).
  borrarProcessId?: boolean;
  /**
   * La acción SOLO procede si la necesidad no tiene expediente derivado.
   *
   * Deshacer el avance de un requerimiento que ya alimentó un expediente
   * dejaría la Fase 1 sembrada desde un requerimiento que, formalmente, ha
   * vuelto a ser un borrador. Con expediente, el camino es `reabrir`, que
   * desvincula de forma explícita.
   */
  requiereSinExpediente?: boolean;
  // Estilo del botón en la UI.
  variante?: "primary" | "secondary" | "danger";
};

export const ACCIONES: AccionDef[] = [
  {
    action: "remitir",
    label: "Remitir a la DEC",
    ayuda: "El área usuaria/ATE envía el requerimiento formulado a la DEC.",
    desde: ["borrador", "observado"],
    hacia: "remitido_dec",
    actor: "area_usuaria",
    variante: "primary",
  },
  {
    action: "iniciar_revision",
    label: "Iniciar revisión",
    ayuda: "La DEC toma el requerimiento para verificar el CMN y el cumplimiento normativo.",
    desde: ["remitido_dec"],
    hacia: "en_revision_dec",
    actor: "dec",
    variante: "primary",
  },
  {
    action: "observar",
    label: "Observar y devolver",
    ayuda: "La DEC devuelve el requerimiento al área usuaria con observaciones para subsanar.",
    // Antes también se podía observar desde `remitido_dec`, saltándose el paso
    // de revisión. Se quitó por dos motivos: la barra de progreso saltaba del
    // paso 2 a un desvío del 3 sin haber pasado por él, y sobre todo no se
    // puede observar lo que no se ha declarado revisado — el rastro quedaba sin
    // el momento en que la DEC tomó el requerimiento.
    desde: ["en_revision_dec"],
    hacia: "observado",
    actor: "dec",
    requiereSustento: true,
    variante: "danger",
  },
  {
    action: "solicitar_no_objecion",
    label: "Proponer modificación (pedir no objeción)",
    ayuda: "La DEC perfecciona el requerimiento y solicita la no objeción del área usuaria. Verifica el CMN.",
    desde: ["en_revision_dec"],
    hacia: "no_objecion_pendiente",
    actor: "dec",
    requiereSustento: true,
    setNoObjecion: "solicitada",
    setCmnVerificado: true,
    variante: "secondary",
  },
  {
    action: "aprobar_conforme",
    label: "Aprobar sin modificaciones",
    ayuda: "La DEC da conforme el requerimiento (CMN verificado, sin cambios). Queda listo para derivar.",
    desde: ["en_revision_dec"],
    hacia: "conforme",
    actor: "dec",
    setNoObjecion: "no_aplica",
    setCmnVerificado: true,
    variante: "primary",
  },
  {
    action: "otorgar_no_objecion",
    label: "Dar no objeción",
    ayuda: "El área usuaria acepta las modificaciones propuestas por la DEC (memorando/correo/proveído).",
    desde: ["no_objecion_pendiente"],
    hacia: "conforme",
    actor: "area_usuaria",
    setNoObjecion: "otorgada",
    variante: "primary",
  },
  {
    action: "objetar",
    label: "Objetar con sustento",
    ayuda: "El área usuaria objeta las modificaciones; la DEC devuelve el requerimiento.",
    desde: ["no_objecion_pendiente"],
    hacia: "observado",
    actor: "area_usuaria",
    requiereSustento: true,
    setNoObjecion: "objetada",
    variante: "danger",
  },
  {
    // Cerrar una necesidad que no se va a contratar. Es terminal pero
    // reversible: `reactivar` la devuelve a borrador.
    action: "anular",
    label: "Anular necesidad",
    ayuda:
      "Deja la necesidad sin efecto: no se contratará. Se conserva con su sustento en vez de borrarla. Disponible solo mientras no se haya derivado a un expediente.",
    desde: ["borrador", "remitido_dec", "en_revision_dec", "observado", "no_objecion_pendiente", "conforme"],
    hacia: "anulada",
    actor: "area_usuaria",
    requiereSustento: true,
    requiereSinExpediente: true,
    // El ciclo del Art. 44.7 se refiere a una versión que ya no se tramitará.
    setNoObjecion: "no_aplica",
    variante: "danger",
  },
  {
    action: "reactivar",
    label: "Reactivar necesidad",
    ayuda: "Devuelve una necesidad anulada a borrador para retomar su formulación.",
    desde: ["anulada"],
    hacia: "borrador",
    actor: "area_usuaria",
    setNoObjecion: "no_aplica",
    variante: "secondary",
  },
  {
    // Volver a empezar. Solo tiene sentido mientras nadie haya derivado la
    // necesidad: hasta entonces, el estado del workflow no ha producido nada
    // aguas abajo y rehacerlo no rompe nada.
    action: "volver_borrador",
    label: "Volver a borrador",
    ayuda:
      "Devuelve el requerimiento a borrador para rehacerlo desde el principio. Disponible solo mientras no se haya derivado a un expediente.",
    desde: ["remitido_dec", "en_revision_dec", "observado", "no_objecion_pendiente", "conforme"],
    hacia: "borrador",
    actor: "area_usuaria",
    requiereSinExpediente: true,
    // El ciclo de no objeción (Art. 44.7) se refiere a una versión concreta del
    // requerimiento: si este vuelve a borrador, lo actuado sobre esa versión ya
    // no aplica y arrastrarlo daría por resuelto algo que se va a reformular.
    setNoObjecion: "no_aplica",
    variante: "secondary",
  },
  {
    action: "reabrir",
    label: "Reabrir necesidad",
    ayuda: "Revierte la derivación y vuelve el requerimiento a conforme para modificaciones.",
    desde: ["incorporado_cmn"],
    hacia: "conforme",
    actor: "dec",
    borrarProcessId: true,
    variante: "secondary",
  },
];

const ACCION_MAP = new Map(ACCIONES.map((a) => [a.action, a]));

export function accionPorId(action: string): AccionDef | undefined {
  return ACCION_MAP.get(action as NecesidadAction);
}

// Rol de login → lado del workflow. Gating flexible: la DEC (y admin) pueden
// ejecutar cualquier acción; el área usuaria/ATE solo las suyas.
export function ladoDeRol(role: string | null | undefined): { esDec: boolean; esAreaUsuaria: boolean } {
  const esDec = role === "dec" || role === "admin";
  const esAreaUsuaria = role === "area_usuaria" || role === "ate";
  return { esDec, esAreaUsuaria };
}

// ¿Puede este usuario ejecutar la acción? (gating flexible: DEC puede todo).
export function puedeEjecutar(accion: AccionDef, lado: { esDec: boolean; esAreaUsuaria: boolean }): boolean {
  if (lado.esDec) return true; // la DEC/admin puede ejecutar cualquier transición
  if (accion.actor === "area_usuaria") return lado.esAreaUsuaria;
  return false;
}

// Acciones disponibles desde un estado, para un usuario (según su lado).
export function accionesDisponibles(
  status: string | null | undefined,
  lado: { esDec: boolean; esAreaUsuaria: boolean },
  contexto?: {
    /**
     * ¿La necesidad ya está derivada a un expediente? Las acciones marcadas
     * `requiereSinExpediente` desaparecen cuando lo está: el servidor las
     * rechaza igual, pero ofrecer un botón que va a fallar es peor que no
     * ofrecerlo.
     */
    tieneExpediente?: boolean;
  },
): AccionDef[] {
  const st = (status ?? "borrador") as NecesidadStatus;
  return ACCIONES.filter(
    (a) =>
      a.desde.includes(st) &&
      puedeEjecutar(a, lado) &&
      !(a.requiereSinExpediente && contexto?.tieneExpediente),
  );
}

export const TIPO_AREA_OPCIONES: { value: TipoArea; label: string }[] = [
  { value: "area_usuaria", label: "Área usuaria" },
  { value: "ate", label: "Área técnica estratégica (ATE)" },
];

export function tipoAreaLabel(value: string | null | undefined): string {
  return TIPO_AREA_OPCIONES.find((t) => t.value === value)?.label ?? "Área usuaria";
}

export const NO_OBJECION_LABEL: Record<NoObjecionEstado, string> = {
  no_aplica: "No aplica (sin modificaciones)",
  solicitada: "Solicitada por la DEC",
  otorgada: "Otorgada por el área usuaria",
  objetada: "Objetada por el área usuaria",
};
