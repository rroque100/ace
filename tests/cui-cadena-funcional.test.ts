import { describe, expect, it } from "vitest";
import { cuiDeCadenaFuncional } from "@/lib/pedido-compra-import";

describe("rescatar el CUI de la cadena funcional", () => {
  it("saca el CUI de la cadena real del expediente", () => {
    // El SIGA compone: funcion-programa-subprograma-act_proy-componente.
    expect(cuiDeCadenaFuncional("03-006-0010-2661009-6000008")).toBe("2661009");
  });

  it("no inventa si la cadena no tiene la forma del SIGA", () => {
    // Inventarse un código de inversión es peor que dejar el campo vacío.
    expect(cuiDeCadenaFuncional("03-006-0010")).toBeNull();
    expect(cuiDeCadenaFuncional("")).toBeNull();
    expect(cuiDeCadenaFuncional(null)).toBeNull();
  });

  it("no acepta un segmento no numérico", () => {
    expect(cuiDeCadenaFuncional("03-006-0010-SIN DATO-6000008")).toBeNull();
  });
});
