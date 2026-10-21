import { describe, expect, it } from "vitest";
import {
  columnasDesdeHito,
  PASOS_QUE_ALIMENTAN_COLUMNAS,
  resumenDelExpediente,
} from "@/lib/expediente-columnas";

describe("A4 · estrategia", () => {
  it("lleva cada variable del Art. 46 a su columna", () => {
    const patch = columnasDesdeHito("A4", {
      var_a_procedimiento: "licitacion_publica",
      var_e_tipo_evaluador: "comite",
      var_f_requisitos_calificacion: "OBLIGATORIOS: ...",
      var_h_modalidad_pago: "suma_alzada",
      var_i_sistema_entrega: "no_aplica",
      var_l_garantias_adelantos: "fiel cumplimiento 10%",
      var_n_tipo_interaccion: "consulta al mercado",
    });
    // La modalidad de pago (h) y el sistema de entrega (i) NO se reflejan a
    // columna: `modalidad_ejecucion`/`sistema_contratacion` tienen un CHECK con el
    // vocabulario de la Ley 30225 y los valores del Art. 46.1 (suma_alzada,
    // no_aplica, pago_consumo…) lo violan → el PATCH del paso caía con 500. La
    // ficha ya los lee del hito, así que no se pierde nada.
    expect(patch).toEqual({
      garantias_adelantos: "fiel cumplimiento 10%",
      procedure_type: "licitacion_publica",
      requisitos_calificacion: "OBLIGATORIOS: ...",
      tipo_evaluador_perfil: "comite",
      tipo_interaccion_mercado: "consulta al mercado",
    });
  });

  it("no escribe las columnas con CHECK de la Ley 30225 (evita el 500 del guardado)", () => {
    // Regresión directa del fallo: seleccionar «Suma alzada» en h) hacía que el
    // guardado del paso A4 devolviera 500 (viola procurement_processes_modalidad_
    // ejecucion_check) y NADA se persistía.
    const patch = columnasDesdeHito("A4", { var_h_modalidad_pago: "suma_alzada", var_i_sistema_entrega: "no_aplica" });
    expect(patch).toEqual({});
  });

  it("omite lo que aún no se llenó en vez de borrarlo", () => {
    // El autoguardado manda formularios a medias: escribir "" borraría un dato
    // que ya estaba, y vaciar algo es una decisión que se toma en el paso.
    const patch = columnasDesdeHito("A4", { var_a_procedimiento: "  ", var_e_tipo_evaluador: "comite" });
    expect(patch).toEqual({ tipo_evaluador_perfil: "comite" });
  });

  it("ignora los valores que no son texto", () => {
    expect(columnasDesdeHito("A4", { var_a_procedimiento: 42 })).toEqual({});
  });
});

describe("A7 · certificación presupuestal", () => {
  it("compone número y monto en una línea", () => {
    expect(columnasDesdeHito("A7", { numero_ccp: "123", monto_ccp: "45000.00" })).toEqual({
      certificacion_presupuestal: "N° 123 — S/ 45000.00",
    });
  });

  it("prefiere la CCP sobre el documento genérico", () => {
    // El genérico puede ser una previsión; la CCP es la certificación de verdad.
    const patch = columnasDesdeHito("A7", { numero: "999", numero_ccp: "123", monto_ccp: "1" });
    expect(patch.certificacion_presupuestal).toContain("123");
    expect(patch.certificacion_presupuestal).not.toContain("999");
  });

  it("se apaña con solo uno de los dos", () => {
    expect(columnasDesdeHito("A7", { numero_ccp: "123" })).toEqual({
      certificacion_presupuestal: "N° 123",
    });
  });

  it("sin nada, no escribe nada", () => {
    expect(columnasDesdeHito("A7", { fecha_ccp: "2026-01-01" })).toEqual({});
  });
});

describe("A8 · aprobación del expediente", () => {
  it("recoge autoridad y documento", () => {
    expect(columnasDesdeHito("A8", { autoridad: "aga", numero_documento: "RES-014-2026" })).toEqual({
      autoridad_aprobacion: "aga",
      doc_aprobacion_expediente: "RES-014-2026",
    });
  });

  it("con la autoridad sola no inventa documento", () => {
    expect(columnasDesdeHito("A8", { autoridad: "titular" })).toEqual({
      autoridad_aprobacion: "titular",
    });
  });
});

describe("A3 · requerimiento", () => {
  it("lleva la fórmula de reajuste", () => {
    expect(columnasDesdeHito("A3", { formula_reajuste: "K = 0.5" })).toEqual({
      formula_reajuste: "K = 0.5",
    });
  });
});

describe("pasos que no alimentan nada", () => {
  it("no producen patch", () => {
    for (const code of ["A1", "A2", "A5", "A6", "A9", "A10", "B1", "C1"]) {
      expect(columnasDesdeHito(code, { cualquier_cosa: "x" }), code).toEqual({});
    }
  });

  it("sin datos tampoco", () => {
    expect(columnasDesdeHito("A4", null)).toEqual({});
  });

  it("la lista documentada coincide con lo que de verdad escribe", () => {
    const escriben = ["A3", "A4", "A7", "A8"].filter(
      (c) => Object.keys(columnasDesdeHito(c, {
        autoridad: "aga",
        formula_reajuste: "K",
        numero_ccp: "1",
        var_a_procedimiento: "x",
      })).length > 0,
    );
    expect(escriben).toEqual([...PASOS_QUE_ALIMENTAN_COLUMNAS]);
  });
});

describe("resumen para la ficha", () => {
  it("lee del paso, no de la columna", () => {
    // Es lo que hace que los expedientes anteriores al cableado salgan bien sin
    // que nadie reabra A4, A7 y A8 uno por uno.
    const r = resumenDelExpediente(
      {},
      { A4: { data: { var_i_sistema_entrega: "solo construcción" } } },
    );
    expect(r.sistemaEntrega).toBe("solo construcción");
  });

  it("el paso gana sobre la columna cuando ambos tienen valor", () => {
    // La columna es una copia; el paso es lo que se firma.
    const r = resumenDelExpediente(
      { sistema_contratacion: "viejo" },
      { A4: { data: { var_i_sistema_entrega: "nuevo" } } },
    );
    expect(r.sistemaEntrega).toBe("nuevo");
  });

  it("cae a la columna si el paso no lo tiene", () => {
    const r = resumenDelExpediente({ sistema_contratacion: "de la columna" }, {});
    expect(r.sistemaEntrega).toBe("de la columna");
  });

  it("sin dato en ninguno de los dos devuelve null, no una cadena vacía", () => {
    // La fila se pinta como "—" y se atenúa; una cadena vacía la dejaría en
    // blanco como si el valor fuera legítimamente vacío.
    const r = resumenDelExpediente({ sistema_contratacion: "   " }, { A4: { data: {} } });
    expect(r.sistemaEntrega).toBeNull();
  });

  it("compone la aprobación igual que la columna", () => {
    const r = resumenDelExpediente(
      {},
      { A8: { data: { autoridad: "aga", numero_documento: "RES-014-2026" } } },
    );
    expect(r.aprobacion).toBe("AGA — RES-014-2026");
  });

  it("compone la certificación desde A7", () => {
    const r = resumenDelExpediente({}, { A7: { data: { numero_ccp: "123", monto_ccp: "45000" } } });
    expect(r.certificacionPresupuestal).toBe("N° 123 — S/ 45000");
  });

  it("un expediente sin hitos no revienta", () => {
    const r = resumenDelExpediente({}, null);
    expect(r.sistemaEntrega).toBeNull();
    expect(r.aprobacion).toBeNull();
  });
});
