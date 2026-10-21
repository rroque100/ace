import { describe, expect, it } from "vitest";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";
import { necesidadUpdateSchema } from "@/lib/necesidades";

/**
 * El `kind` de la ficha decide CÓMO se envía cada campo, y el esquema decide
 * cómo se acepta. Si discrepan, el guardado responde 400 en cada intento.
 *
 * Pasó con «Plazo para respuestas entre las partes»: declarado `kind: "number"`
 * —así que `construirPayload` lo mandaba como número— y validado como texto. En
 * cuanto alguien escribía algo ahí, la ficha entera dejaba de guardarse y el
 * aviso solo decía «No se pudo autoguardar».
 *
 * La comprobación recorre el catálogo entero en vez de fijar ese campo: es lo
 * que detecta el siguiente que se declare mal.
 */
describe("lo que la ficha envía es lo que el esquema acepta", () => {
  const campos = FICHA_SECCIONES.flatMap((s) => s.fields).filter((f) => !f.oculto);

  it("hay campos que revisar", () => {
    expect(campos.length).toBeGreaterThan(50);
  });

  for (const field of campos.filter((f) => f.kind === "number" && !f.checkbox)) {
    it(`«${field.api}» se declara número y el esquema acepta un número`, () => {
      // `construirPayload` hace `payload[api] = Number(raw)` para kind number.
      // Un 1 vale para todos: los que acotan rango —el trimestre va de 1 a 4—
      // lo aceptan, y lo que se comprueba aquí es el TIPO, no el rango.
      const r = necesidadUpdateSchema.safeParse({ [field.api]: 1 });
      expect(
        r.success,
        r.success ? "" : `${field.api}: ${r.error.issues[0]?.message}. El campo es kind:"number" pero el esquema no acepta un número.`,
      ).toBe(true);
    });
  }

  // Las casillas se excluyen: viajan como booleano, no como texto.
  for (const field of campos.filter((f) => !f.checkbox && (!f.kind || f.kind === "text" || f.kind === "textarea"))) {
    it(`«${field.api}» se declara texto y el esquema acepta texto`, () => {
      const r = necesidadUpdateSchema.safeParse({ [field.api]: "x" });
      expect(
        r.success,
        r.success ? "" : `${field.api}: ${r.error.issues[0]?.message}`,
      ).toBe(true);
    });
  }
});

describe("el ejemplo del campo cabe en su propio tope", () => {
  it("un ejemplo más largo que el límite enseña a escribir algo que no se guarda", () => {
    const problemas: string[] = [];
    for (const s of FICHA_SECCIONES) {
      for (const f of s.fields) {
        // Los desplegables quedan fuera: ahí el `ejemplo` es la ETIQUETA que
        // se enseña («Días calendario»), no el valor que se guarda
        // («calendario»). Compararlo con el esquema no dice nada.
        if (f.oculto || f.checkbox || !f.ejemplo) continue;
        if (f.kind === "number" || f.kind === "select") continue;
        if (!necesidadUpdateSchema.safeParse({ [f.api]: f.ejemplo }).success) {
          problemas.push(`${f.api} (ejemplo de ${f.ejemplo.length} car.)`);
        }
      }
    }
    expect(problemas).toEqual([]);
  });
});
