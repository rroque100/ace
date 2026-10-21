import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { columnasSelect } from "@/lib/necesidad-columnas";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";

/**
 * Toda columna de la ficha tiene que poder LEERSE de vuelta.
 *
 * Bug real: el GET de `necesidades/[id]` tenía una lista fija de columnas escrita
 * a mano. Se añadía una columna a la ficha, se guardaba bien —el patch deriva la
 * columna del nombre—, pero al recargar volvía vacía porque el SELECT no la
 * pedía. Le pasó a las trece de una tanda entera (forma de pago, plazos de
 * conformidad, personal clave) y parecía que «no guardaba».
 *
 * Ahora el SELECT se deriva del esquema. Estas pruebas lo blindan: si una
 * columna de ficha no está en `columnasSelect`, o el route vuelve a fijar la
 * lista a mano, saltan.
 */
describe("todas las columnas de la ficha se pueden leer", () => {
  const cols = columnasSelect();

  it("cada campo de la ficha (incluidos los ocultos) está en el SELECT derivado", () => {
    const faltan: string[] = [];
    for (const s of FICHA_SECCIONES) {
      for (const f of s.fields) {
        // La columna se deriva del api en camelCase → snake_case, igual que en
        // el patch. Los checkbox también son columnas reales.
        const col = f.col as string;
        if (!cols.includes(col)) faltan.push(`${f.api} → ${col}`);
      }
    }
    expect(faltan, `columnas de ficha ausentes de columnasSelect: ${faltan.join(", ")}`).toEqual([]);
  });

  it("las columnas de esta tanda están: por eso se dejaban de leer", () => {
    for (const col of [
      "forma_pago_detalle",
      "conformidad_plazo",
      "conformidad_plazo_subsanacion",
      "plazo_respuestas_texto",
      "personal_clave_experiencia",
    ]) {
      expect(cols, col).toContain(col);
    }
  });

  it("el route deriva el SELECT del esquema, no lo fija a mano", () => {
    const src = readFileSync("app/api/necesidades/[id]/route.ts", "utf-8");
    expect(src).toContain("columnasSelect()");
    // Y no ha vuelto a la lista fija de ~90 columnas: una pista es que ya no
    // enumera `descripcion_detallada` dentro de una cadena literal del SELECT.
    expect(src).not.toMatch(/const SELECT\s*=\s*\n?\s*"id,codigo,/);
  });
});
