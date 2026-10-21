// Designación de evaluadores (A6), a partir de la estrategia (A4).
//
// El Art. 46.1.e ya fija el tipo de evaluador en la estrategia, y el Art. 54.2.e
// pide su designación en el expediente: son el mismo hecho en dos pasos. A6 no
// debería volver a preguntar el tipo —eso invita a que A4 y A6 se contradigan—,
// sino heredarlo de A4 y dejar que la DEC solo lo confirme.
//
// El número de integrantes tampoco es libre: lo determina el tipo (Arts. 93-95).
// Oficial de compra → 1. Comité → 3. Jurado → 3 o 5, así que ahí sí hay una
// elección, y por eso solo el jurado deja escoger.

/** Integrantes que corresponden a cada tipo de evaluador (Arts. 93-95). */
export const INTEGRANTES_POR_TIPO: Readonly<Record<string, readonly number[]>> = {
  oficial_compra: [1],
  comite: [3],
  jurado: [3, 5],
};

/**
 * Número de integrantes que se autoselecciona al elegir el tipo: oficial de
 * compra 1 (Art. 58.1), comité 3 (Art. 56.1.b) y jurado 5 —el máximo, editable a
 * 3— (Art. 56.1.c). "" si el tipo no se reconoce. Como cadena, para el <select>.
 */
export function cantidadDefaultPorTipoEvaluador(tipo: string): string {
  if (tipo === "oficial_compra") return "1";
  if (tipo === "comite") return "3";
  if (tipo === "jurado") return "5";
  return "";
}

/**
 * Tipo de documento con el que se designa/aprueba a los evaluadores, según el
 * tipo. El oficial de compra lo designa la DEC con un MEMORÁNDUM interno (Art.
 * 58.1); los paneles —comité (Art. 59) y jurado (Art. 60)— se designan con un
 * INFORME, porque median propuestas del área usuaria. Devuelve el prefijo listo
 * para anteponer al número ("Memorándum N° " / "INFORME N° ").
 */
export function prefijoDesignacion(tipoEvaluador: string): string {
  return tipoEvaluador === "oficial_compra" ? "Memorándum N° " : "INFORME N° ";
}

/** Etiqueta del campo del número de designación, acorde al tipo de documento. */
export function etiquetaDesignacion(tipoEvaluador: string): string {
  return tipoEvaluador === "oficial_compra"
    ? "N° del memorándum de designación"
    : "N° del informe de designación";
}

/**
 * Deja solo el número, quitando un "Memorándum N°/Nro" o "Informe N°" que el dato
 * ya trajera: los documentos anteponen el prefijo, así que sin esto saldría
 * duplicado. Tolera la errata "MEMORADUN" y las variantes de "N°/Nro".
 */
export function soloNumeroDesignacion(raw: string): string {
  // La clase con acentos captura "Memorándum" entero (\w no casa la "á").
  return (raw ?? "")
    .replace(/^\s*(?:memor[a-záéíóúñüÁÉÍÓÚÑÜ]*|informe)\.?\s*(?:nro\.?|n[°ºo]?\.?)?\s*/i, "")
    .trim();
}

/** El rol de Configuración del que se traen los candidatos de cada tipo. */
export const ROL_DE_TIPO_EVALUADOR: Readonly<Record<string, string>> = {
  oficial_compra: "oficial_compra",
  comite: "comite",
  jurado: "jurado",
};

/**
 * Roles válidos DENTRO del panel, por tipo (Art. 56.1). El comité necesita al
 * menos un comprador público de la DEC y al menos un experto/profesional
 * (56.1.b); el jurado se compone de expertos (56.1.c). "Área usuaria" solo aplica
 * al jurado con subetapas de negociación o diálogo competitivo (Art. 60.4).
 */
export const ROLES_PANEL_POR_TIPO: Readonly<Record<string, readonly string[]>> = {
  oficial_compra: ["Oficial de compra"],
  comite: ["Comprador público (DEC)", "Experto/profesional"],
  jurado: ["Experto", "Área usuaria (negociación/diálogo, Art. 60.4)"],
};

/**
 * Lo que A6 hereda de A4 para su tipo de evaluador y su número de integrantes.
 *
 * Devuelve `null` cuando A4 aún no tiene tipo elegido: sin él, no hay nada que
 * heredar y A6 pide el dato a mano.
 */
export function herenciaEvaluadorA4(a4: Record<string, unknown> | null | undefined): {
  tipo: string;
  integrantesPosibles: readonly number[];
  // Si solo hay una cantidad posible, se puede fijar; si no (jurado), se elige.
  cantidadFija: number | null;
} | null {
  const tipo = typeof a4?.var_e_tipo_evaluador === "string" ? a4.var_e_tipo_evaluador.trim() : "";
  if (!tipo || !INTEGRANTES_POR_TIPO[tipo]) return null;
  const posibles = INTEGRANTES_POR_TIPO[tipo];
  return { tipo, integrantesPosibles: posibles, cantidadFija: posibles.length === 1 ? posibles[0] : null };
}

/** Un integrante del panel evaluador, tal como se guarda en A6. */
export type IntegranteEvaluador = {
  /** Perfil de Configuración del que salió, para no duplicarlo. `null` si a mano. */
  usuarioId?: string | null;
  /** Nombre completo; si falta, se cae al correo (y la UI avisa). */
  nombre?: string;
  /** DNI: la declaración jurada y el consentimiento (A6) lo exigen. */
  dni?: string;
  /** Grado ("ABG.", "ING."): antecede al nombre en el "A:" del memorándum. */
  grado?: string;
  /** Cargo/unidad ("UNIDAD DE ADQUISICIÓN"): va DEBAJO del nombre en el "A:". */
  cargo?: string;
  /** Correo, como respaldo de identificación. */
  correo?: string;
  /** Comprador público (DEC), experto/profesional… (Art. 56.1). */
  rol?: string;
  /**
   * Titular o suplente. El comité (Art. 59.1) y el jurado (Art. 60.1) se designan
   * con titulares Y suplentes; el oficial de compra es único (siempre titular).
   * Vacío = titular (compatibilidad con datos anteriores).
   */
  condicion?: "titular" | "suplente";
};

/**
 * Problemas de composición del panel (Art. 56.1), como avisos del paso. No
 * bloquean el guardado, pero señalan lo que la norma exige antes de designar.
 *
 * - Oficial de compra: 1 integrante (Art. 58.1).
 * - Comité: 3 TITULARES, con ≥1 comprador público de la DEC y ≥1 experto/
 *   profesional (Art. 56.1.b), y con suplentes (Art. 59.1).
 * - Jurado: 3 o 5 TITULARES expertos (Art. 56.1.c), y con suplente (Art. 60.1).
 */
export function problemasComposicionPanel(
  tipo: string,
  integrantes: IntegranteEvaluador[],
): string[] {
  const avisos: string[] = [];
  // Solo son miembros los que tienen nombre (o correo): las filas que la plantilla
  // crea en blanco —con su condición y rol por defecto— aún no cuentan.
  const conNombre = integrantes.filter((i) => (i.nombre ?? "").trim() || (i.correo ?? "").trim());
  const titulares = conNombre.filter((i) => (i.condicion ?? "titular") === "titular");
  const suplentes = conNombre.filter((i) => i.condicion === "suplente");
  const tieneRol = (frag: string) =>
    titulares.some((i) => (i.rol ?? "").toLowerCase().includes(frag));

  if (tipo === "oficial_compra") {
    if (titulares.length !== 1) avisos.push("El oficial de compra es un único integrante (Art. 58.1).");
    return avisos;
  }
  if (tipo === "comite") {
    if (titulares.length !== 3) {
      avisos.push(`El comité tiene ${titulares.length} titular(es): la norma exige 3 (Art. 56.1.b).`);
    }
    if (!tieneRol("comprador") && !tieneRol("dec")) {
      avisos.push("Falta al menos un comprador público de la DEC en el comité (Art. 56.1.b).");
    }
    if (!tieneRol("experto") && !tieneRol("profesional")) {
      avisos.push("Falta al menos un experto o profesional con conocimiento técnico en el comité (Art. 56.1.b).");
    }
    if (suplentes.length === 0) {
      avisos.push("El comité se designa con titulares Y suplentes (Art. 59.1): aún no hay suplentes.");
    }
    return avisos;
  }
  if (tipo === "jurado") {
    if (titulares.length !== 3 && titulares.length !== 5) {
      avisos.push(`El jurado tiene ${titulares.length} titular(es): la norma exige 3 o 5 (Art. 56.1.c).`);
    }
    if (suplentes.length === 0) {
      avisos.push("En el mismo acto se designa un suplente del jurado (Art. 60.1): aún no hay ninguno.");
    }
    return avisos;
  }
  return avisos;
}

export function leerIntegrantes(value: unknown): IntegranteEvaluador[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is IntegranteEvaluador => typeof v === "object" && v !== null);
}

/**
 * Todos los integrantes del panel: la propuesta de la DEC (`integrantes`) más la
 * del área usuaria (`integrantes_area_usuaria`, solo comité). El memorándum, la
 * declaración jurada, el consentimiento y la validación de composición abarcan al
 * comité COMPLETO, así que operan sobre esta unión, no sobre una sola lista.
 */
export function todosLosIntegrantes(a6: Record<string, unknown> | null | undefined): IntegranteEvaluador[] {
  return [...leerIntegrantes(a6?.integrantes), ...leerIntegrantes(a6?.integrantes_area_usuaria)];
}

/** Cómo se identifica un integrante: su nombre, y si no, su correo. */
export function identificacion(i: IntegranteEvaluador): string {
  const n = (i.nombre ?? "").trim();
  if (n) return n;
  return (i.correo ?? "").trim();
}

/** ¿Este integrante sale identificado solo por su correo? El documento se firma. */
export function soloTieneCorreo(i: IntegranteEvaluador): boolean {
  return !(i.nombre ?? "").trim() && Boolean((i.correo ?? "").trim());
}
