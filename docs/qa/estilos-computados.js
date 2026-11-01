// Compara los estilos CALCULADOS de una pantalla antes y después de migrarla a Tailwind.
//
// Una migración de CSS propio a utilidades no debe cambiar ni un píxel: el DOM es el mismo y solo cambian los
// nombres de clase. Así que se guardan, elemento a elemento, las propiedades que pintan y colocan (display,
// márgenes, colores, tamaños…) y luego se vuelven a medir y se enseñan solo las diferencias.
//
// Uso (en la consola del navegador, con el código SIN migrar):
//   __estilos.guardar("busqueda-claro-1280", "main")      → guarda la medición en localStorage
// Tras migrar y recargar:
//   __estilos.comparar("busqueda-claro-1280", "main")     → { iguales, diferencias: [...] }
//
// Un elemento se identifica por su posición dentro del contenedor, por eso solo vale mientras no se añadan ni
// quiten elementos del DOM. Las medidas de tamaño toleran 1 px de redondeo.
(() => {
  const PROPS = [
    "display", "position", "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis", "align-items",
    "align-self", "justify-content", "justify-self", "gap", "grid-template-columns", "grid-column", "padding-top",
    "padding-right", "padding-bottom", "padding-left", "margin-top", "margin-right", "margin-bottom", "margin-left",
    "border-top-width", "border-right-width", "border-bottom-width", "border-left-width", "border-top-style",
    "border-top-color", "border-bottom-color", "border-left-color", "border-right-color", "border-top-left-radius",
    "background-color", "color", "font-size", "font-weight", "font-style", "line-height", "letter-spacing",
    "text-align", "text-transform", "text-decoration-line", "white-space", "overflow-x", "overflow-y", "opacity",
    "box-shadow", "min-height", "min-width", "max-width", "max-height", "cursor", "z-index", "top", "left", "right",
    "bottom", "visibility", "list-style-type", "text-overflow", "word-break", "overflow-wrap", "transform",
  ];
  const medir = (raiz) => {
    const contenedor = typeof raiz === "string" ? document.querySelector(raiz) : raiz;
    if (!contenedor) throw new Error("No existe el contenedor " + raiz);
    // Se excluyen listas que cambian con los datos del usuario (el historial de consultas crece con cada búsqueda).
    const EXCLUIR = ".legalWorkspaceHistory";
    return [...contenedor.querySelectorAll("*")].filter((e) => !e.closest(EXCLUIR)).map((e) => {
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      const o = { _: e.tagName.toLowerCase() + "|" + (e.textContent || "").trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) };
      for (const p of PROPS) o[p] = cs.getPropertyValue(p);
      return o;
    });
  };
  window.__estilos = {
    guardar(clave, raiz) {
      const datos = medir(raiz);
      localStorage.setItem("qa-estilos:" + clave, JSON.stringify(datos));
      return datos.length + " elementos guardados en " + clave;
    },
    comparar(clave, raiz) {
      const antes = JSON.parse(localStorage.getItem("qa-estilos:" + clave) || "null");
      if (!antes) throw new Error("No hay medición guardada para " + clave);
      const despues = medir(raiz);
      if (antes.length !== despues.length) return { iguales: false, error: `El DOM cambió: ${antes.length} → ${despues.length} elementos` };
      const diferencias = [];
      antes.forEach((a, i) => {
        const b = despues[i];
        const cambios = [];
        if (a._ !== b._) cambios.push(`elemento ${a._} → ${b._}`);
        for (const k of ["w", "h"]) if (Math.abs(a[k] - b[k]) > 1) cambios.push(`${k}: ${a[k]} → ${b[k]}`);
        for (const p of PROPS) if (a[p] !== b[p]) cambios.push(`${p}: ${a[p]} → ${b[p]}`);
        if (cambios.length) diferencias.push({ i, el: a._, cambios: cambios.slice(0, 6) });
      });
      return { iguales: diferencias.length === 0, elementos: despues.length, conDiferencias: diferencias.length, diferencias: diferencias.slice(0, 25) };
    },
  };
  return "listo: __estilos.guardar / __estilos.comparar";
})();
