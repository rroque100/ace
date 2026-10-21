import { describe, expect, it } from "vitest";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";
import { necesidadUpdateSchema } from "@/lib/necesidades";

/**
 * ¿Todo lo que la ficha de la Necesidad deja escribir llega a Supabase?
 *
 * La cadena tiene tres eslabones y solo dos están tipados:
 *
 *   formulario → `api` (string suelto) → zod del PATCH → columna
 *                 ▲ NADA lo comprueba
 *
 * `col` sí está atado a `keyof Necesidad`, así que TypeScript lo verifica. Pero
 * `api` es un `string`: si un campo de la ficha usa una clave que el esquema del
 * PATCH no declara, **zod la descarta sin decir nada** y el usuario ve su texto
 * en pantalla (lo restaura el borrador de localStorage) creyendo que quedó
 * registrado. Ya pasó una vez con los requisitos de calificación.
 *
 * Este test convierte ese silencio en un fallo de tests.
 */
const CAMPOS = FICHA_SECCIONES.flatMap((s) => s.fields);
// Claves que el formulario maneja aparte de las secciones.
const EXTRA = ["nombre", "summary", "tipoObjeto", "tipoArea"];

describe("la ficha de la Necesidad se guarda entera en Supabase", () => {
  const shape = necesidadUpdateSchema.shape as Record<string, unknown>;

  it("todos los campos de la ficha están declarados en el esquema del PATCH", () => {
    const huerfanos = CAMPOS.filter((f) => !(f.api in shape)).map((f) => `${f.api} (${f.label})`);
    expect(huerfanos, "campos que el PATCH descartaría en silencio").toEqual([]);
  });

  it("las claves sueltas del formulario también están declaradas", () => {
    expect(EXTRA.filter((k) => !(k in shape))).toEqual([]);
  });

  it("no hay dos campos de la ficha escribiendo en la misma columna", () => {
    const porColumna = new Map<string, string[]>();
    for (const f of CAMPOS) {
      porColumna.set(f.col, [...(porColumna.get(f.col) ?? []), f.api]);
    }
    const duplicadas = [...porColumna.entries()]
      .filter(([, apis]) => apis.length > 1)
      .map(([col, apis]) => `${col} ← ${apis.join(", ")}`);
    expect(duplicadas, "una columna con dos dueños acaba con uno pisando al otro").toEqual([]);
  });

  it("no hay dos campos con la misma clave de API", () => {
    const vistos = new Set<string>();
    const repetidos = CAMPOS.filter((f) => (vistos.has(f.api) ? true : (vistos.add(f.api), false)));
    expect(repetidos.map((f) => f.api)).toEqual([]);
  });
});

/**
 * Los textos largos del requerimiento no caben en un `max` corto. Cuando el
 * límite se queda por debajo de lo que la gente escribe de verdad, el PATCH
 * devuelve 400 y el autoguardado falla en silencio: exactamente el bug de los
 * requisitos de calificación, que se recortaron a 2000 caracteres cuando el
 * texto real de las bases estándar pasa de 4000.
 */
describe("los campos de texto largo admiten lo que la gente escribe", () => {
  const LARGOS: Array<{ api: string; minimo: number }> = [
    { api: "requisitosCalificacion", minimo: 20_000 },
    { api: "finalidadPublica", minimo: 1000 },
    { api: "descripcionDetallada", minimo: 1000 },
    { api: "condicionesEjecucion", minimo: 1000 },
  ];

  for (const { api, minimo } of LARGOS) {
    it(`${api} acepta al menos ${minimo} caracteres`, () => {
      const texto = "A".repeat(minimo);
      const r = necesidadUpdateSchema.safeParse({ [api]: texto });
      expect(r.success, `${api} rechaza ${minimo} caracteres: el PATCH daría 400 y no se guardaría nada`).toBe(
        true,
      );
    });
  }
});
