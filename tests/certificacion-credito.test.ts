import { describe, expect, it } from "vitest";
import {
  certificacionCreditoDe,
  cmnDelA1,
  numeroInformeConPrefijo,
} from "@/lib/informe-aprobacion-datos";
import { documentoModificacionCmnTexto } from "@/lib/actuaciones-preparatorias";

describe("línea de certificación de crédito presupuestario (A8)", () => {
  it("compone número y monto de los campos generales", () => {
    // El caso real que estaba en blanco: el usuario llenó "Número de
    // certificación/nota" y "Monto", no los campos específicos de la CCP.
    expect(certificacionCreditoDe({ numero: "6119", monto: 77700.6 })).toBe(
      "N° 6119 — S/. 77,700.60",
    );
  });

  it("lee el monto aunque venga como NÚMERO", () => {
    // El fallo de fondo: el monto se guarda como número y se leía con `str`,
    // que devuelve "" para cualquier cosa que no sea string. La fila salía
    // vacía teniendo el dato.
    expect(certificacionCreditoDe({ numero: "1", monto: 500 })).toContain("S/. 500.00");
    expect(certificacionCreditoDe({ numero: "1", monto: "500" })).toContain("S/. 500.00");
  });

  it("prefiere la CCP del ejercicio sobre los campos generales", () => {
    const r = certificacionCreditoDe({
      numero_ccp: "999",
      monto_ccp: 5000,
      numero: "111",
      monto: 1,
    });
    expect(r).toBe("N° 999 — S/. 5,000.00");
  });

  it("con solo el número, no inventa un monto", () => {
    expect(certificacionCreditoDe({ numero: "6119" })).toBe("N° 6119");
  });

  it("con solo el monto, no inventa un número", () => {
    expect(certificacionCreditoDe({ monto: 100 })).toBe("S/. 100.00");
  });

  it("sin ninguno de los dos, cadena vacía (el informe la pinta con guion)", () => {
    expect(certificacionCreditoDe({})).toBe("");
    expect(certificacionCreditoDe({ tipo: "ccp" })).toBe("");
  });

  it("un monto cero o negativo no cuenta como monto", () => {
    expect(certificacionCreditoDe({ numero: "1", monto: 0 })).toBe("N° 1");
  });
});

describe("número del informe de aprobación (A8)", () => {
  it("antepone «INFORME N° » al número guardado", () => {
    expect(numeroInformeConPrefijo("001-2026-JRM-UA-OGA/MDCH")).toBe(
      "INFORME N° 001-2026-JRM-UA-OGA/MDCH",
    );
  });

  it("no duplica el prefijo en datos antiguos que lo traían completo", () => {
    expect(numeroInformeConPrefijo("INFORME N° 001-2026-JRM-UA-OGA/MDCH")).toBe(
      "INFORME N° 001-2026-JRM-UA-OGA/MDCH",
    );
    // Tolera la variante "NRO" tecleada a mano.
    expect(numeroInformeConPrefijo("INFORME NRO 5-2026")).toBe("INFORME N° 5-2026");
  });

  it("vacío si no hay número, para que el respaldo tome el relevo", () => {
    expect(numeroInformeConPrefijo("")).toBe("");
  });
});

describe("línea «Incluida en el CMN» del informe de aprobación (Art. 54.3)", () => {
  it("con la inclusión verificada muestra la versión y el periodo", () => {
    // Solo el número de versión, sin la palabra "Versión": la etiqueta
    // "INCLUIDA EN EL CMN" ya lo dice.
    expect(cmnDelA1({ en_cmn: true, version_cmn: "3", periodo_programacion: "2026" })).toBe(
      "3 · 2026",
    );
  });

  it("con solo la versión, muestra el número a secas (sin «Versión»)", () => {
    expect(cmnDelA1({ en_cmn: true, version_cmn: "630" })).toBe("630");
  });

  it("sin CMN, bloquea y remite al 54.3", () => {
    expect(cmnDelA1({ en_cmn: false })).toBe(
      "NO — requiere modificación del CMN antes de aprobar (Art. 54.3)",
    );
  });

  it("no programada: refleja el documento de modificación del CMN (Art. 42.3)", () => {
    expect(
      cmnDelA1({ en_cmn: true, programada: false, documento_modificacion_cmn: "INFORME N° 045" }),
    ).toContain("modificación solicitada mediante INFORME N° 045");
  });

  it("no programada con el campo numérico: el número NO se cae del informe", () => {
    // El campo pasó a `number`; `str()` (que ignora los no-string) lo dejaba caer
    // en silencio. Se lee con el helper, que lo redacta como "documento N.° 45".
    expect(
      cmnDelA1({ en_cmn: true, programada: false, documento_modificacion_cmn: 45 }),
    ).toContain("modificación solicitada mediante documento N.° 45");
  });

  it("sin CMN pero con solicitud de modificación: deja constar la solicitud", () => {
    expect(
      cmnDelA1({ en_cmn: false, programada: false, documento_modificacion_cmn: "INFORME N° 045" }),
    ).toContain("consta la solicitud de modificación (INFORME N° 045)");
    expect(cmnDelA1({ en_cmn: false, programada: false, documento_modificacion_cmn: "INFORME N° 045" })).toContain(
      "54.3",
    );
  });

  it("programada: el documento de modificación no se menciona", () => {
    expect(
      cmnDelA1({ en_cmn: true, programada: true, documento_modificacion_cmn: "INFORME N° 045" }),
    ).not.toContain("modificación solicitada");
  });

  it("vacío: cadena vacía (el informe la pinta con guion)", () => {
    expect(cmnDelA1({})).toBe("");
  });
});

// El campo `documento_modificacion_cmn` guarda solo el número correlativo
// (tipo number), pero los informes lo incrustan en frase. Este helper es el
// único punto que traduce el número a "documento N.° 45" y, a la vez, respeta
// las referencias completas que guardaron los expedientes anteriores al cambio.
describe("documentoModificacionCmnTexto", () => {
  it("el número correlativo sale como «documento N.° 45»", () => {
    expect(documentoModificacionCmnTexto({ documento_modificacion_cmn: 45 })).toBe("documento N.° 45");
  });

  it("una referencia completa legada (texto) se respeta tal cual", () => {
    expect(
      documentoModificacionCmnTexto({ documento_modificacion_cmn: "INFORME N° 045-2026-AU-MDCH" }),
    ).toBe("INFORME N° 045-2026-AU-MDCH");
  });

  it("sin dato —o con un valor no imprimible— devuelve cadena vacía", () => {
    expect(documentoModificacionCmnTexto({})).toBe("");
    expect(documentoModificacionCmnTexto(undefined)).toBe("");
    expect(documentoModificacionCmnTexto({ documento_modificacion_cmn: "   " })).toBe("");
    expect(documentoModificacionCmnTexto({ documento_modificacion_cmn: Number.NaN })).toBe("");
  });
});
