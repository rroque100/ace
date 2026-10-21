import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Un campo de la ficha que no esté en el `select=` de PostgREST llega como
 * `undefined` y no falla nada: el campo sale vacío en la página y nadie sabe
 * por qué. Pasó con `cui` recién añadido, y antes con COLUMNAS_SEED.
 */
// `[id]/ficha/route.ts` estaba en esta lista y se retiró con el exportador de
// la Ficha de Necesidad: no era un formato exigido por la Ley 32069 ni por su
// Reglamento.
const RUTAS = [
  "app/api/necesidades/[id]/route.ts",
  "app/api/necesidades/route.ts",
];

describe("los SELECT de la API traen los campos que la ficha muestra", () => {
  it("cui está en todos los select que traen proyecto_inversion", () => {
    // Van juntos: el CUI es el número del proyecto y proyecto_inversion su
    // nombre. Si una ruta trae uno y no el otro, la ficha sale coja.
    for (const ruta of RUTAS) {
      const src = readFileSync(ruta, "utf8");
      if (!src.includes("proyecto_inversion")) continue;
      expect(src.includes("cui,") || src.includes(",cui"), `${ruta} no selecciona cui`).toBe(true);
    }
  });

  it("al menos una ruta selecciona el CUI", () => {
    // Guarda contra el caso de que el filtro de arriba no encuentre nada y el
    // test pase por vacío.
    const alguna = RUTAS.some((r) => readFileSync(r, "utf8").includes("cui"));
    expect(alguna).toBe(true);
  });
});

/**
 * El PATCH y el POST mapean campo por campo A MANO. Un campo nuevo que no se
 * añada ahí se rellena en el formulario, se guarda "con éxito"… y nunca llega a
 * la columna. Pasó con `cui`: la ficha lo mostraba en edición y la vista salía
 * con "—", porque el valor no se persistía.
 */
describe("los campos de la ficha llegan a la columna", () => {
  const RUTA_PATCH = "app/api/necesidades/[id]/route.ts";
  const RUTA_POST = "app/api/necesidades/route.ts";

  it("el PATCH deriva las columnas del schema (ya no las mapea a mano)", () => {
    // El mapeo manual era donde cui/nombre/year se perdían. Ahora se deriva:
    // la garantía de que cui llega a su columna vive en necesidad-columnas.test.
    expect(readFileSync(RUTA_PATCH, "utf8")).toContain("construirColumnas(data)");
  });

  it("el POST deriva las columnas del schema (ya no las mapea a mano)", () => {
    expect(readFileSync(RUTA_POST, "utf8")).toContain("construirColumnas(data)");
  });

  it("cui viaja junto a proyecto_inversion en las dos rutas", () => {
    // Son el número y el nombre del mismo proyecto: si una ruta persiste uno y
    // no el otro, la ficha sale coja.
    for (const ruta of [RUTA_PATCH, RUTA_POST]) {
      const src = readFileSync(ruta, "utf8");
      // Ya no se mapea a mano: se deriva. cui viaja porque está en el schema
      // (garantizado en necesidad-columnas.test), no por una línea literal.
      expect(src.includes("construirColumnas"), `${ruta} no deriva las columnas`).toBe(true);
    }
  });
});
