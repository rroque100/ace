// Ruta canónica de los cursos: todo en minúscula.
//
// El enlace que circula entre los alumnos es «/Cursos». En Windows funciona porque el sistema de ficheros no distingue
// mayúsculas, pero en Netlify (Linux) daría 404. No se puede resolver con `redirects()` de next.config: Next compara
// ahí sin distinguir mayúsculas, así que «/cursos» también casaba con la regla y se redirigía a sí misma en bucle.
// Por eso la comprobación es exacta y la aplica el proxy (proxy.ts).
// Módulo puro: sin red ni base de datos.

/** La ruta en minúscula si es de cursos y trae mayúsculas; null si ya es canónica o no es de cursos. */
export function rutaCanonicaCursos(pathname: string): string | null {
  if (!/^\/cursos(?:\/|$)/i.test(pathname)) return null;
  const canonica = pathname.toLowerCase();
  return canonica === pathname ? null : canonica;
}
