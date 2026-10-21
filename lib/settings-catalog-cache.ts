/**
 * Una sola petición del catálogo de configuración para toda la pantalla.
 *
 * `useSettingsCatalog` pedía `/api/settings/catalog` una vez POR CADA componente
 * que lo usara. Son trece, y en la ficha de necesidad coinciden dos a la vez —el
 * detalle y el formulario—, así que el mismo catálogo se pedía dos veces en
 * paralelo. Y al navegar entre pantallas se volvía a pedir entero.
 *
 * La caché vive FUERA de React a propósito: el problema es entre instancias, y
 * un `useRef` o un estado no lo resuelven porque cada componente tiene el suyo.
 *
 * Lo que se guarda es la PROMESA, no el resultado. Así dos componentes que
 * montan en el mismo tick comparten la petición en vuelo en vez de lanzar dos y
 * quedarse con la que llegue antes.
 */

/** Promesa en vuelo o ya resuelta. `null` cuando no hay nada que reutilizar. */
let enCurso: Promise<unknown> | null = null;

/**
 * Trae el catálogo, reutilizando la petición si ya hay una.
 *
 * `hacerFetch` se inyecta para poder probar esto sin navegador; en la aplicación
 * se usa el `fetch` global.
 */
export function cargarCatalogo<T>(
  hacerFetch: () => Promise<Response> = () => fetch("/api/settings/catalog", { cache: "no-store" }),
): Promise<T> {
  if (enCurso) return enCurso as Promise<T>;
  const promesa = (async () => {
    const respuesta = await hacerFetch();
    if (!respuesta.ok) throw new Error(`catálogo: ${respuesta.status}`);
    return respuesta.json();
  })();
  // Un fallo NO se cachea: dejaría la aplicación sin catálogo hasta recargar, y
  // el fallo típico aquí es una red que va y viene. Se limpia y el siguiente
  // que pregunte vuelve a intentarlo.
  promesa.catch(() => {
    if (enCurso === promesa) enCurso = null;
  });
  enCurso = promesa;
  return promesa as Promise<T>;
}

/**
 * Olvida lo cargado para que la próxima llamada lo pida de nuevo.
 *
 * Lo necesita Configuración: al guardar la entidad o los procedimientos, el
 * catálogo que hay en memoria deja de ser cierto.
 */
export function olvidarCatalogo() {
  enCurso = null;
}
