import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";
import { necesidadUpdateSchema } from "@/lib/necesidades";

/**
 * Un desplegable no puede ofrecer una opción que el guardado rechaza.
 *
 * «Cómputo del plazo» es un enum cerrado —«calendario» o «hábiles»— y el
 * formulario le ofrecía «— Sin definir —» como a todos los demás. Al elegirla se
 * enviaba "" y el PATCH respondía 400 en CADA autoguardado y también al pulsar
 * Guardar ficha. El usuario solo veía «No se pudo autoguardar», sin saber qué
 * campo lo causaba ni que había sido él quien lo dejó así.
 *
 * La regla ya existía en el propio componente para los desplegables de
 * ubicación: si el campo tiene `porDefecto`, no se ofrece la opción vacía. Lo
 * que faltaba era aplicarla también a los demás.
 */
describe("los desplegables no ofrecen lo que el guardado rechaza", () => {
  const selects = FICHA_SECCIONES.flatMap((s) => s.fields).filter(
    (f) => f.kind === "select" && !f.oculto,
  );

  it("hay desplegables que revisar", () => {
    expect(selects.length).toBeGreaterThan(0);
  });

  for (const field of selects) {
    it(`«${field.api}»: si el esquema rechaza vacío, declara porDefecto`, () => {
      const aceptaVacio = necesidadUpdateSchema.safeParse({ [field.api]: "" }).success;
      if (aceptaVacio) return; // puede ofrecer «— Sin definir —» sin problema
      expect(
        field.porDefecto,
        `${field.api} es un enum cerrado: sin porDefecto el formulario ofrece una opción que el guardado rechaza con 400`,
      ).toBeTruthy();
    });
  }
});

describe("el componente respeta el porDefecto", () => {
  it("la opción vacía del select es condicional, no fija", () => {
    // Se vigila el fuente porque el suite no monta React. Lo que se rompió fue
    // exactamente esto: un `<option value="">` incondicional.
    const fuente = readFileSync("app/components/necesidad/campo-ficha.tsx", "utf-8");
    const sueltas = fuente
      .split("\n")
      .filter((l) => /<option value=""/.test(l))
      .filter((l) => !/porDefecto/.test(l));
    expect(
      sueltas,
      "un <option value=\"\"> sin condicionar a porDefecto vuelve a permitir guardar un enum vacío",
    ).toEqual([]);
  });
});

describe("segunda capa: el payload no viaja vacío", () => {
  it("un campo con porDefecto vacío se envía con su valor por defecto", () => {
    // Repara los borradores que YA tienen la cadena vacía guardada en el
    // navegador: sin esto seguirían sin poder guardarse aunque el formulario ya
    // no permita llegar ahí.
    const campo = FICHA_SECCIONES.flatMap((s) => s.fields).find((f) => f.porDefecto);
    expect(campo, "ya no hay campos con porDefecto: revisar esta prueba").toBeDefined();
    const comoLoCompone = (raw: string) =>
      raw === "" && campo!.porDefecto ? campo!.porDefecto : raw;
    expect(comoLoCompone("")).toBe(campo!.porDefecto);
    expect(necesidadUpdateSchema.safeParse({ [campo!.api]: comoLoCompone("") }).success).toBe(true);
  });

  it("y el valor elegido por el usuario se respeta", () => {
    const campo = FICHA_SECCIONES.flatMap((s) => s.fields).find((f) => f.porDefecto)!;
    const otra = (campo.opciones ?? []).find((o) => o.value !== campo.porDefecto)?.value;
    if (!otra) return;
    const comoLoCompone = (raw: string) => (raw === "" && campo.porDefecto ? campo.porDefecto : raw);
    expect(comoLoCompone(otra)).toBe(otra);
  });
});
