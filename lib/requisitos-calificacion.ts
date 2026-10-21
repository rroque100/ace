// Requisitos de calificación: separación OBLIGATORIOS / FACULTATIVOS.
//
// El Reglamento (Art. 72.3) define los 5 tipos y el Art. 72.4 delega en las
// bases estándar qué tipos aplican según la modalidad del procedimiento. El
// Formato de Estrategia de Contratación (variable f) exige listarlos separados:
// los obligatorios solo se enumeran; los facultativos requieren SUSTENTO.
//
// Se persisten como TEXTO canónico (no requiere migración y las exportaciones
// existentes lo imprimen legible), con round-trip garantizado por parse/format.

export type RequisitoFacultativo = { nombre: string; sustento: string; acreditacion?: string };

export type RequisitosCalificacion = {
  obligatorios: string[];
  facultativos: RequisitoFacultativo[];
};

const H_OBLIGATORIOS = "OBLIGATORIOS:";
const H_FACULTATIVOS = "FACULTATIVOS:";

export const REQUISITOS_VACIO: RequisitosCalificacion = { obligatorios: [], facultativos: [] };

/** Quita viñetas iniciales ("- ", "• ", "* "). */
function limpiarViñeta(linea: string): string {
  return linea.replace(/^[-•*]\s*/, "").trim();
}

// Los campos (detalle, acreditación, sustento) admiten TEXTO DE PÁRRAFO: el
// usuario puede escribir varias líneas. Pero el formato canónico delimita cada
// requisito con "\n", así que un salto DENTRO de un campo rompería el parseo
// (cada línea física se leería como un requisito aparte). Se codifican los
// saltos internos con un carácter de control (U+0001) que no se puede teclear y
// que nunca aparece en prosa; se restauran al parsear. Nunca llega al DOM ni a
// las exportaciones: el editor siempre parsea el valor, y el export vuelca por
// celda pasando también por parseRequisitos.
const SALTO_INTERNO = "";

function escaparSaltos(s: string): string {
  return s.replace(/\r\n|\r|\n/g, SALTO_INTERNO);
}

function restaurarSaltos(s: string): string {
  return s.split(SALTO_INTERNO).join("\n");
}

/**
 * Parte una línea en sus tres piezas: nombre, acreditación y sustento.
 *
 * El formato canónico encadena dos segmentos opcionales tras el nombre, en
 * cualquier orden: "— Acredita: …" (cómo se prueba, Art. 72.1) y "— Sustento:
 * …" (por qué se exige, solo facultativos). El nombre es lo anterior al primer
 * separador. Round-trip garantizado con `serializarLinea`.
 */
function partirSegmentos(item: string): { nombre: string; sustento: string; acreditacion: string } {
  const acr = item.match(/\s[—-]\s*Acredita:\s*([^—]*?)(?=\s[—-]\s*Sustento:|$)/i);
  const sus = item.match(/\s[—-]\s*Sustento:\s*([^—]*?)(?=\s[—-]\s*Acredita:|$)/i);
  const primerSep = item.search(/\s[—-]\s*(Acredita|Sustento):/i);
  const nombre = (primerSep >= 0 ? item.slice(0, primerSep) : item).trim();
  return {
    acreditacion: acr?.[1]?.trim() ?? "",
    nombre,
    sustento: sus?.[1]?.trim() ?? "",
  };
}

/** Reconstruye la línea desde sus piezas (acreditación antes que sustento). */
function serializarLinea(nombre: string, acreditacion: string, sustento: string): string {
  let out = nombre.trim();
  if (acreditacion.trim()) out += ` — Acredita: ${acreditacion.trim()}`;
  if (sustento.trim()) out += ` — Sustento: ${sustento.trim()}`;
  return out;
}

/**
 * Parsea el texto canónico a la estructura. Compatibilidad hacia atrás: si el
 * texto no tiene los encabezados (valores heredados de texto libre), cada línea
 * no vacía se interpreta como un requisito obligatorio.
 */
export function parseRequisitos(raw: string | null | undefined): RequisitosCalificacion {
  const text = (raw ?? "").trim();
  const out: RequisitosCalificacion = { obligatorios: [], facultativos: [] };
  if (!text) return out;

  const tieneEncabezados = /OBLIGATORIOS:/i.test(text) || /FACULTATIVOS:/i.test(text);
  if (!tieneEncabezados) {
    for (const linea of text.split("\n")) {
      const v = limpiarViñeta(linea);
      if (v) out.obligatorios.push(restaurarSaltos(v));
    }
    return out;
  }

  let seccion: "obl" | "fac" | null = null;
  for (const linea of text.split("\n")) {
    const l = linea.trim();
    if (!l) continue;
    if (/^OBLIGATORIOS:/i.test(l)) {
      seccion = "obl";
      continue;
    }
    if (/^FACULTATIVOS:/i.test(l)) {
      seccion = "fac";
      continue;
    }
    const item = limpiarViñeta(l);
    if (!item) continue;
    // Cada línea puede llevar dos segmentos con separador "—":
    //   <nombre> — Acredita: <cómo se prueba> — Sustento: <por qué>
    // Se extraen en cualquier orden; el nombre es lo anterior al primer "—".
    const { nombre, sustento, acreditacion } = partirSegmentos(item);
    // Los saltos internos, codificados al serializar, vuelven a ser "\n" en cada
    // campo (texto de párrafo). Los separadores "— Acredita:"/"— Sustento:" no
    // se ven afectados porque llevan espacios, no saltos.
    const nom = restaurarSaltos(nombre);
    const acr = restaurarSaltos(acreditacion);
    const sus = restaurarSaltos(sustento);
    if (seccion === "obl") {
      // El obligatorio arrastra su acreditación pegada al nombre en el texto
      // (`string[]` no tiene campo aparte); repartirRequisitos la separa.
      out.obligatorios.push(acr ? `${nom} — Acredita: ${acr}` : nom);
    } else if (seccion === "fac") {
      out.facultativos.push({ nombre: nom, sustento: sus, acreditacion: acr || undefined });
    }
  }
  return out;
}

/** Serializa la estructura al texto canónico (lo que se persiste y se exporta). */
export function formatRequisitos(r: RequisitosCalificacion): string {
  const lineas: string[] = [];
  const obligatorios = r.obligatorios.map((s) => s.trim()).filter(Boolean);
  const facultativos = r.facultativos.filter((f) => f.nombre.trim());

  // Se codifican los saltos internos de cada requisito ANTES de unir con "\n":
  // así una línea del texto canónico = un requisito, aunque el campo tenga
  // varias líneas de párrafo.
  if (obligatorios.length > 0) {
    lineas.push(H_OBLIGATORIOS);
    for (const o of obligatorios) lineas.push(`- ${escaparSaltos(o)}`);
  }
  if (facultativos.length > 0) {
    if (lineas.length > 0) lineas.push("");
    lineas.push(H_FACULTATIVOS);
    for (const f of facultativos) {
      lineas.push(`- ${escaparSaltos(serializarLinea(f.nombre, f.acreditacion ?? "", f.sustento))}`);
    }
  }
  return lineas.join("\n");
}

/**
 * Los CINCO tipos del Art. 72.3 del Reglamento. Es una lista CERRADA: no
 * existe un sexto tipo de requisito de calificación. El editor los ofrece como
 * casillas, no como sugerencias, para que no se puedan inventar requisitos
 * ("Certificación ISO 9001" no es un requisito de calificación).
 *
 * Cuáles son obligatorios y cuáles facultativos NO se decide aquí: lo
 * determinan las bases estándar según la modalidad del procedimiento
 * (Art. 72.4). Mientras esa tabla no esté cargada, lo marca el usuario.
 */
export const TIPOS_REQUISITO_ART72 = [
  {
    key: "capacidad_legal",
    label: "Capacidad legal",
    ayuda: "Estar apto para ejecutar la actividad económica. Solo se exige si la normativa que regula el objeto pide una habilitación concreta; si no la pide, este requisito se omite. En consorcio lo acredita cada integrante comprometido con el objeto.",
    ejemplo: "RNP vigente en el capítulo de bienes; licencia de funcionamiento.",
  },
  {
    key: "experiencia_postor",
    label: "Experiencia del postor en la especialidad",
    ayuda: "Monto facturado acumulado en contrataciones iguales o similares al objeto. El formato pone dos topes: no puede superar TRES VECES la cuantía de la contratación o del ítem, y se cuenta en los QUINCE años anteriores a la presentación de ofertas. En obras y consultoría de obras, por especialidad y subespecialidad (Art. 157).",
    ejemplo: "Monto facturado acumulado de S/ 180,000 en servicios iguales o similares, en los quince años anteriores a la presentación de ofertas.",
  },
  {
    // Va tras «Experiencia del postor» y antes de «Consorcio». En la FICHA se
    // agrupa bajo el encabezado «3.5.2 Requisitos de calificación adicionales» y
    // se rotula con la letra «C» (lo pinta el editor); su nombre canónico —el que
    // viaja al documento y a los datos— sigue siendo el del Art. 72.3.b.
    key: "capacidad_tecnica",
    label: "Capacidad técnica y profesional",
    ayuda: "Experiencia y calificaciones del personal clave, equipamiento e infraestructura estratégicos. En formación académica solo cabe exigir el GRADO o título, no cursos ni especializaciones.",
    ejemplo: "Un (1) ingeniero de sistemas con 3 años de experiencia; servidor de pruebas.",
  },
  {
    key: "consorcio",
    label: "Condiciones de participación en consorcio",
    ayuda: "Número máximo de consorciados, porcentaje mínimo de participación y/o participación del integrante con mayor experiencia.",
    ejemplo: "Máximo 2 consorciados; participación mínima del 30% cada uno.",
  },
  {
    key: "capacidad_economica",
    label: "Capacidad económica",
    ayuda: "Antecedentes financieros que demuestren que puede cumplir las obligaciones del contrato.",
    ejemplo: "Ratio de liquidez corriente mayor a 1.0 según los EE.FF. del último ejercicio.",
  },
] as const;

/**
 * Desglose de la capacidad técnica y profesional, tal como lo parte el modelo.
 *
 * El Art. 72.3.b la define como UN tipo, pero el formato del requerimiento lo
 * abre en cuatro literales con reglas propias, y esas reglas son las que se
 * observan si se incumplen. No son tipos nuevos —seguirían siendo los cinco del
 * 72.3— sino la guía de qué escribir dentro de este.
 */
export const SUBTIPOS_CAPACIDAD_TECNICA = [
  {
    clave: "C.1",
    label: "Experiencia del personal clave",
    regla: "Se acredita en el Anexo N.º 19. No cuenta la experiencia con antigüedad mayor a 25 años, y el periodo traslapado se computa una sola vez.",
  },
  {
    clave: "C.2.1",
    label: "Formación académica",
    regla: "Solo cabe exigir «grado de bachiller» o «título profesional». No cursos, diplomados ni especializaciones.",
  },
  {
    clave: "C.2.2",
    label: "Capacitación del personal clave",
    regla: "Hasta 120 horas como máximo, en materia específicamente relacionada con lo que hará ese personal.",
  },
  {
    clave: "C.3",
    label: "Equipamiento estratégico",
    regla: "Solo el equipamiento e infraestructura estratégicos. Lo que no sea clave va en las condiciones de la prestación, no aquí.",
  },
] as const;

export type TipoRequisitoArt72 = (typeof TIPOS_REQUISITO_ART72)[number]["key"];

function normalizar(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacríticos
    .toLowerCase()
    .replace(/\(.*?\)/g, "") // descarta acotaciones tipo "(solo con precalificación)"
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const POR_NOMBRE = new Map<string, TipoRequisitoArt72>(
  TIPOS_REQUISITO_ART72.map((t) => [normalizar(t.label), t.key]),
);

/**
 * Resuelve el nombre guardado a uno de los 5 tipos del 72.3, tolerando
 * acentos, mayúsculas y acotaciones. Devuelve null si el texto no corresponde a
 * ninguno: los datos antiguos son texto libre y no deben perderse en silencio.
 */
export function tipoArt72DeNombre(nombre: string): TipoRequisitoArt72 | null {
  return POR_NOMBRE.get(normalizar(nombre)) ?? null;
}

export function labelTipoArt72(key: TipoRequisitoArt72): string {
  return TIPOS_REQUISITO_ART72.find((t) => t.key === key)?.label ?? key;
}

// Estructura oficial del 3.5 (Bases Estándar): los 5 tipos se agrupan en dos
// subsecciones (3.5.1 obligatorios / 3.5.2 adicionales) y se rotulan con letras
// A–D. `capacidad_economica` no lleva letra en el formato oficial. Vive aquí
// (server-safe) para que lo COMPARTAN la ficha (editor) y el documento (Word) sin
// divergir.
export type GrupoRequisito = "obligatorios" | "adicionales";
export const GRUPO_TIPO_ART72: Record<TipoRequisitoArt72, GrupoRequisito> = {
  capacidad_legal: "obligatorios",
  experiencia_postor: "obligatorios",
  capacidad_tecnica: "adicionales",
  consorcio: "adicionales",
  capacidad_economica: "adicionales",
};
export const LETRA_TIPO_ART72: Partial<Record<TipoRequisitoArt72, string>> = {
  capacidad_legal: "A",
  experiencia_postor: "B",
  capacidad_tecnica: "C",
  consorcio: "D",
};
export const TITULO_GRUPO_ART72: Record<GrupoRequisito, string> = {
  obligatorios: "3.5.1 Requisitos de calificación obligatorios",
  adicionales: "3.5.2 Requisitos de calificación adicionales",
};

export type EstadoRequisito = "no" | "obligatorio" | "facultativo";

export type EstadoTipoRequisito = {
  estado: EstadoRequisito;
  /**
   * Qué se exige concretamente ("RNP vigente en el capítulo de bienes"). El
   * 72.3 fija los cinco TIPOS, pero no su contenido: ese lo pone la entidad y
   * sin él el requisito no es acreditable. Aplica a obligatorios y facultativos.
   */
  detalle: string;
  /**
   * Con QUÉ se acredita el cumplimiento (Art. 72.1: "acreditado conforme
   * indiquen las bases"). Ej.: "Copia del RNP vigente", "EE.FF. auditados del
   * último ejercicio". Aplica a obligatorios y facultativos.
   */
  acreditacion: string;
  /**
   * Por qué se exige. Solo tiene sentido en los facultativos: son los únicos
   * que la DEC puede excluir si la interacción con el mercado demuestra que no
   * hacen falta (Guía, Cap. II).
   */
  sustento: string;
};

/**
 * Separa "Tipo: detalle" en su tipo del 72.3 y su contenido.
 * Devuelve tipo null si el texto no corresponde a ningún tipo: los valores
 * heredados en texto libre deben ir al bloque de "otros", no forzarse.
 */
function partirNombre(texto: string): { tipo: TipoRequisitoArt72 | null; detalle: string } {
  const limpio = texto.trim();
  // Sin detalle: el nombre entero ya es el tipo.
  const entero = tipoArt72DeNombre(limpio);
  if (entero) return { tipo: entero, detalle: "" };
  // Con detalle: "Capacidad legal: RNP vigente…".
  const i = limpio.indexOf(":");
  if (i > 0) {
    const tipo = tipoArt72DeNombre(limpio.slice(0, i));
    if (tipo) return { tipo, detalle: limpio.slice(i + 1).trim() };
  }
  return { tipo: null, detalle: "" };
}

/** Reconstruye "Tipo: detalle" (o solo "Tipo" si no hay detalle). */
function unirNombre(key: TipoRequisitoArt72, detalle: string): string {
  const d = detalle.trim();
  return d ? `${labelTipoArt72(key)}: ${d}` : labelTipoArt72(key);
}

export type RepartoRequisitos = {
  /** Estado de cada uno de los 5 tipos del 72.3. */
  porTipo: Map<TipoRequisitoArt72, EstadoTipoRequisito>;
  /** Valores heredados en texto libre que no son ninguno de los 5 tipos. */
  otrosObligatorios: string[];
  otrosFacultativos: RequisitoFacultativo[];
};

/**
 * Reparte lo guardado entre los 5 tipos del 72.3 y los valores heredados.
 * Lo que no corresponde a un tipo NO se descarta: se devuelve aparte para que
 * el editor lo muestre y el usuario decida. Perder requisitos en silencio al
 * cerrar la lista sería peor que la lista abierta.
 */
export function repartirRequisitos(data: RequisitosCalificacion): RepartoRequisitos {
  const porTipo = new Map<TipoRequisitoArt72, EstadoTipoRequisito>();
  const otrosObligatorios: string[] = [];
  const otrosFacultativos: RequisitoFacultativo[] = [];

  for (const item of data.obligatorios) {
    // El obligatorio puede traer la acreditación pegada ("Tipo: detalle —
    // Acredita: …"); se separa antes de identificar el tipo.
    const { nombre, acreditacion } = partirSegmentos(item);
    const { tipo, detalle } = partirNombre(nombre);
    if (tipo) porTipo.set(tipo, { estado: "obligatorio", detalle, acreditacion, sustento: "" });
    else otrosObligatorios.push(item);
  }
  for (const f of data.facultativos) {
    const { tipo, detalle } = partirNombre(f.nombre);
    if (tipo) {
      porTipo.set(tipo, { estado: "facultativo", detalle, acreditacion: f.acreditacion ?? "", sustento: f.sustento });
    } else {
      otrosFacultativos.push(f);
    }
  }
  return { porTipo, otrosObligatorios, otrosFacultativos };
}

/**
 * Reconstruye el texto canónico desde el reparto, respetando el orden del 72.3
 * y arrastrando los heredados al final.
 */
export function componerRequisitos(reparto: RepartoRequisitos): string {
  const salida: RequisitosCalificacion = { obligatorios: [], facultativos: [] };
  for (const tipo of TIPOS_REQUISITO_ART72) {
    const e = reparto.porTipo.get(tipo.key);
    if (!e || e.estado === "no") continue;
    const nombre = unirNombre(tipo.key, e.detalle);
    if (e.estado === "obligatorio") {
      // La acreditación del obligatorio va pegada al nombre (no hay campo).
      salida.obligatorios.push(
        e.acreditacion.trim() ? `${nombre} — Acredita: ${e.acreditacion.trim()}` : nombre,
      );
    } else {
      salida.facultativos.push({ nombre, sustento: e.sustento, acreditacion: e.acreditacion || undefined });
    }
  }
  salida.obligatorios.push(...reparto.otrosObligatorios);
  salida.facultativos.push(...reparto.otrosFacultativos);
  return formatRequisitos(salida);
}

// La migración de los campos sueltos heredados (experiencia del postor, personal
// clave) al editor del 72.3 ya NO vive aquí: la hacen de una vez las columnas al
// eliminarse, en docs/supabase/necesidades-drop-requisitos-duplicados.sql. Con
// las columnas fuera, una consolidación en cada apertura de la ficha no tendría
// de dónde leer.

/**
 * Ayuda del tipo de requisito ADAPTADA al objeto contractual.
 *
 * El Art. 72.3.b es explícito: "En el caso de obras y consultoría de obras, la
 * experiencia del personal clave corresponde a la especialidad y subespecialidad
 * acorde al artículo 157". Es decir, la capacidad técnica y la experiencia del
 * postor cambian de contenido según el objeto — en obras exigen especialidad,
 * en bienes/servicios no. La ayuda genérica no lo reflejaba.
 *
 * Devuelve la ayuda base cuando el objeto no aporta un matiz (o no se conoce):
 * añadir texto que no toca sería peor que la ayuda genérica.
 */
export function ayudaPorObjeto(
  key: TipoRequisitoArt72,
  ayudaBase: string,
  objeto: string | null | undefined,
): string {
  // El objeto llega con dos nomenclaturas: la Necesidad usa "obras"/"servicios"
  // (plural) y A3/A4 usa "obra"/"servicio" (singular, de OBJETO_MAP). Se
  // aceptan las dos para que la ayuda funcione en las dos páginas.
  const o = (objeto ?? "").toLowerCase();
  const esObra = o === "obras" || o === "obra" || o === "consultoria_obra" || o === "consultoria_obras";
  if (!esObra) return ayudaBase;

  if (key === "capacidad_tecnica") {
    return `${ayudaBase} En OBRAS y consultoría de obras, la experiencia del personal clave corresponde a la especialidad y subespecialidad (Art. 157 del Reglamento) y la DEC la verifica para la suscripción del contrato (Art. 88.1.g).`;
  }
  if (key === "experiencia_postor") {
    return `${ayudaBase} En OBRAS y consultoría de obras se mide por la especialidad y subespecialidad del objeto (Art. 157).`;
  }
  return ayudaBase;
}

/**
 * Acreditación TÍPICA de cada tipo del 72.3, para guiar (placeholder), no para
 * imponer: el Art. 72.1 dice que la acreditación es "conforme indiquen las
 * bases", así que el detalle definitivo lo fija la modalidad. Aquí es una
 * propuesta orientativa del área usuaria (Art. 44.2).
 *
 * Los textos salen del propio 72.3 (p. ej. capacidad económica → "volumen de
 * ventas, estados financieros auditados").
 */
export const ACREDITACION_TIPICA: Readonly<Record<TipoRequisitoArt72, string>> = {
  capacidad_legal: "Habilitaciones del objeto: RNP vigente, licencia/autorización sectorial, vigencia de poder.",
  capacidad_tecnica: "CV documentado del personal clave, títulos/colegiatura, y documentos del equipamiento e infraestructura.",
  experiencia_postor: "Contratos u órdenes iguales o similares con su comprobante de pago o conformidad, del periodo que fijen las bases.",
  consorcio: "Promesa de consorcio con el porcentaje de participación de cada integrante.",
  capacidad_economica: "Volumen de ventas y estados financieros auditados del último ejercicio (solo con precalificación).",
};

/**
 * Cita legal EXACTA de cada tipo del 72.3. Es lo que se vuelca en la variable f)
 * de la estrategia (A4) al "Traer datos" de la necesidad: no el texto libre que
 * el área usuaria escribió, sino la NORMA que rige ese requisito. En obras y
 * consultoría de obras, la capacidad técnica y la experiencia añaden el Art. 157
 * (especialidad y subespecialidad). La DEC concreta el detalle sobre esa base.
 */
const CITA_ART72 = "Art. 72.3 del Reglamento de la Ley N° 32069";

export function citaLegalRequisito(key: TipoRequisitoArt72, objeto: string | null | undefined): string {
  const o = (objeto ?? "").toLowerCase();
  const esObra = o === "obras" || o === "obra" || o === "consultoria_obra" || o === "consultoria_obras";
  if (esObra && key === "capacidad_tecnica") {
    return `${CITA_ART72}; en obras y consultoría de obras, el personal clave se acredita por especialidad y subespecialidad (Art. 157 del Reglamento).`;
  }
  if (esObra && key === "experiencia_postor") {
    return `${CITA_ART72}; en obras y consultoría de obras, por especialidad y subespecialidad (Art. 157 del Reglamento).`;
  }
  return `${CITA_ART72}.`;
}

/**
 * Construye la variable f) de la estrategia a partir de la sección b) del
 * requerimiento: conserva SOLO los tipos del 72.3 que el área usuaria marcó
 * (con su naturaleza obligatorio/facultativo) y reemplaza su contenido por la
 * CITA LEGAL exacta del tipo. No arrastra el texto libre, la acreditación ni el
 * sustento del requerimiento; tampoco los valores heredados que no son del 72.3.
 * Devuelve "" si no hay ningún tipo marcado.
 */
export function requisitosNormaDeNecesidad(
  requisitosNecesidad: string | null | undefined,
  objeto: string | null | undefined,
): string {
  const reparto = repartirRequisitos(parseRequisitos(requisitosNecesidad ?? ""));
  const porTipo = new Map<TipoRequisitoArt72, EstadoTipoRequisito>();
  for (const [key, e] of reparto.porTipo) {
    if (e.estado === "no") continue;
    porTipo.set(key, { estado: e.estado, detalle: citaLegalRequisito(key, objeto), acreditacion: "", sustento: "" });
  }
  return componerRequisitos({ porTipo, otrosObligatorios: [], otrosFacultativos: [] });
}
