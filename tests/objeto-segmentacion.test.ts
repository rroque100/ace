import { describe, expect, it } from "vitest";
import { objetoSegmentacionDe } from "@/lib/actuaciones-preparatorias";

/**
 * A2 (Segmentación) es BINARIA: los cuatro objetos de la ficha se agrupan en dos.
 * `objetoSegmentacionDe` propone el valor por defecto de A2 desde el "Tipo de
 * objeto" de la necesidad. Acepta el objeto en plural (tipo_objeto: "bienes") y en
 * singular (objeto de A3: "bien").
 */
describe("objetoSegmentacionDe · tipo de objeto de la ficha → objeto de la segmentación", () => {
  it("bienes y servicios → bienes_servicios", () => {
    for (const v of ["bienes", "bien", "servicios", "servicio"]) {
      expect(objetoSegmentacionDe(v), v).toBe("bienes_servicios");
    }
  });

  it("obras y consultoría de obra → obras_consultoria_obras", () => {
    for (const v of ["obras", "obra", "consultoria_obra", "consultoría de obra"]) {
      expect(objetoSegmentacionDe(v), v).toBe("obras_consultoria_obras");
    }
  });

  it("sin objeto (o no reconocido) devuelve undefined: no se fuerza un valor", () => {
    expect(objetoSegmentacionDe(null)).toBeUndefined();
    expect(objetoSegmentacionDe("")).toBeUndefined();
    expect(objetoSegmentacionDe("otro")).toBeUndefined();
  });
});
