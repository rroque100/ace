import { describe, expect, it } from "vitest";
import {
  APARTADOS_MODELO,
  apartadosDelModelo,
  camposExigidosDeterministas,
  normalizarTitulo,
  titulosDelModelo,
} from "@/lib/modelo-apartados";

const TODOS = new Set([
  "adelantoDirecto", "departamento", "descripcionDetallada", "descripcionGeneral", "distrito",
  "finalidadPublica", "formulaReajuste", "lugarEntrega", "metasFisicas", "modalidadPago",
  "otrasPenalidades", "penalidadMora", "plazoEjecucion", "plazoEjecucionUnidad", "plazoRespuestas",
  "provincia", "requisitosCalificacion", "sistemaEntrega", "solucionControversias", "subcontratacion",
]);

describe("normalizacion de titulos", () => {
  it("absorbe el ruido del OCR", () => {
    // Casos REALES del corpus: el OCR parte las palabras y descoloca los acentos.
    expect(normalizarTitulo("F Ó RMULAS DE REAJUSTES")).toBe("FORMULASDEREAJUSTES");
    expect(normalizarTitulo("SOLUCIÓN DE CONTROVERSIAS CONTRA C T UALE")).toBe(
      "SOLUCIONDECONTROVERSIASCONTRACTUALE",
    );
    expect(normalizarTitulo("SUBCONTRATACIÓN")).toBe("SUBCONTRATACION");
  });
});

describe("deteccion de apartados", () => {
  it("casa por NOMBRE y no por letra", () => {
    // La subcontratacion es «g.» en unos modelos y «h.» en otros: atarse a la
    // letra la perderia en la mitad del corpus.
    const conG = "g. SUBCONTRATACIÓN\nEl contratista puede subcontratar…";
    const conH = "h. SUBCONTRATACIÓN\nEl contratista puede subcontratar…";
    expect(camposExigidosDeterministas(conG, TODOS)).toEqual(["subcontratacion"]);
    expect(camposExigidosDeterministas(conH, TODOS)).toEqual(["subcontratacion"]);
  });

  it("no confunde una mencion en una nota con un apartado", () => {
    // Casi todos los modelos MENCIONAN los adelantos en una nota aunque no
    // tengan ese apartado. Solo cuenta lo que aparece como titulo.
    const soloMencion = "Si la entidad contratante ha previsto la entrega de adelantos, debe prever…";
    expect(camposExigidosDeterministas(soloMencion, TODOS)).toEqual([]);
  });

  it("lee la numeracion a tres niveles de los modelos de obras", () => {
    // Los modelos de obras no usan las letras a)-j): numeran «3.5.14.». Con un
    // patron de dos niveles no casaba NI UN titulo en esos cuatro documentos, y
    // el sintoma era engañoso —parecian usar otro vocabulario—.
    const obras = "3.5.6. SUBCONTRATACIÓN\n3.5.7. MODALIDAD DE PAGO\n3.5.14. PENALIDADES POR MORA";
    const r = camposExigidosDeterministas(obras, TODOS);
    expect(r).toContain("subcontratacion");
    expect(r).toContain("modalidadPago");
    expect(r).toContain("penalidadMora");
  });

  it("el plazo arrastra su unidad de computo", () => {
    // Un numero de dias sin unidad no significa nada en un contrato (Art. 105.3).
    const r = camposExigidosDeterministas("c. PLAZO DE PRESTACIÓN DEL SERVICIO", TODOS);
    expect(r).toContain("plazoEjecucion");
    expect(r).toContain("plazoEjecucionUnidad");
  });

  it("el apartado de penalidades trae la de mora y las otras", () => {
    // Art. 119.1: el contrato establece la penalidad por mora Y otras penalidades.
    expect(camposExigidosDeterministas("f. PENALIDADES", TODOS)).toEqual([
      "otrasPenalidades",
      "penalidadMora",
    ]);
  });

  it("el lugar se descompone en los cuatro campos de la ficha", () => {
    const r = camposExigidosDeterministas("d. LUGAR DE PRESTACIÓN DE SERVICIO", TODOS);
    expect(r.sort()).toEqual(["departamento", "distrito", "lugarEntrega", "provincia"]);
  });

  it("no devuelve campos que el catalogo no tiene", () => {
    // Un campo sin sitio donde rellenarse no se puede exigir.
    const sinLugar = new Set(["modalidadPago"]);
    expect(camposExigidosDeterministas("d. LUGAR DE ENTREGA", sinLugar)).toEqual([]);
  });

  it("es REPRODUCIBLE: el mismo texto da siempre lo mismo", () => {
    // Es la razon de ser de este modulo. Lo derivaba una IA y para el mismo
    // modelo y objeto se vieron listas de 12, 14 y 21 campos segun el dia.
    const texto = [
      "3.1 FINALIDAD PÚBLICA DE LA CONTRATACIÓN",
      "a. MODALIDAD DE PAGO",
      "g. SUBCONTRATACIÓN",
      "i. SOLUCIÓN DE CONTROVERSIAS CONTRACTUALES",
    ].join("\n");
    const primera = camposExigidosDeterministas(texto, TODOS);
    for (let i = 0; i < 5; i++) {
      expect(camposExigidosDeterministas(texto, TODOS)).toEqual(primera);
    }
  });
});

describe("integridad de la tabla", () => {
  it("no hay claves repetidas", () => {
    const claves = APARTADOS_MODELO.map((a) => a.clave);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("toda clave esta ya normalizada", () => {
    // Una clave con acentos o espacios no casaria nunca, y el fallo seria mudo.
    for (const a of APARTADOS_MODELO) {
      expect(normalizarTitulo(a.clave), a.apartado).toBe(a.clave);
    }
  });

  it("ningun apartado se queda sin campos", () => {
    for (const a of APARTADOS_MODELO) {
      expect(a.apis.length, a.apartado).toBeGreaterThan(0);
    }
  });

  it("titulosDelModelo devuelve el nombre, no la letra", () => {
    expect(titulosDelModelo("g. SUBCONTRATACIÓN algo")).toContain("SUBCONTRATACIÓN");
  });

  it("apartadosDelModelo nombra lo detectado, para poder revisarlo", () => {
    expect(apartadosDelModelo("g. SUBCONTRATACIÓN")).toEqual(["Subcontratación"]);
  });
});
