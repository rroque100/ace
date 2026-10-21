// Nombres de personas en los documentos oficiales.
//
// Conviven dos órdenes en la base y hay que reconciliarlos:
//   · `necesidades.responsable` y `expedientes_oficinas.responsable_nombre`
//     guardan APELLIDOS primero ("ROJAS MAYTAN JUAN"), como el padrón.
//   · `profiles.nombre_completo` guarda NOMBRES primero ("JUAN ROJAS MAYTAN"),
//     como se firma.
//
// En la cabecera de un memorando se escribe como se firma, así que el orden
// natural es el que manda.

/** Quita tildes y colapsa espacios, para comparar sin depender de la grafía. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * "ROJAS MAYTAN JUAN" → "JUAN ROJAS MAYTAN".
 *
 * Convención peruana: los DOS primeros tokens son los apellidos (paterno y
 * materno) y el resto son los nombres. Con menos de tres palabras no hay nada
 * que reordenar —no se puede saber qué es qué— y se devuelve tal cual: es
 * preferible a inventar un orden en un documento que se firma.
 */
export function nombreEnOrdenNatural(nombre: string | null | undefined): string {
  const limpio = (nombre ?? "").replace(/\s+/g, " ").trim();
  if (!limpio) return "";
  // Un grado delante ("CPC. SAUL QUISPE CHIPANA") significa que el nombre YA
  // está escrito como se firma: quien lo tecleó así lo quería así. Reordenarlo
  // producía "QUISPE CHIPANA CPC. SAUL", que no es el nombre de nadie.
  if (/^\S{2,6}\.\s/.test(limpio)) return limpio;
  const partes = limpio.split(" ");
  if (partes.length < 3) return limpio;
  const apellidos = partes.slice(0, 2);
  const nombres = partes.slice(2);
  return [...nombres, ...apellidos].join(" ");
}

/**
 * ¿Los dos textos nombran a la misma persona, aunque el orden difiera?
 *
 * Se comparan como CONJUNTOS de palabras: es lo único estable entre los dos
 * órdenes que conviven en la base. Exige al menos dos palabras para no dar por
 * iguales dos personas que solo comparten el apellido.
 */
export function mismaPersona(a: string | null | undefined, b: string | null | undefined): boolean {
  const partes = (t: string | null | undefined) =>
    new Set(normalizar(t ?? "").split(" ").filter(Boolean));
  const sa = partes(a);
  const sb = partes(b);
  if (sa.size < 2 || sa.size !== sb.size) return false;
  for (const palabra of sa) if (!sb.has(palabra)) return false;
  return true;
}

/**
 * Firma de una persona: "CPC. JUAN ROJAS MAYTAN".
 *
 * El grado se escribe delante y se le añade el punto si no lo trae, que es como
 * se imprime en la cabecera de los documentos.
 */
export function conGradoAcademico(grado: string | null | undefined, nombre: string): string {
  const g = (grado ?? "").trim();
  const n = nombre.trim();
  if (!n) return "";
  if (!g) return n;
  const abreviatura = /[.)]$/.test(g) ? g : `${g}.`;
  return `${abreviatura} ${n}`;
}

export type Persona = { nombre: string; grado?: string; cargo?: string };

/**
 * Nombre para firmar: el del padrón de Usuarios si la persona está registrada,
 * y si no, el que se tenía puesto en orden natural.
 *
 * El emparejamiento evita reordenar a ciegas. Los nombres guardados en
 * `necesidades.responsable` son inconsistentes —conviven "CCAHUANA MENDOZA
 * NILDO" (padrón) y "ABEL HURTADO PALOMINO" (natural)—, así que darle la vuelta
 * a todos corrompería los segundos. Con un perfil que case, el orden y el grado
 * salen de un dato fiable; sin él, se aplica la convención como último recurso.
 */
export function nombreParaFirma(
  nombre: string | null | undefined,
  personas: Persona[] = [],
): string {
  const original = (nombre ?? "").trim();
  if (!original) return "";
  const persona = personas.find((p) => mismaPersona(p.nombre, original));
  if (persona) return conGradoAcademico(persona.grado, persona.nombre);
  return nombreEnOrdenNatural(original);
}
