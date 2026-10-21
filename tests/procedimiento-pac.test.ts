import { describe, expect, it } from "vitest";
import { claveProcedimientoPac, modificaProcedimientoDelPac } from "@/lib/estrategia-formato";

describe("a) ¿se modifica el procedimiento del PAC?", () => {
  it("es SÍ cuando la estrategia elige otro distinto al programado", () => {
    expect(modificaProcedimientoDelPac("licitacion_publica", "licitacion_publica_abreviada")).toBe(true);
  });

  it("es NO cuando coinciden", () => {
    expect(modificaProcedimientoDelPac("concurso_publico", "concurso_publico")).toBe(false);
  });

  it("no afirma nada si falta alguno de los dos", () => {
    // Sin los dos datos no se puede decir ni que se modifica ni que no: es
    // "sin analizar", que en este formato no es lo mismo que "no".
    expect(modificaProcedimientoDelPac(null, "licitacion_publica")).toBeNull();
    expect(modificaProcedimientoDelPac("licitacion_publica", "")).toBeNull();
    expect(modificaProcedimientoDelPac(undefined, undefined)).toBeNull();
  });

  it("un cambio de SUBMODALIDAD cuenta como modificación", () => {
    // Misma familia (licitación), distinta submodalidad → SÍ.
    expect(
      modificaProcedimientoDelPac("Licitación Pública de obras", "Licitación Pública de obras con precalificación"),
    ).toBe(true);
    expect(
      modificaProcedimientoDelPac("Concurso Público de servicios", "Concurso Público con diálogo competitivo"),
    ).toBe(true);
  });

  it("la misma submodalidad, con distinto OBJETO, NO es modificación", () => {
    // El objeto (bienes/obras) no es un cambio de procedimiento y no ocurre en
    // una misma necesidad: la clave lo ignora.
    expect(modificaProcedimientoDelPac("Licitación Pública para bienes", "Licitación Pública de obras")).toBe(false);
  });

  it("compatibilidad: PAC genérico antiguo vs ficha con submodalidad marca SÍ (dirección segura)", () => {
    expect(modificaProcedimientoDelPac("licitacion_publica", "Licitación Pública de obras con precalificación")).toBe(
      true,
    );
    // Genérico antiguo que coincide con la ficha sin submodalidad → NO.
    expect(modificaProcedimientoDelPac("licitacion_publica", "Licitación Pública para bienes")).toBe(false);
  });
});

describe("claveProcedimientoPac · normaliza a base + submodalidad", () => {
  it("añade el sufijo de las cuatro submodalidades", () => {
    expect(claveProcedimientoPac("Licitación Pública de obras con precalificación")).toBe(
      "licitacion_publica:precalificacion",
    );
    expect(claveProcedimientoPac("Licitación Pública con diálogo competitivo")).toBe(
      "licitacion_publica:dialogo_competitivo",
    );
    expect(claveProcedimientoPac("Licitación Pública de obras con negociación")).toBe("licitacion_publica:negociacion");
    expect(claveProcedimientoPac("Licitación Pública para mecanismos diferenciados de adquisición (MDA)")).toBe(
      "licitacion_publica:mda",
    );
  });

  it("colapsa el objeto y conserva 'abreviada' (vía el genérico)", () => {
    expect(claveProcedimientoPac("Licitación Pública para bienes")).toBe("licitacion_publica");
    expect(claveProcedimientoPac("Licitación Pública de obras")).toBe("licitacion_publica");
    expect(claveProcedimientoPac("Licitación Pública abreviada de obras")).toBe("licitacion_publica_abreviada");
  });

  it("un genérico ya guardado se respeta tal cual", () => {
    expect(claveProcedimientoPac("licitacion_publica")).toBe("licitacion_publica");
    expect(claveProcedimientoPac("concurso_publico_abreviado")).toBe("concurso_publico_abreviado");
  });

  it("vacío → cadena vacía; texto no competitivo → su forma normalizada", () => {
    expect(claveProcedimientoPac("")).toBe("");
    expect(claveProcedimientoPac(null)).toBe("");
    expect(claveProcedimientoPac("Procedimiento de Selección No Competitivo")).toBe(
      "procedimiento de selección no competitivo",
    );
  });
});

describe("el procedimiento sale de A4 y a) se deduce", () => {
  const proceso = {
    amount: 1,
    entity: "MDCH",
    nomenclature: "N-VIEJO",
    object_type: "bienes" as const,
    // La taxonomía vieja del expediente (Ley 30225) NO debe ganarle a A4.
    procedure_type: "adjudicacion_simplificada",
    valor_estimado: 1,
  };

  async function hoja(a1: Record<string, unknown>, a4: Record<string, unknown>) {
    const { generarExcelF1 } = await import("@/lib/fase1-export");
    const ExcelJS = (await import("exceljs")).default;
    const { buffer } = await generarExcelF1("estrategia", {
      hitos: { A1: { data: a1, status: "hecho" }, A4: { data: a4, status: "hecho" } },
      proceso,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    return (a: string) => {
      const c = ws.getCell(a);
      const t = c.isMerged ? c.master : c;
      const v = t.value;
      if (v == null) return "";
      if (typeof v === "object" && "richText" in v && Array.isArray(v.richText)) {
        return v.richText.map((x: { text?: string }) => x.text ?? "").join("").trim();
      }
      return String(v).trim();
    };
  }

  it("la cabecera usa el procedimiento de A4, no el del expediente", async () => {
    const c = await hoja({}, { var_a_procedimiento: "licitacion_publica_abreviada", var_a_nomenclatura: "N° 42-2026-DEC-MDCH" });
    expect(c("B3")).toContain("LICITACIÓN PÚBLICA ABREVIADA");
    expect(c("B3")).toContain("N° 42-2026-DEC-MDCH");
    expect(c("B3")).not.toContain("Adjudicacion");
  });

  it("marca SÍ cuando la estrategia cambia el procedimiento del PAC", async () => {
    const c = await hoja(
      { procedimiento_pac: "licitacion_publica" },
      { var_a_procedimiento: "licitacion_publica_abreviada" },
    );
    expect(c("F4")).toBe("X"); // SÍ
    expect(c("H4")).toBe("");
  });

  it("marca NO cuando coinciden", async () => {
    const c = await hoja({ procedimiento_pac: "concurso_publico" }, { var_a_procedimiento: "concurso_publico" });
    expect(c("H4")).toBe("X"); // NO
    expect(c("F4")).toBe("");
  });

  it("no marca nada si A1 no registró el procedimiento del PAC", async () => {
    // Sin el dato del PAC no hay contra qué comparar: afirmar "NO" sería
    // inventarse que coinciden.
    const c = await hoja({}, { var_a_procedimiento: "licitacion_publica" });
    expect(c("F4")).toBe("");
    expect(c("H4")).toBe("");
  });

  it("b) E10: el documento del no competitivo (A1) se traslada al formato", async () => {
    // El documento lo registra A1 (documento_causal_art_55); A4 solo lo analiza.
    const c = await hoja(
      { causal_art_55: "c) Situación de desabastecimiento", documento_causal_art_55: "INFORME N° 012-2026-AU-MDCH" },
      { si_sustenta_no_competitivo: "si", var_b_no_competitivo: "El desabastecimiento acredita la directa." },
    );
    expect(c("E10")).toBe("INFORME N° 012-2026-AU-MDCH");
    expect(c("E10")).not.toContain("[Insertar");
  });

  it("b) E10: sin documento (o en un competitivo) sale 'NO CORRESPONDE.', no el marcador", async () => {
    const c = await hoja({ procedimiento_pac: "licitacion_publica" }, { var_a_procedimiento: "licitacion_publica" });
    expect(c("E10")).toBe("NO CORRESPONDE.");
  });

  it("b) E10: un documento residual SIN causal (competitivo) NO se cuela: sale 'NO CORRESPONDE.'", async () => {
    // Caso real: la contratación es competitiva (sin causal) pero quedó un
    // documento de una prueba anterior. E10 se rige por la causal, como el
    // formulario, así que ese residuo no debe aparecer.
    const c = await hoja({ documento_causal_art_55: "ddddddddddddddd" }, {});
    expect(c("E10")).toBe("NO CORRESPONDE.");
  });
});

describe("a) fila 7: el sustento del cambio", () => {
  const proceso = {
    amount: 1,
    entity: "MDCH",
    nomenclature: "N-1",
    object_type: "bienes" as const,
    procedure_type: null,
    valor_estimado: 1,
  };

  async function b7(a1: Record<string, unknown>, a4: Record<string, unknown>) {
    const { generarExcelF1 } = await import("@/lib/fase1-export");
    const ExcelJS = (await import("exceljs")).default;
    const { buffer } = await generarExcelF1("estrategia", {
      hitos: { A1: { data: a1, status: "hecho" }, A4: { data: a4, status: "hecho" } },
      proceso,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    const leer = (a: string) => {
      const c = ws.getCell(a);
      const t = c.isMerged ? c.master : c;
      const v = t.value;
      if (v == null) return "";
      if (typeof v === "object" && "richText" in v && Array.isArray(v.richText)) {
        return v.richText.map((x: { text?: string }) => x.text ?? "").join("").trim();
      }
      return String(v).trim();
    };
    return { b7: leer("B7"), no: leer("H4"), si: leer("F4") };
  }

  it("con NO marcado, la fila 7 dice NO CORRESPONDE", async () => {
    const r = await b7({ procedimiento_pac: "licitacion_publica" }, { var_a_procedimiento: "licitacion_publica" });
    expect(r.no).toBe("X");
    expect(r.b7).toBe("NO CORRESPONDE.");
  });

  it("con NO marcado, un sustento del cambio NO se imprime", async () => {
    // Sería una contradicción con la propia casilla: no hubo cambio.
    const r = await b7(
      { procedimiento_pac: "concurso_publico" },
      { var_a_procedimiento: "concurso_publico", var_a_sustento_cambio: "Texto que no debe salir" },
    );
    expect(r.b7).toBe("NO CORRESPONDE.");
    expect(r.b7).not.toContain("no debe salir");
  });

  it("con SÍ marcado, la fila 7 lleva el sustento del cambio", async () => {
    const r = await b7(
      { procedimiento_pac: "licitacion_publica" },
      { var_a_procedimiento: "licitacion_publica_abreviada", var_a_sustento_cambio: "La cuantía actualizada baja del umbral." },
    );
    expect(r.si).toBe("X");
    expect(r.b7).toBe("La cuantía actualizada baja del umbral.");
  });
});

describe("la vista previa delata que a) no se marcará", () => {
  const proceso = {
    amount: 1,
    entity: "MDCH",
    nomenclature: "N-1",
    object_type: "bienes" as const,
    procedure_type: null,
    valor_estimado: 1,
  };

  async function sinResponder(a1: Record<string, unknown>, a4: Record<string, unknown>) {
    const { previewEstrategia } = await import("@/lib/fase1-export");
    const r = await previewEstrategia({
      hitos: { A1: { data: a1, status: "hecho" }, A4: { data: a4, status: "hecho" } },
      proceso,
    });
    return r.sinResponder.filter((s) => s.startsWith("a)"));
  }

  it("avisa si A1 no tiene el procedimiento del PAC", async () => {
    // En el Excel, dos casillas en blanco no se notan. Aquí sí.
    const s = await sinResponder({}, { var_a_procedimiento: "licitacion_publica" });
    expect(s).toHaveLength(1);
    expect(s[0]).toContain("A1");
  });

  it("avisa si A4 no tiene el tipo de procedimiento", async () => {
    const s = await sinResponder({ procedimiento_pac: "licitacion_publica" }, {});
    expect(s).toHaveLength(1);
    expect(s[0]).toContain("este paso");
  });

  it("no avisa cuando los dos están: entonces sí se marca", async () => {
    const s = await sinResponder(
      { procedimiento_pac: "licitacion_publica" },
      { var_a_procedimiento: "licitacion_publica" },
    );
    expect(s).toEqual([]);
  });
});

describe("contratación NO programada (no está en el PAC)", () => {
  it("a) es NO: no se puede modificar lo que no está registrado", () => {
    // Si no está en el PAC no hay ningún procedimiento registrado allí. Exigir
    // un `procedimiento_pac` que por definición no existe dejaba la casilla en
    // blanco para siempre.
    expect(modificaProcedimientoDelPac("", "licitacion_publica", false)).toBe(false);
    expect(modificaProcedimientoDelPac(null, null, false)).toBe(false);
  });

  it("estando en el PAC sin procedimiento, sigue sin determinarse", () => {
    expect(modificaProcedimientoDelPac("", "licitacion_publica", true)).toBeNull();
  });

  it("marca H4 en el Excel de una no programada", async () => {
    const { generarExcelF1 } = await import("@/lib/fase1-export");
    const ExcelJS = (await import("exceljs")).default;
    const { buffer } = await generarExcelF1("estrategia", {
      hitos: {
        // En CMN pero NO en el PAC: adquisición no programada.
        A1: { data: { en_cmn: true, en_pac: false, programada: false }, status: "hecho" },
        A4: { data: { var_a_procedimiento: "licitacion_publica" }, status: "hecho" },
      },
      proceso: {
        amount: 1,
        entity: "MDCH",
        nomenclature: "N-1",
        object_type: "bienes",
        procedure_type: null,
        valor_estimado: 1,
      },
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    expect(String(ws.getCell("H4").value ?? "").trim()).toBe("X"); // NO
    expect(String(ws.getCell("F4").value ?? "").trim()).toBe("");
  });
});
