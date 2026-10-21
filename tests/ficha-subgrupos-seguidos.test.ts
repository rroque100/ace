import { describe, expect, it } from "vitest";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";

/**
 * Los campos de un subgrupo tienen que ir SEGUIDOS en el catálogo.
 *
 * El formulario agrupa recorriendo la lista de campos en orden: cuando cambia el
 * `subgrupo`, pinta una cabecera nueva con `key={`sub-${subgrupo}`}`. Si el
 * mismo nombre reaparece más abajo, salen DOS cabeceras con la misma clave y
 * React avisa —«Encountered two children with the same key»— de que puede
 * duplicar u omitir hijos.
 *
 * Pasó de verdad: al sacar «Recepción y conformidad (Art. 144)» a su propio
 * subgrupo quedó metido entre «Garantías» y «Gestión de riesgos», que son los
 * dos de «Otras condiciones del contrato». La consola lo repetía en cada
 * repintado y el bloque partido se veía en pantalla.
 *
 * Se comprueba en las nueve secciones y no solo en la que falló: reordenar
 * campos es de las cosas que más se hacen aquí.
 */
describe("cada subgrupo aparece en un solo tramo", () => {
  for (const seccion of FICHA_SECCIONES) {
    it(`«${seccion.title}» no parte ninguno en dos`, () => {
      const tramos: string[] = [];
      let previo: string | undefined;
      for (const f of seccion.fields) {
        const actual = f.subgrupo ?? "";
        if (actual !== previo) tramos.push(actual);
        previo = actual;
      }
      const repetidos = tramos.filter((g, i) => g && tramos.indexOf(g) !== i);
      expect(
        [...new Set(repetidos)],
        "un subgrupo que reaparece más abajo pinta dos cabeceras con la misma clave de React",
      ).toEqual([]);
    });
  }
});
