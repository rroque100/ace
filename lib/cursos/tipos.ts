// Modelo de los cursos de formación.
//
// El catálogo vive en código y no en la base: cambia con despliegues revisados, los tests lo recorren entero y un
// alumno externo no necesita permisos de lectura sobre tablas para verlo. Lo único que es dato del usuario —qué clases
// marcó como completadas— se guarda aparte (ver lib/cursos/progreso-server.ts).
// Módulo puro: sin red ni base de datos.

export type BaseLegal = { norma: "Ley 32069" | "Reglamento"; articulo: string };

export type VideoClase = { proveedor: "vimeo" | "youtube"; id: string; hash?: string };

export type ContenidoClase = {
  /** Bloques pregunta → párrafos, el formato de «Resumen» de una clase. */
  resumen: { pregunta: string; parrafos: string[] }[];
  puntosClave: string[];
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
  titulo: string;
  descripcion: string;
  /** Duración estimada de lectura, o del vídeo si lo hay. */
  minutos: number;
  /** Opcional: sin vídeo la clase se presenta en formato lectura. */
  video?: VideoClase;
  contenido: ContenidoClase;
};

export type PuntoControl = { titulo: string; href: string; descripcion: string };

export type Seccion = { slug: string; titulo: string; clases: Clase[]; puntoControl: PuntoControl };

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
