// Modelo de los cursos de formación.
//
// El catálogo vive en código y no en la base: cambia con despliegues revisados, los tests lo recorren entero y un
// alumno externo no necesita permisos de lectura sobre tablas para verlo. Lo único que es dato del usuario —qué clases
// marcó como completadas— se guarda aparte (ver lib/cursos/progreso-server.ts).
// Módulo puro: sin red ni base de datos.
import type { SubcompetencyCode } from "@/lib/exam-curriculum";

/** «1» Actuaciones preparatorias · «2» Selección · «3» Ejecución contractual (temario oficial del examen). */
export type CompetenciaExamen = "1" | "2" | "3";

export type BaseLegal = { norma: "Ley 32069" | "Reglamento"; articulo: string };

/**
 * Caso tipo examen: el examen de certificación pregunta situaciones, no definiciones (el banco del simulador es casi
 * todo casuística). Cada caso aplica la regla de la clase a hechos concretos y se resuelve con su base legal.
 */
export type Casuistica = {
  /** Situación tipo examen: hechos concretos que piden decidir algo. */
  enunciado: string;
  /** Cómo se resuelve: la regla aplicada al caso, con la cifra o el plazo exacto. */
  resolucion: string;
  /** Artículos que sostienen la resolución. Se muestran como texto, sin enlace. */
  baseLegal: BaseLegal[];
};

export type VideoClase = { proveedor: "vimeo" | "youtube"; id: string; hash?: string };

export type ContenidoClase = {
  /** Bloques pregunta → párrafos, el formato de «Resumen» de una clase. */
  resumen: { pregunta: string; parrafos: string[] }[];
  puntosClave: string[];
  /** Casos tipo examen para ensayar la regla de la clase (pestaña «Casuística»). */
  casuisticas?: Casuistica[];
  baseLegal: BaseLegal[];
  /**
   * true solo cuando cada artículo, plazo y cifra del contenido se contrastó con el texto del corpus (Ley 32069 y
   * Reglamento). Una clase sin verificar se publica igual, pero marcada «En revisión»: el alumno estudia para un examen
   * y una cifra equivocada con aspecto de cita legal le hace más daño que un aviso.
   */
  verificada: boolean;
};

export type Clase = {
  slug: string;
  /** Numeral romano del módulo en el taller original; el alumno lo reconoce del examen. */
  modulo: string;
  /**
   * Subcompetencias del temario oficial del examen que trabaja la clase («1.2», «3.10»…). Vacío en los complementos.
   * Es lo que permite decir cuánto pesa la clase en el examen y comprobar que ningún tema oficial quede sin clase.
   */
  temas: SubcompetencyCode[];
  titulo: string;
  descripcion: string;
  /** Duración estimada de lectura, o del vídeo si lo hay. */
  minutos: number;
  /** Opcional: sin vídeo la clase se presenta en formato lectura. */
  video?: VideoClase;
  contenido: ContenidoClase;
};

export type PuntoControl = { titulo: string; href: string; descripcion: string };

export type Seccion = {
  slug: string;
  titulo: string;
  /**
   * Competencia del temario oficial del examen (lib/exam-curriculum.ts) que cubre la sección. Sin competencia es una
   * sección de complementos: material útil que el examen no evalúa como tema propio.
   */
  competencia?: CompetenciaExamen;
  clases: Clase[];
  /** Práctica en el simulador al cerrar la sección. Los complementos no la tienen. */
  puntoControl?: PuntoControl;
};

export type Curso = {
  slug: string;
  titulo: string;
  descripcion: string;
  nivel: "Básico" | "Intermedio" | "Avanzado";
  /** Fecha ISO (AAAA-MM-DD). */
  publicado: string;
  secciones: Seccion[];
  examenFinal: PuntoControl;
};
