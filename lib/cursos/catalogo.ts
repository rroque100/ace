// Registro de cursos y las reglas puras para recorrerlos (orden, numeración, vecinas, avance).
// Módulo puro: sin red ni base de datos, para que las páginas y la API compartan las mismas respuestas.
import { CERTIFICACION_OECE } from "./certificacion-oece";
import { preguntasCompetencia } from "./temario-examen";
import type { BaseLegal, Clase, Curso, Seccion } from "./tipos";

export const CURSOS: readonly Curso[] = [CERTIFICACION_OECE];

export const buscarCurso = (slug: string): Curso | null => CURSOS.find((c) => c.slug === slug) ?? null;

export const clasesEnOrden = (curso: Curso): Clase[] => curso.secciones.flatMap((s) => s.clases);

/** La numeración es correlativa en todo el curso (no reinicia por sección), como «Clase 4 de 18». */
export function buscarClase(curso: Curso, slug: string): { clase: Clase; seccion: Seccion; numero: number } | null {
  let numero = 0;
  for (const seccion of curso.secciones) {
    for (const clase of seccion.clases) {
      numero += 1;
      if (clase.slug === slug) return { clase, seccion, numero };
    }
  }
  return null;
}

export function vecinas(curso: Curso, slug: string): { anterior: Clase | null; siguiente: Clase | null } {
  const clases = clasesEnOrden(curso);
  const i = clases.findIndex((c) => c.slug === slug);
  if (i < 0) return { anterior: null, siguiente: null };
  return { anterior: clases[i - 1] ?? null, siguiente: clases[i + 1] ?? null };
}

/** Solo cuenta las clases del curso: un slug guardado de una clase que ya no existe no infla el avance. */
export function avance(curso: Curso, completadas: ReadonlySet<string>) {
  const clases = clasesEnOrden(curso);
  const hechas = clases.filter((c) => completadas.has(c.slug)).length;
  return { hechas, total: clases.length, porcentaje: clases.length ? Math.round((hechas / clases.length) * 100) : 0 };
}

/** Por dónde seguir: la primera clase sin completar, o la primera si ya están todas. */
export function claseParaSeguir(curso: Curso, completadas: ReadonlySet<string>): Clase {
  const clases = clasesEnOrden(curso);
  return clases.find((c) => !completadas.has(c.slug)) ?? clases[0];
}

export type EstadoClase = "actual" | "completada" | "pendiente";

/** La clase abierta manda sobre «completada»: en la lista se ve «Viendo ahora», como en la referencia. */
export function estadoClase(slug: string, completadas: ReadonlySet<string>, actual?: string): EstadoClase {
  if (slug === actual) return "actual";
  return completadas.has(slug) ? "completada" : "pendiente";
}

/**
 * Lo que necesita el panel «Progreso del curso», ya serializable para un componente de cliente: secciones con sus
 * clases numeradas, el estado de cada una y el avance. Se calcula en el servidor para que el cliente no reciba el
 * catálogo entero (los resúmenes pesan y no hacen falta para listar).
 */
export function vistaProgreso(curso: Curso, completadas: ReadonlySet<string>, actual?: string) {
  let numero = 0;
  return {
    ...avance(curso, completadas),
    secciones: curso.secciones.map((s) => ({
      slug: s.slug,
      titulo: s.titulo,
      /** Preguntas de la competencia en el examen; null en los complementos. */
      preguntas: s.competencia ? preguntasCompetencia(s.competencia) : null,
      hechas: s.clases.filter((c) => completadas.has(c.slug)).length,
      clases: s.clases.map((c) => ({
        slug: c.slug,
        modulo: c.modulo,
        titulo: c.titulo,
        minutos: c.minutos,
        numero: ++numero,
        estado: estadoClase(c.slug, completadas, actual),
      })),
    })),
  };
}

export type VistaProgreso = ReturnType<typeof vistaProgreso>;

export const duracionTotal = (curso: Curso) => clasesEnOrden(curso).reduce((t, c) => t + c.minutos, 0);

export function formatoDuracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// Documentos del corpus con el texto vigente que se usó para verificar el contenido: la Ley 32069 actualizada al
// 19.07.2026 y el Reglamento actualizado al 09.01.2026. El enlace abre el lector de normas en ese artículo.
const DOCUMENTO_NORMA: Record<BaseLegal["norma"], string> = {
  "Ley 32069": "dc721f35-138c-41b8-8dca-16289f74d9df",
  Reglamento: "8371bce1-f773-4ad8-8efa-1266276ae4ec",
};

export const hrefBaseLegal = (base: BaseLegal) =>
  `/normas?documentId=${DOCUMENTO_NORMA[base.norma]}&article=${encodeURIComponent(base.articulo)}`;

// El corpus etiqueta las disposiciones complementarias como «DCT-1», «DCF-3»…: se nombran en palabras para el alumno.
const DISPOSICIONES: Record<string, string> = { DCF: "Final", DCT: "Transitoria", DCM: "Modificatoria", DCD: "Derogatoria" };
const ORDINALES = ["", "Primera", "Segunda", "Tercera", "Cuarta", "Quinta", "Sexta", "Séptima", "Octava", "Novena", "Décima"];

export function textoBaseLegal(base: BaseLegal): string {
  const norma = base.norma === "Reglamento" ? "Reglamento de la Ley 32069" : "Ley 32069";
  const disposicion = /^(DC[FTMD])-(\d+)$/.exec(base.articulo);
  if (disposicion && ORDINALES[Number(disposicion[2])]) {
    return `${norma} · ${ORDINALES[Number(disposicion[2])]} Disposición Complementaria ${DISPOSICIONES[disposicion[1]]}`;
  }
  return `${norma} · Art. ${base.articulo}`;
}
