/**
 * Cableado de una lista de pestañas accesible.
 *
 * En la aplicación había 35 controles marcados como `role="tab"` y solo 3 con
 * `aria-controls`. Un lector de pantalla anunciaba "pestaña, seleccionada" sin
 * decir qué panel gobernaba, y no había forma de llegar al contenido.
 *
 * Una lista de pestañas de verdad exige cuatro cosas, y las tres primeras son
 * puro identificador:
 *
 *   1. cada pestaña apunta a su panel con `aria-controls`
 *   2. el panel apunta de vuelta con `aria-labelledby`
 *   3. solo la pestaña activa es alcanzable con el tabulador (índice móvil):
 *      el tabulador entra en la lista y sale al panel, no recorre pestaña a
 *      pestaña
 *   4. dentro de la lista se navega con las flechas
 *
 * **Se asume que solo se monta el panel activo**, que es como están escritas
 * todas las pestañas de esta aplicación (`{tab === "x" ? <Panel/> : null}`).
 * Por eso hay UN panel en el DOM y todas las pestañas lo señalan: así ningún
 * `aria-controls` queda apuntando a un identificador que no existe. El panel
 * declara a cuál de ellas pertenece en cada momento con `aria-labelledby`.
 *
 * Si un grupo de botones no tiene panel asociado, no es una lista de pestañas y
 * no debe usar esto: será un grupo de filtros (`role="group"` + `aria-pressed`).
 */

/** Atributos de una pestaña. `base` distingue unas listas de otras en la página. */
export function propsPestana(base: string, valor: string, activo: string) {
  const seleccionada = valor === activo;
  return {
    role: "tab" as const,
    id: idPestana(base, valor),
    "aria-selected": seleccionada,
    "aria-controls": idPanel(base),
    // Índice móvil: fuera de la pestaña activa, el tabulador no entra.
    tabIndex: seleccionada ? 0 : -1,
  };
}

/** Atributos del panel. `activo` es la pestaña a la que pertenece ahora mismo. */
export function propsPanel(base: string, activo: string) {
  return {
    role: "tabpanel" as const,
    id: idPanel(base),
    "aria-labelledby": idPestana(base, activo),
    // El panel recibe el foco al salir de la lista, para poder leerlo de
    // seguido aunque su primer elemento no sea enfocable.
    tabIndex: 0,
  };
}

export function idPestana(base: string, valor: string): string {
  return `${base}-pest-${valor}`;
}

export function idPanel(base: string): string {
  return `${base}-panel`;
}

/**
 * Qué pestaña toca según la tecla, o `null` si la tecla no es de navegación y
 * debe seguir su curso.
 *
 * Las flechas dan la vuelta al llegar al extremo, que es lo que espera quien
 * navega así: no hay pared al final de la lista.
 */
export function siguientePestana(
  valores: readonly string[],
  activo: string,
  tecla: string,
): string | null {
  if (valores.length === 0) return null;
  const i = valores.indexOf(activo);
  // Si la activa no está en la lista (p. ej. una pestaña que dejó de mostrarse
  // por permisos), cualquier navegación empieza por la primera.
  if (i === -1) return valores[0] ?? null;

  switch (tecla) {
    case "ArrowRight":
    case "ArrowDown":
      return valores[(i + 1) % valores.length] ?? null;
    case "ArrowLeft":
    case "ArrowUp":
      return valores[(i - 1 + valores.length) % valores.length] ?? null;
    case "Home":
      return valores[0] ?? null;
    case "End":
      return valores[valores.length - 1] ?? null;
    default:
      return null;
  }
}
