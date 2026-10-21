/**
 * Una sola petición de feriados para toda la pantalla.
 *
 * `useFeriados` pedía `/api/configuracion/feriados` una vez POR CADA componente
 * que lo usara. En el detalle del expediente hay TRES `FasePanel` a la vez
 * (F1/F2/F3), así que el mismo array de feriados se pedía tres veces en paralelo
 * al abrir. Es el mismo problema —y la misma solución— que `settings-catalog-cache`.
 *
 * La caché vive FUERA de React a propósito: el problema es entre instancias, y un
 * `useRef` o un estado no lo resuelven porque cada componente tiene el suyo.
 *
 * Se guarda la PROMESA, no el resultado: dos componentes que montan en el mismo
 * tick comparten la petición en vuelo. Una vez resuelta, se conserva y las
 * siguientes llamadas la reutilizan sin volver a la red, hasta que alguien
 * `olvidarFeriados()` (al guardar cambios en la pestaña de Feriados).
 */

/** Promesa en vuelo o ya resuelta. `null` cuando no hay nada que reutilizar. */
let enCurso: Promise<unknown> | null = null;

/**
 * Trae los feriados, reutilizando la petición si ya hay una. Devuelve el valor
 * crudo de `feriados` del payload; el llamante lo pasa por `parseFeriados`.
 *
 * `hacerFetch` se inyecta para poder probar esto sin navegador.
 */
export function cargarFeriados(
  hacerFetch: () => Promise<Response> = () => fetch("/api/configuracion/feriados", { cache: "no-store" }),
): Promise<unknown> {
  if (enCurso) return enCurso;
  const promesa = (async () => {
    const respuesta = await hacerFetch();
    if (!respuesta.ok) throw new Error(`feriados: ${respuesta.status}`);
    const datos = await respuesta.json();
    return datos.feriados;
  })();
  // Un fallo NO se cachea: dejaría la pantalla sin feriados hasta recargar, y el
  // fallo típico es una red que va y viene. Se limpia y el siguiente reintenta.
  promesa.catch(() => {
    if (enCurso === promesa) enCurso = null;
  });
  enCurso = promesa;
  return promesa;
}

/**
 * Olvida lo cargado para que la próxima llamada lo pida de nuevo. Lo necesita la
 * pestaña de Feriados: al guardar, el array en memoria deja de ser cierto.
 */
export function olvidarFeriados() {
  enCurso = null;
}
