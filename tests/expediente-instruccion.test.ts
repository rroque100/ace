import { describe, expect, it } from "vitest";
import {
  type DocumentoExpediente,
  avanzarEstado,
  inferirEstadoPorEvidencia,
  instruirExpediente,
} from "@/lib/expediente-instruccion";

function doc(kind: string, title = "Documento", status = "ready"): DocumentoExpediente {
  return { kind, title, status };
}

// Indices del ciclo unificado (11 etapas, ordenadas por `orden`):
// 0 necesidad · 1 actuaciones_preparatorias · 2 expediente · 3 aprobacion_aga
// 4 seleccion · 5 buena_pro · 6 contrato · 7 ejecucion · 8 conformidad
// 9 liquidacion · 10 archivo

describe("instruirExpediente (motor unificado sobre el ciclo de 11 etapas)", () => {
  it("evalúa las 11 etapas del ciclo", () => {
    const r = instruirExpediente({ documents: [] });
    expect(r.fases).toHaveLength(11);
    expect(r.totalFases).toBe(11);
    expect(r.fases.map((f) => f.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("cada fase expone responsable y participantes sin duplicar al responsable", () => {
    for (const fase of instruirExpediente({ documents: [] }).fases) {
      expect(typeof fase.responsable).toBe("string");
      expect(Array.isArray(fase.participantes)).toBe(true);
      expect(fase.participantes).not.toContain(fase.responsable);
    }
  });

  it("sin status ni documentos: la etapa actual es Necesidad y el progreso es 0", () => {
    const r = instruirExpediente({ documents: [] });
    expect(r.faseActualId).toBe("necesidad");
    expect(r.fases[0].estado).toBe("en_curso");
    expect(r.fases[0].esActual).toBe(true);
    expect(r.fases[1].estado).toBe("pendiente");
    expect(r.fasesCompletas).toBe(0);
    expect(r.progreso).toBe(0);
  });

  it("el status fija la etapa oficial en curso", () => {
    const r = instruirExpediente({ status: "seleccion", documents: [] });
    expect(r.faseActualId).toBe("seleccion");
    const seleccion = r.fases.find((f) => f.id === "seleccion");
    expect(seleccion?.estado).toBe("en_curso");
    expect(seleccion?.esActual).toBe(true);
  });

  it("marca como 'atención' una etapa pasada (por status) sin sus obligatorios", () => {
    // status = seleccion, pero falta el requerimiento de la etapa Necesidad (ya pasada).
    const r = instruirExpediente({ status: "seleccion", documents: [] });
    const necesidad = r.fases.find((f) => f.id === "necesidad");
    expect(necesidad?.estado).toBe("atencion");
    expect(necesidad?.alertas.length).toBeGreaterThan(0);
    // Una etapa pasada sin obligatorios (Actuaciones preparatorias) sí queda completa.
    expect(r.fases.find((f) => f.id === "actuaciones_preparatorias")?.estado).toBe("completa");
  });

  it("completa la etapa de Selección con bases, bases integradas y oferta", () => {
    const r = instruirExpediente({
      status: "seleccion",
      documents: [doc("bases"), doc("bases_integradas"), doc("oferta")],
    });
    const seleccion = r.fases.find((f) => f.id === "seleccion");
    expect(seleccion?.completa).toBe(true);
    expect(seleccion?.documentosFaltantes).toHaveLength(0);
  });

  it("la evaluación registrada cumple el requisito de acta de evaluación de Buena pro", () => {
    const docs = [doc("bases"), doc("bases_integradas"), doc("oferta")];
    const sinEval = instruirExpediente({ status: "buena_pro", documents: docs });
    const bpSin = sinEval.fases.find((f) => f.id === "buena_pro");
    expect(bpSin?.requisitos[0].cumplido).toBe(false);
    expect(bpSin?.completa).toBe(false);

    const conEval = instruirExpediente({ status: "buena_pro", documents: docs, evaluacionesCount: 1 });
    const bpCon = conEval.fases.find((f) => f.id === "buena_pro");
    // El acta de evaluación queda satisfecha por la evaluación, pero aún falta el
    // acta de otorgamiento de la buena pro.
    expect(bpCon?.requisitos[0].cumplido).toBe(true);
    expect(bpCon?.requisitos[1].cumplido).toBe(false);
    expect(bpCon?.completa).toBe(false);
  });

  it("distingue el acta de buena pro por el título", () => {
    const base = instruirExpediente({
      status: "buena_pro",
      documents: [doc("acta", "Acta de admisión de ofertas")],
    });
    const bp = base.fases.find((f) => f.id === "buena_pro");
    expect(bp?.requisitos[0].cumplido).toBe(true); // admisión / evaluación
    expect(bp?.requisitos[1].cumplido).toBe(false); // otorgamiento

    const conBuenaPro = instruirExpediente({
      status: "buena_pro",
      documents: [doc("acta", "Acta de admisión de ofertas"), doc("acta", "Acta de otorgamiento de la buena pro")],
    });
    expect(conBuenaPro.fases.find((f) => f.id === "buena_pro")?.requisitos[1].cumplido).toBe(true);
  });

  it("alerta cuando hay bases integradas sin bases originales", () => {
    const r = instruirExpediente({ status: "seleccion", documents: [doc("bases_integradas")] });
    expect(r.alertasSecuencia.some((a) => a.toLowerCase().includes("bases originales"))).toBe(true);
  });

  it("ignora documentos con status 'error'", () => {
    const r = instruirExpediente({ documents: [doc("requerimiento", "Requerimiento", "error")] });
    const necesidad = r.fases.find((f) => f.id === "necesidad");
    expect(necesidad?.requisitos[0].cumplido).toBe(false);
    expect(necesidad?.documentosFaltantes.some((d) => d.kind === "requerimiento")).toBe(true);
  });

  it("mapea 'desierto' a la etapa Buena pro", () => {
    const r = instruirExpediente({ status: "buena_pro", documents: [] });
    expect(r.faseActualId).toBe("buena_pro");
  });

  it("trata 'desierto' como salida terminal: Buena pro cerrada y etapas siguientes no aplican", () => {
    const r = instruirExpediente({ status: "desierto", documents: [doc("bases"), doc("bases_integradas"), doc("oferta")] });
    expect(r.desierto).toBe(true);
    expect(r.faseActualId).toBeNull();
    expect(r.fases.every((f) => !f.esActual)).toBe(true);
    expect(r.fases.find((f) => f.id === "buena_pro")?.estado).toBe("completa");
    for (const id of ["contrato", "ejecucion", "conformidad", "liquidacion", "archivo"]) {
      expect(r.fases.find((f) => f.id === id)?.estado).toBe("no_aplica");
    }
  });

  it("fuera de desierto, el flag es false", () => {
    expect(instruirExpediente({ status: "seleccion", documents: [] }).desierto).toBe(false);
  });
});

describe("inferirEstadoPorEvidencia", () => {
  it("sin evidencia devuelve null", () => {
    expect(inferirEstadoPorEvidencia({ documents: [] })).toBeNull();
  });

  it("infiere la etapa más avanzada justificada por los documentos", () => {
    expect(inferirEstadoPorEvidencia({ documents: [doc("requerimiento")] })).toBe("actuaciones_preparatorias");
    expect(inferirEstadoPorEvidencia({ documents: [doc("bases")] })).toBe("seleccion");
    expect(inferirEstadoPorEvidencia({ documents: [doc("oferta")] })).toBe("seleccion");
    expect(inferirEstadoPorEvidencia({ documents: [], evaluacionesCount: 1 })).toBe("seleccion");
    expect(
      inferirEstadoPorEvidencia({ documents: [doc("acta", "Acta de otorgamiento de buena pro")] }),
    ).toBe("buena_pro");
    expect(inferirEstadoPorEvidencia({ documents: [doc("contrato")] })).toBe("contrato");
  });

  it("ignora documentos en error", () => {
    expect(inferirEstadoPorEvidencia({ documents: [doc("contrato", "Contrato", "error")] })).toBeNull();
  });
});

describe("avanzarEstado (solo hacia adelante)", () => {
  it("avanza cuando la evidencia supera la etapa actual", () => {
    expect(avanzarEstado("necesidad", { documents: [doc("bases")] })).toBe("seleccion");
    expect(avanzarEstado(null, { documents: [doc("contrato")] })).toBe("contrato");
  });

  it("no retrocede ni cambia si la evidencia está por detrás o al nivel actual", () => {
    expect(avanzarEstado("buena_pro", { documents: [doc("bases")] })).toBeNull();
    expect(avanzarEstado("actuaciones_preparatorias", { documents: [doc("requerimiento")] })).toBeNull();
  });

  it("no toca el estado terminal 'desierto'", () => {
    expect(avanzarEstado("desierto", { documents: [doc("contrato")] })).toBeNull();
  });
});
