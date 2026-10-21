// Construcción de la consulta PostgREST del listado de necesidades.
//
// Vive aparte del route handler por una razón concreta: los filtros se venían
// construyendo como `status.eq.borrador` —con PUNTO— y se unían con "&". La
// sintaxis de PostgREST es `status=eq.borrador`, con IGUAL: sin él, el trozo
// llega como un parámetro sin valor y el servidor lo ignora sin quejarse. El
// resultado era que ningún filtro filtraba y la lista salía completa siempre,
// que es un fallo que no levanta ningún error y no se nota mirando el código.
//
// Aquí es una función pura, así que un test puede mirar la cadena que sale.

export type FiltrosNecesidades = {
  search?: string;
  status?: string;
  /** Varios estados a la vez (bandeja "lo que me toca"). Tiene prioridad sobre
   *  `status`. Los estados son claves sin caracteres especiales, así que van
   *  directos en `in.(…)`. */
  statusIn?: string[];
  tipoObjeto?: string;
  tipoProceso?: string;
  meta?: string;
  oficina?: string;
  responsable?: string;
  /** Portafolio: "por vencer" (fecha requerida <= esta fecha, ISO aaaa-mm-dd). */
  fechaRequeridaHasta?: string;
  /** Portafolio: "estancadas" (sin cambios desde antes de este timestamp ISO). */
  updatedAntesDe?: string;
  /**
   * Fragmento `order=` de PostgREST ya validado por el llamador (p. ej.
   * `monto_estimado.desc.nullslast`). NUNCA es texto libre del cliente: el route
   * lo deriva de una clave del catálogo con `ordenPostgrest`. Ausente → recientes.
   */
  orden?: string;
  limit: number;
  offset: number;
  select: string;
};

/**
 * Limpia el término de búsqueda de lo que rompe la sintaxis de PostgREST.
 *
 * Dentro de `or=(a.ilike.*x*,b.ilike.*x*)` la coma separa condiciones y los
 * paréntesis delimitan el grupo, así que un usuario que busque "servicio (2026)"
 * partiría la expresión y provocaría un 400. Las comillas dobles delimitan
 * valores y la barra invertida escapa. Se quitan en vez de escaparse porque
 * ninguno de esos caracteres distingue un nombre de necesidad de otro.
 */
export function limpiarBusqueda(valor: string): string {
  return (valor ?? "").replace(/[(),"\\]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Filtro de igualdad, con el valor codificado.
 *
 * Los valores llevan espacios y acentos ("Licitación Pública Abreviada para
 * Bienes"), así que hay que codificarlos; el operador `eq.` NO, porque el punto
 * es parte de la sintaxis y codificarlo lo convertiría en texto literal.
 */
function igual(columna: string, valor: string): string {
  // NADA de entrecomillar. Es tentador —la documentación manda entrecomillar los
  // valores con `,` `.` `:` `(` `)`— pero esa regla es para las LISTAS `in.(…)` y
  // para el interior de un árbol `or=(…)`, donde esos caracteres son delimitadores
  // de verdad. En un filtro simple de primer nivel las comillas NO se despojan:
  // pasan a formar parte del literal y la comparación no encuentra nada.
  //
  // Comprobado contra la base real: con el nombre de una oficina existente,
  // `area_usuaria=eq."GERENCIA…"` devuelve 0 filas y `area_usuaria=eq.GERENCIA…`
  // devuelve 1. Y un nombre con comas y dos puntos también casa sin comillas.
  //
  // Basta con codificar el valor: la `%2C` se decodifica DESPUÉS de partir los
  // parámetros por "&", así que una coma dentro del valor no separa nada.
  return `${columna}=eq.${encodeURIComponent(valor)}`;
}

export function construirQueryNecesidades(f: FiltrosNecesidades): string {
  const partes = [
    `select=${f.select}`,
    `order=${f.orden?.trim() || "created_at.desc"}`,
    `limit=${f.limit}`,
    `offset=${f.offset}`,
  ];

  const search = limpiarBusqueda(f.search ?? "");
  if (search) {
    // `%` y `_` son comodines de ilike: sin escaparlos, buscar "50%" traería
    // todo lo que empiece por 50 y buscar "a_b" cualquier cosa con "a?b".
    const literal = search.replace(/[%_\\]/g, (m) => `\\${m}`);
    const patron = encodeURIComponent(`*${literal}*`);
    partes.push(
      `or=(nombre.ilike.${patron},codigo.ilike.${patron},area_usuaria.ilike.${patron})`,
    );
  }
  const estadosLista = (f.statusIn ?? []).map((s) => s.trim()).filter(Boolean);
  if (estadosLista.length > 0) partes.push(`status=in.(${estadosLista.join(",")})`);
  else if (f.status?.trim()) partes.push(igual("status", f.status.trim()));
  if (f.tipoObjeto?.trim()) partes.push(igual("tipo_objeto", f.tipoObjeto.trim()));
  if (f.tipoProceso?.trim()) partes.push(igual("tipo_proceso_seleccion", f.tipoProceso.trim()));
  if (f.meta?.trim()) partes.push(igual("meta_presupuestal", f.meta.trim()));
  if (f.oficina?.trim()) partes.push(igual("area_usuaria", f.oficina.trim()));
  if (f.responsable?.trim()) partes.push(igual("responsable", f.responsable.trim()));
  // Portafolio (E2): fechas en formato fijo (ISO), sin caracteres a codificar.
  if (f.fechaRequeridaHasta?.trim()) partes.push(`fecha_requerida=lte.${f.fechaRequeridaHasta.trim()}`);
  if (f.updatedAntesDe?.trim()) partes.push(`updated_at=lt.${encodeURIComponent(f.updatedAntesDe.trim())}`);

  return partes.join("&");
}
