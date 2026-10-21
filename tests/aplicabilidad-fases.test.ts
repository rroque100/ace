import { describe, expect, it } from "vitest";
import {
  aplicabilidadHito,
  esAcuerdoMarco,
  familiaProcedimiento,
  pasosQueNoAplican,
  type ContextoExpediente,
} from "@/lib/aplicabilidad-fases";
import { HITOS } from "@/lib/procurement-fases";
import { PROCESOS_SELECCION } from "@/lib/procesos-seleccion";

const TODOS = HITOS.map((h) => h.code);

describe("familia del procedimiento", () => {
  it("clasifica todo el catálogo de la ficha sin dejar nada en 'indefinida'", () => {
    for (const p of PROCESOS_SELECCION) {
      if (!p.value) continue;
      expect(familiaProcedimiento(p.value), p.value).not.toBe("indefinida");
    }
  });

  it("distingue abreviadas de ordinarias", () => {
    expect(familiaProcedimiento("Licitación Pública para Bienes")).toBe("ordinaria");
    expect(familiaProcedimiento("Licitación Pública Abreviada para Bienes")).toBe("abreviada");
    expect(familiaProcedimiento("Comparación de Precios")).toBe("comparacion_precios");
    expect(familiaProcedimiento("Subasta Inversa Electrónica")).toBe("subasta_inversa");
  });

  it("la causal del Art. 55 acreditada en A1 manda sobre lo que anticipó la ficha", () => {
    // El régimen no se elige: se comprueba (Arts. 54.3 y 55.1).
    expect(familiaProcedimiento("Licitación Pública para Bienes", "b")).toBe("no_competitivo");
  });

  it("sin dato no clasifica", () => {
    expect(familiaProcedimiento("")).toBe("indefinida");
    expect(familiaProcedimiento(null)).toBe("indefinida");
  });
});

describe("sin datos no se descarta ningún paso", () => {
  it("un expediente sin objeto ni procedimiento ve las tres fases completas", () => {
    // Ocultar pasos por falta de información sería peor que mostrarlos de más.
    expect(pasosQueNoAplican(TODOS, {})).toEqual([]);
  });

  it("un procedimiento competitivo ordinario tampoco pierde pasos", () => {
    const ctx = { objeto: "bien", tipoProceso: "Licitación Pública para Bienes" };
    expect(pasosQueNoAplican(TODOS, ctx)).toEqual([]);
  });
});

describe("procedimientos no competitivos (Arts. 100-103)", () => {
  const ctx: ContextoExpediente = { tipoProceso: "Procedimiento de Selección No Competitivo" };

  it("descarta exactamente los pasos que la norma sustituye", () => {
    expect(pasosQueNoAplican(TODOS, ctx).sort()).toEqual(
      ["A2", "A6", "B2", "B3", "B4", "B6", "B7", "B8"].sort(),
    );
  });

  it("cada exclusión trae el artículo que la sostiene", () => {
    for (const code of pasosQueNoAplican(TODOS, ctx)) {
      expect(aplicabilidadHito(code, ctx).motivo, code).toMatch(/Art\.|artículo/i);
    }
  });

  it("A5 queda facultativo, no descartado", () => {
    // Los dos textos vivos del 101.1 no coinciden; ver el comentario del módulo.
    expect(aplicabilidadHito("A5", ctx).estado).toBe("facultativo");
  });

  it("la Fase 3 sigue entera: el Art. 103 solo pone excepciones, no la suprime", () => {
    for (const code of ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"]) {
      expect(aplicabilidadHito(code, ctx).estado, code).toBe("aplica");
    }
  });
});

describe("comparación de precios (Arts. 97-99)", () => {
  const ctx: ContextoExpediente = { objeto: "bien", tipoProceso: "Comparación de Precios" };

  it("no descarta ningún paso: el silencio de la norma no prohíbe", () => {
    expect(pasosQueNoAplican(TODOS, ctx)).toEqual([]);
  });

  it("marca facultativos los cuestionamientos a las bases", () => {
    expect(aplicabilidadHito("B3", ctx).estado).toBe("facultativo");
    expect(aplicabilidadHito("B4", ctx).estado).toBe("facultativo");
  });

  it("avisa de la invitación a tres proveedores y de la evaluación solo económica", () => {
    expect(aplicabilidadHito("B1", ctx).nota).toContain("tres proveedores");
    expect(aplicabilidadHito("B6", ctx).nota).toContain("económica");
  });
});

describe("subasta inversa electrónica (Art. 96)", () => {
  const ctx: ContextoExpediente = { objeto: "bien", tipoProceso: "Subasta Inversa Electrónica" };

  it("avisa de que no hay evaluación técnica", () => {
    expect(aplicabilidadHito("B6", ctx).nota).toContain("evaluación técnica");
  });

  it("avisa de que no caben requisitos de calificación fuera de la ficha técnica", () => {
    expect(aplicabilidadHito("A3", ctx).nota).toContain("96.2");
  });

  it("no descarta ningún paso", () => {
    expect(pasosQueNoAplican(TODOS, ctx)).toEqual([]);
  });
});

describe("contratos menores", () => {
  it("quedan fuera de la segmentación por el Art. 42.1", () => {
    const a = aplicabilidadHito("A2", { contratoMenor: true, tipoProceso: "" });
    expect(a.estado).toBe("no_aplica");
    expect(a.motivo).toContain("42.1");
  });

  it("A5 tampoco corresponde: la Guía excluye la interacción en contratos menores", () => {
    const a = aplicabilidadHito("A5", { contratoMenor: true, tipoProceso: "" });
    expect(a.estado).toBe("no_aplica");
    expect(a.motivo).toContain("No se realiza la interacción");
    expect(a.motivo).toMatch(/Contratos Menores/i);
  });

  it("la regla del contrato menor no depende de lo que diga la ficha", () => {
    const a = aplicabilidadHito("A2", {
      contratoMenor: true,
      tipoProceso: "Licitación Pública para Bienes",
    });
    expect(a.estado).toBe("no_aplica");
  });

  it("solo descarta los pasos que la norma sustituye", () => {
    const ctx: ContextoExpediente = { contratoMenor: true, tipoProceso: "" };
    expect(pasosQueNoAplican(TODOS, ctx).sort()).toEqual(["A2", "A5"].sort());
  });
});

describe("catálogos electrónicos de acuerdo marco (CEAM)", () => {
  it("reconoce el CEAM por el código del expediente y por el texto de la ficha", () => {
    expect(esAcuerdoMarco("acuerdo_marco")).toBe(true);
    expect(esAcuerdoMarco("Acuerdo marco")).toBe(true);
    expect(esAcuerdoMarco("Catálogos Electrónicos de Acuerdo Marco")).toBe(true);
    expect(esAcuerdoMarco(null, "Catálogos Electrónicos de Acuerdo Marco")).toBe(true);
    expect(esAcuerdoMarco(null, "Licitación Pública para Bienes")).toBe(false);
    expect(esAcuerdoMarco(null, null)).toBe(false);
  });

  it("no se segmenta: la Guía no incluye el CEAM entre las contrataciones a clasificar", () => {
    const a = aplicabilidadHito("A2", { acuerdoMarco: true });
    expect(a.estado).toBe("no_aplica");
    expect(a.motivo).toMatch(/acuerdo marco/i);
  });

  it("no hay interacción con el mercado", () => {
    const a = aplicabilidadHito("A5", { acuerdoMarco: true });
    expect(a.estado).toBe("no_aplica");
    expect(a.motivo).toContain("No se realiza la interacción");
  });

  it("descarta exactamente A2 y A5", () => {
    const ctx: ContextoExpediente = { acuerdoMarco: true };
    expect(pasosQueNoAplican(TODOS, ctx).sort()).toEqual(["A2", "A5"].sort());
  });

  it("un CEAM no deja de serlo porque la ficha anticipara un competitivo", () => {
    const a = aplicabilidadHito("A5", {
      acuerdoMarco: true,
      tipoProceso: "Licitación Pública para Bienes",
    });
    expect(a.estado).toBe("no_aplica");
  });
});

describe("eje por objeto en la ejecución contractual", () => {
  it("bienes y servicios reciben el Art. 144 en la conformidad", () => {
    expect(aplicabilidadHito("C6", { objeto: "bien" }).nota).toContain("144");
    expect(aplicabilidadHito("C6", { objeto: "servicio" }).nota).toContain("144");
  });

  it("obras no: van por el Título V y la liquidación del Art. 215", () => {
    expect(aplicabilidadHito("C6", { objeto: "obra" }).nota).toContain("215");
    expect(aplicabilidadHito("C8", { objeto: "obra" }).nota).toContain("215");
    expect(aplicabilidadHito("C7", { objeto: "obra" }).nota).toContain("valorizaciones");
  });

  it("un objeto desconocido no inventa notas", () => {
    expect(aplicabilidadHito("C6", { objeto: "bienes" }).nota).toBeUndefined();
  });

  it("un paso descartado no recibe instrucciones de cómo hacerlo", () => {
    // Explicar cómo se hace algo que no corresponde solo confunde.
    const a = aplicabilidadHito("B6", {
      objeto: "obra",
      tipoProceso: "Procedimiento de Selección No Competitivo",
    });
    expect(a.estado).toBe("no_aplica");
    expect(a.nota).toBeUndefined();
  });

  it("un paso que aplica acumula la nota del procedimiento y la del objeto", () => {
    const a = aplicabilidadHito("C5", {
      objeto: "obra",
      tipoProceso: "Procedimiento de Selección No Competitivo",
    });
    expect(a.nota).toContain("complementarias");
  });
});
