// Denominación del requerimiento: el nombre descriptivo de la contratación.
//
// NO hay fórmula normativa. Se buscó en la Ley 32069, su Reglamento y las tres
// versiones de la Guía: "denominación" solo aparece como etiqueta de campo en
// los Anexos 1 y 2 ("Denominación del requerimiento: [Insertar…]"), y las 27
// menciones del Reglamento son sobre proveedores (razón social, RNP).
//
// Lo que sí impone la norma son tres límites, y de ellos sale el patrón:
//
//   Art. 44.10 → el objeto lo determina la naturaleza de la contratación; con
//                varias prestaciones, manda la de MAYOR COSTO. Ese objeto fija
//                el verbo ("Adquisición de…" vs "Servicio de…").
//   Art. 44.6  → prohibido referir procedencia, fabricante, MARCA, patente u
//                origen, "ni descripción que oriente la contratación hacia
//                ellos", salvo compatibilización aprobada por la AGA.
//   Art. 44.1  → el requerimiento atiende una necesidad para el cumplimiento de
//                la FINALIDAD PÚBLICA.
//
// El patrón sale de los ejemplos oficiales de la Guía ("Adquisición de balanzas
// electrónicas por renovación para el año 2026", "Servicio de seguridad para su
// sucursal en Arequipa"):
//
//   [Acción según el objeto] + [QUÉ genérico] + [PARA QUIÉN] + [ámbito/periodo]

export type PiezasDenominacion = {
  tipoObjeto: string | null | undefined;
  /** Descripción del catálogo (CUBSO/SIGA): genérica y sin marca por definición. */
  descripcionCatalogo: string | null | undefined;
  areaUsuaria: string | null | undefined;
  entidad: string | null | undefined;
  distrito: string | null | undefined;
  anioFiscal: number | null | undefined;
};

export type PiezaFaltante = {
  campo: string;
  /**
   * Clave del formulario a la que escribe (la del API, en camelCase). Si está,
   * la pieza se puede rellenar desde el propio asistente sin ir a su sección.
   * Ausente cuando el campo no es texto libre (p. ej. el tipo de objeto, que es
   * un select y ya vive junto al nombre).
   */
  api?: string;
  label: string;
  seccion: string;
  ejemplo?: string;
};

export type Denominacion = {
  /** Nombre propuesto. Lleva marcas ⟨…⟩ donde falta información. */
  sugerencia: string;
  /** Piezas sin registrar, con la sección de la ficha donde se rellenan. */
  faltantes: PiezaFaltante[];
  /** true si están todas las piezas: la sugerencia es usable tal cual. */
  completa: boolean;
};

/** El verbo lo fija el objeto contractual (Art. 44.10). */
const ACCION_POR_OBJETO: Record<string, string> = {
  bienes: "Adquisición de",
  servicios: "Servicio de",
  obras: "Ejecución de la obra",
  consultoria_obra: "Consultoría para",
};

function texto(v: string | null | undefined): string {
  return (v ?? "").trim();
}

/** Compara ignorando acentos, mayúsculas, guiones y espacios de más. */
function comparable(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * ¿El fragmento ya está dicho en el texto?
 *
 * La población beneficiaria suele traer ya la entidad y el distrito ("las áreas
 * de la MUNICIPALIDAD DISTRITAL DE CHALLHUAHUACHO"). Añadir el ámbito detrás
 * repetía el mismo nombre dos y tres veces en la misma frase.
 */
function yaContiene(textoBase: string, fragmento: string): boolean {
  const f = comparable(fragmento);
  return f.length > 0 && comparable(textoBase).includes(f);
}

/**
 * Compone la denominación con lo que hay registrado en la ficha y señala lo que
 * falta, en vez de rellenarlo por su cuenta: el nombre acaba en el Anexo N° 2 y
 * en un informe firmado, así que inventarlo sería peor que dejarlo incompleto.
 */
export function componerDenominacion(p: PiezasDenominacion): Denominacion {
  const faltantes: PiezaFaltante[] = [];

  const accion = ACCION_POR_OBJETO[texto(p.tipoObjeto)] ?? "";
  if (!accion) {
    // Sin `api`: es un select y ya está junto al nombre, no hace falta duplicarlo.
    faltantes.push({
      campo: "tipo_objeto",
      label: "Tipo de objeto",
      seccion: "Objeto de la contratación",
    });
  }

  // El QUÉ sale del catálogo: es genérico por definición, así que cumple el 44.6.
  const que = texto(p.descripcionCatalogo);
  if (!que) {
    faltantes.push({
      campo: "descripcion_catalogo",
      api: "descripcionCatalogo",
      label: "Descripción de catálogo",
      seccion: "Objeto de la contratación",
      ejemplo: "servidor de datos tipo rack",
    });
  }

  // El PARA QUIÉN: la población beneficiaria es lo propio; si no está, el área
  // usuaria sirve de respaldo, pero se señala igual.
  // Antes la denominación decía "para <población beneficiaria>" y solo caía al
  // área usuaria si faltaba. Ese campo se retiró de la ficha —no lo consumía
  // ninguna fase— así que el destinatario es siempre el área usuaria.
  const paraQuien = texto(p.areaUsuaria);

  const ambito = texto(p.entidad) || (texto(p.distrito) ? `distrito de ${texto(p.distrito)}` : "");
  const anio = p.anioFiscal ? String(p.anioFiscal) : "";

  const partes = [
    accion || "⟨acción⟩",
    que || "⟨qué se contrata⟩",
    paraQuien ? `para ${paraQuien}` : "para ⟨quién⟩",
  ];

  // El ámbito solo si no está dicho ya. La población beneficiaria suele
  // arrastrar el nombre de la entidad y del distrito, y encadenarlo detrás
  // producía frases como "… para MUNICIPALIDAD DISTRITAL DE CHALLHUAHUACHO-DEL
  // DISTRITO DE CHALLHUAHUACHO de Municipalidad distrital de Challhuahuacho".
  if (ambito && !yaContiene(partes.join(" "), ambito)) partes.push(`de ${ambito}`);
  if (anio) partes.push(`— ${anio}`);

  // En MAYÚSCULAS: es como se denomina la contratación en los formatos
  // oficiales, en el SEACE y en las bases estándar.
  const sugerencia = partes.join(" ").replace(/\s+/g, " ").trim().toUpperCase();

  return { sugerencia, faltantes, completa: faltantes.length === 0 };
}

// Marcas frecuentes en compras municipales. La lista es corta a propósito: no
// pretende ser exhaustiva —eso es imposible— sino cazar lo que más se cuela.
const MARCAS = [
  "hp", "dell", "lenovo", "asus", "acer", "apple", "samsung", "lg", "sony",
  "intel", "amd", "nvidia", "microsoft", "oracle", "cisco", "canon", "epson",
  "kingston", "western digital", "seagate", "bosch", "makita", "stanley",
  "toyota", "nissan", "hyundai", "honda", "volvo", "caterpillar", "komatsu",
  "john deere", "gloria", "laive", "nestle",
];

// Giros que orientan hacia un proveedor aunque no nombren la marca. El 44.6
// prohíbe expresamente "descripción que oriente la contratación hacia ellos".
const GIROS = [
  "compatible con",
  "similar a",
  "equivalente a",
  "tipo marca",
  "de la marca",
  "marca ",
  "modelo ",
];

/**
 * Nombre del expediente derivado de una necesidad: "REQ-2026-0004 — Adquisición…".
 *
 * Vive aquí, y no dentro del endpoint que deriva, porque ahora hay dos sitios
 * que lo componen: la derivación y el renombrado posterior. Con la fórmula
 * duplicada, un expediente renombrado acabaría con un formato distinto al de
 * los recién derivados.
 *
 * Ojo: esto es la DENOMINACIÓN del expediente, no la nomenclatura del
 * procedimiento de selección ("LICITACIÓN PÚBLICA N° 001-2026-…"), que asigna
 * PLADICOP en la convocatoria y ninguna norma define cómo se compone.
 */
export function nomenclaturaExpediente(
  codigo: string | null | undefined,
  nombre: string | null | undefined,
): string {
  const c = texto(codigo);
  const n = texto(nombre);
  if (!n) return c;
  return c ? `${c} — ${n}` : n;
}

export type AvisoMarca = { termino: string; tipo: "marca" | "giro" };

/**
 * Detecta referencias a marca en la denominación (Art. 44.6).
 *
 * Es una HEURÍSTICA, no una garantía: caza lo evidente y se le escapará lo
 * demás. Sirve para avisar, nunca para dar por bueno un nombre.
 */
export function detectarMarca(nombre: string): AvisoMarca[] {
  const n = ` ${nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()} `;
  const avisos: AvisoMarca[] = [];
  for (const giro of GIROS) {
    if (n.includes(giro)) avisos.push({ termino: giro.trim(), tipo: "giro" });
  }
  for (const marca of MARCAS) {
    // Con límites de palabra: "hp" no debe saltar dentro de "champú".
    if (new RegExp(`(^|[^a-z0-9])${marca}([^a-z0-9]|$)`).test(n)) {
      avisos.push({ termino: marca, tipo: "marca" });
    }
  }
  return avisos;
}

/**
 * Siembra entre "Nombre de la contratación" y "Descripción detallada".
 *
 * Los dos campos se parecen pero NO son el mismo dato: el nombre es la
 * denominación (Art. 44.6 · va al ASUNTO del informe de segmentación, a la
 * matriz y a la nomenclatura del expediente) y la descripción detallada es el
 * Art. 126.1 (especificaciones técnicas o términos de referencia), que además
 * compone el "alcance de la contratación" de A3.
 *
 * Por eso no se enlazan en espejo: se SIEMBRA el que aún no tiene dueño. Un
 * campo tiene dueño en cuanto alguien escribe en él a mano; hasta entonces
 * sigue copiando a su gemelo. Mirar solo "está vacío" no basta: dejaría de
 * copiar en la segunda pulsación, cuando el gemelo ya tiene la primera letra.
 */
export const GEMELO: Readonly<Record<string, string>> = {
  descripcionDetallada: "nombre",
  nombre: "descripcionDetallada",
};

export function decidirSiembra(input: {
  /** Campo en el que el usuario acaba de escribir. */
  api: string;
  /** Texto que el usuario acaba de escribir. */
  value: string;
  /** Valor actual del campo gemelo. */
  valorGemelo: string;
  /** Campos que hoy siguen a su gemelo (nadie los ha tocado a mano). */
  sembrados: ReadonlySet<string>;
  /** Tope de caracteres del nombre (el de la descripción es mayor). */
  maxNombre: number;
}): { sembrar: string | null; sembrados: Set<string> } {
  const proximos = new Set(input.sembrados);
  const gemelo = GEMELO[input.api];
  if (!gemelo) return { sembrar: null, sembrados: proximos };

  // Escribir en un campo lo hace tuyo: deja de seguir a nadie.
  proximos.delete(input.api);

  const libre = !input.valorGemelo.trim() || proximos.has(gemelo);
  // El nombre tiene un tope menor que la descripción: pasado el límite se deja
  // de sembrar en vez de dejar la ficha inguardable con un 400 del servidor.
  const cabe = gemelo !== "nombre" || input.value.length <= input.maxNombre;
  if (!libre || !cabe) return { sembrar: null, sembrados: proximos };

  proximos.add(gemelo);
  return { sembrar: gemelo, sembrados: proximos };
}
