// Comentarios de las clases: reglas puras (hilos, orden, validación, nombre visible y «hace cuánto»).
// Módulo puro: sin red ni base de datos; lo comparten la API, la página y los tests.

export const MAX_TEXTO_COMENTARIO = 2000;

/** Fila tal como sale de la base (curso_comentarios + sus «me gusta»). */
export type FilaComentario = {
  id: string;
  user_id: string;
  autor: string;
  texto: string;
  padre_id: string | null;
  created_at: string;
  curso_comentario_likes?: { user_id: string }[] | null;
};

/**
 * Lo que recibe el navegador. Sin user_id: el cliente solo necesita saber si el comentario es suyo (para ofrecer
 * borrarlo) y si le dio «me gusta»; no hay por qué repartir los identificadores de las demás cuentas.
 */
export type Comentario = {
  id: string;
  autor: string;
  texto: string;
  creado: string;
  meGusta: number;
  leGusta: boolean;
  propio: boolean;
  /** El autor o un administrador (moderación). */
  puedeBorrar: boolean;
};

export type Hilo = Comentario & { respuestas: Comentario[] };

export type OrdenComentarios = "recientes" | "populares";

/** Una fila suelta, sea comentario raíz o respuesta (lo que devuelve la API al crear). */
export function comentarioDeFila(f: FilaComentario, userId: string, isAdmin: boolean): Comentario {
  return aComentario(f, userId, isAdmin);
}

function aComentario(f: FilaComentario, userId: string, isAdmin: boolean): Comentario {
  const likes = f.curso_comentario_likes ?? [];
  const propio = f.user_id === userId;
  return {
    id: f.id,
    autor: f.autor,
    texto: f.texto,
    creado: f.created_at,
    meGusta: likes.length,
    leGusta: likes.some((l) => l.user_id === userId),
    propio,
    puedeBorrar: propio || isAdmin,
  };
}

/**
 * Agrupa en hilos de un solo nivel, como en la referencia: comentario y sus respuestas, estas en orden cronológico.
 * Una respuesta cuyo padre ya no está (borrado) no se muestra suelta: el borrado en cascada ya las elimina, y si
 * llegara alguna huérfana por una carrera, sacarla de contexto confundiría más que ocultarla.
 */
export function armarHilos(filas: readonly FilaComentario[], userId: string, isAdmin: boolean): Hilo[] {
  const raiz = filas.filter((f) => !f.padre_id);
  const ids = new Set(raiz.map((f) => f.id));
  const respuestas = new Map<string, Comentario[]>();
  for (const f of filas) {
    if (!f.padre_id || !ids.has(f.padre_id)) continue;
    const lista = respuestas.get(f.padre_id) ?? [];
    lista.push(aComentario(f, userId, isAdmin));
    respuestas.set(f.padre_id, lista);
  }
  return raiz.map((f) => ({
    ...aComentario(f, userId, isAdmin),
    respuestas: (respuestas.get(f.id) ?? []).sort((a, b) => a.creado.localeCompare(b.creado)),
  }));
}

/** Más recientes primero, o más votados (empate: el más reciente). No muta la lista recibida. */
export function ordenarHilos(hilos: readonly Hilo[], orden: OrdenComentarios): Hilo[] {
  const porFecha = (a: Hilo, b: Hilo) => b.creado.localeCompare(a.creado);
  return [...hilos].sort(orden === "populares" ? (a, b) => b.meGusta - a.meGusta || porFecha(a, b) : porFecha);
}

export const totalComentarios = (hilos: readonly Hilo[]) => hilos.reduce((n, h) => n + 1 + h.respuestas.length, 0);

/** Texto listo para guardar, o el motivo por el que no se acepta. */
export function validarTexto(texto: unknown): { ok: true; texto: string } | { ok: false; error: string } {
  if (typeof texto !== "string") return { ok: false, error: "Escribe un comentario." };
  // Se recortan los extremos y se colapsan las líneas en blanco repetidas; el resto del formato se respeta.
  const limpio = texto.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!limpio) return { ok: false, error: "Escribe un comentario." };
  if (limpio.length > MAX_TEXTO_COMENTARIO) {
    return { ok: false, error: `El comentario no puede pasar de ${MAX_TEXTO_COMENTARIO} caracteres.` };
  }
  return { ok: true, texto: limpio };
}

/**
 * Nombre con el que se firma un comentario. Sale del perfil, nunca del correo ni del DNI: las cuentas se identifican
 * por DNI y ese dato no se publica a otros alumnos. Sin nombre registrado, «Participante».
 */
export function nombreVisible(nombreCompleto: string | null | undefined): string {
  const limpio = (nombreCompleto ?? "").replace(/\s+/g, " ").trim();
  if (!limpio || /^\d+$/.test(limpio) || limpio.includes("@")) return "Participante";
  return limpio.slice(0, 80);
}

export function iniciales(nombre: string): string {
  const partes = nombre.split(" ").filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase() || "?";
}

/** «Hace un momento», «Hace 5 min», «Hace 3 h», «Hace 2 días», «Hace 4 meses», «Hace 1 año». */
export function haceCuanto(fechaIso: string, ahora: number): string {
  const seg = Math.max(0, Math.floor((ahora - Date.parse(fechaIso)) / 1000));
  if (seg < 60) return "Hace un momento";
  const min = Math.floor(seg / 60);
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias < 30) return dias === 1 ? "Hace un día" : `Hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return meses === 1 ? "Hace un mes" : `Hace ${meses} meses`;
  const anios = Math.floor(dias / 365);
  return anios <= 1 ? "Hace un año" : `Hace ${anios} años`;
}
