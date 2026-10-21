import { describe, expect, it } from "vitest";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";
import { LIMITES_TEXTO, necesidadUpdateSchema } from "@/lib/necesidades";

/**
 * Los dos plazos del Art. 144 son NÚMEROS de días.
 *
 * Se pedían como texto libre y cada ficha los escribía a su manera —«siete (7)»,
 * «cinco (5) días hábiles», «7 dias»—. Con eso no se puede contar, ni comparar
 * contra el tope del Art. 144, ni calcular el 30% que limita la subsanación.
 */
const SUBGRUPO = "Recepción y conformidad (Art. 144)";
const campos = FICHA_SECCIONES.flatMap((s) => s.fields);
const campo = (api: string) => campos.find((f) => f.api === api)!;

describe("el bloque del Art. 144 está junto", () => {
  it("los cinco campos comparten subgrupo con el apartado que redactan", () => {
    // Estaban repartidos dentro de «Otras condiciones del contrato», mezclados
    // con garantías y gestión de riesgos, que no tienen que ver con esto.
    for (const api of [
      "recepcionArea", "conformidadArea", "conformidadPlazo",
      "conformidadPlazoSubsanacion", "recepcionConformidad",
    ]) {
      expect(campo(api).subgrupo, api).toBe(SUBGRUPO);
    }
  });

  it("y el texto del apartado va el último, después de sus datos", () => {
    const delBloque = campos.filter((f) => f.subgrupo === SUBGRUPO);
    expect(delBloque.at(-1)!.api).toBe("recepcionConformidad");
  });

  it("nada más se coló en el subgrupo", () => {
    expect(campos.filter((f) => f.subgrupo === SUBGRUPO).length).toBe(5);
  });

  it("ninguno se esconde según el objeto", () => {
    // El almacén salía solo en bienes y la subsanación solo en servicios, así
    // que el bloque cambiaba de forma sin decir por qué faltaba lo que faltaba.
    // Lo que sí depende del objeto es la PLANTILLA del apartado.
    const conFiltro = campos
      .filter((f) => f.subgrupo === SUBGRUPO && f.mostrarPara)
      .map((f) => f.api);
    expect(conFiltro).toEqual([]);
  });

  it("y solo sigue oculto el espejo del área, que no es una casilla", () => {
    // Enseñarlo devolvería las DOS «Área que otorga la conformidad» que se
    // quitaron: es la misma columna, no un campo más.
    const ocultos = campos.filter((f) => f.subgrupo === SUBGRUPO && f.oculto).map((f) => f.api);
    expect(ocultos).toEqual(["conformidadArea"]);
  });
});

describe("los dos plazos son numéricos de tres dígitos", () => {
  for (const api of ["conformidadPlazo", "conformidadPlazoSubsanacion"]) {
    it(`«${api}» se declara número con su rango`, () => {
      expect(campo(api).kind).toBe("number");
      // El rango va en el campo para que lo aplique la propia casilla: sin él,
      // el único sitio donde se nota el tope es el 400 del guardado.
      expect(campo(api).min).toBe(1);
      expect(campo(api).max).toBe(999);
    });

    it(`«${api}»: el esquema acepta un número y rechaza texto`, () => {
      // El desajuste ficha `kind: "number"` / esquema de texto es lo que hacía
      // que cada guardado respondiera 400 en cuanto alguien escribía aquí.
      expect(necesidadUpdateSchema.safeParse({ [api]: 7 }).success).toBe(true);
      expect(necesidadUpdateSchema.safeParse({ [api]: "siete (7)" }).success).toBe(false);
    });

    it(`«${api}»: caben tres dígitos y no cuatro`, () => {
      expect(necesidadUpdateSchema.safeParse({ [api]: 999 }).success).toBe(true);
      expect(necesidadUpdateSchema.safeParse({ [api]: 1000 }).success).toBe(false);
      // Un plazo de cero días no es un plazo.
      expect(necesidadUpdateSchema.safeParse({ [api]: 0 }).success).toBe(false);
      expect(necesidadUpdateSchema.safeParse({ [api]: 7.5 }).success).toBe(false);
    });

    it(`«${api}» ya no está en el mapa de topes de TEXTO`, () => {
      // Dejarlo ahí capaba «100» a sus primeros caracteres sin motivo.
      expect(LIMITES_TEXTO[api]).toBeUndefined();
    });

    it(`el ejemplo de «${api}» es lo que ahora se teclea`, () => {
      // Decía «siete (7)» y «cinco (5) días hábiles»: en una casilla numérica
      // eso enseña a escribir algo que no se puede guardar.
      expect(campo(api).ejemplo).toMatch(/^\d{1,3}$/);
    });

    it(`la etiqueta de «${api}» dice la unidad`, () => {
      // El valor es un número pelado: sin la unidad en el rótulo, «7» no dice
      // si son días hábiles o calendario.
      expect(campo(api).label).toMatch(/\(días( hábiles)?\)/);
    });
  }
});

describe("la casilla numérica aplica el rango declarado", () => {
  it("el input pasa min y max", async () => {
    // Se vigila el fuente porque el suite no monta React.
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad/campo-ficha.tsx", "utf-8");
    const i = fuente.indexOf('field.kind === "number" || field.kind === "date"');
    const bloque = fuente.slice(i, i + 500);
    // `topeEfectivo` es `topeCalculado ?? field.max`: el tope del catálogo, o
    // el que depende de otro campo cuando lo hay (el 30% de la subsanación).
    expect(bloque).toContain("topeEfectivo");
    expect(bloque).toContain("min={field.min}");
  });
});
