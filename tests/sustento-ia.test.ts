import { describe, expect, it } from "vitest";
import {
  CAMPOS_SUSTENTO,
  citaNormaLegal,
  datosDelExpediente,
  esCampoSustento,
  promptSustento,
} from "@/lib/sustento-ia";

const CTX = {
  denominacion: "ADQUISICION DE SERVIDOR PARA EL SIGA-MEF",
  objeto: "bienes",
  procedimiento: "licitacion_publica_abreviada",
  categoria: "Crítico",
  valorEstimado: 285_924,
  plazoDias: 6,
};

describe("datosDelExpediente · el contexto sale de lo registrado", () => {
  it("traduce el procedimiento a su etiqueta legible", () => {
    expect(datosDelExpediente(CTX)).toContain("Licitación pública abreviada");
    // No se le pasa la clave interna: al modelo no le dice nada.
    expect(datosDelExpediente(CTX)).not.toContain("licitacion_publica_abreviada");
  });

  it("incluye la cuantía formateada y el plazo", () => {
    const d = datosDelExpediente(CTX);
    expect(d).toContain("S/ 285,924.00");
    expect(d).toContain("6 días");
  });

  it("omite lo que no está registrado en vez de inventarlo", () => {
    const d = datosDelExpediente({ objeto: "bienes" });
    expect(d).toBe("- Objeto contractual: bienes");
    expect(datosDelExpediente({})).toBe("");
  });

  it("un valor estimado ausente o cero no se imprime", () => {
    expect(datosDelExpediente({ ...CTX, valorEstimado: null })).not.toContain("Valor estimado");
    expect(datosDelExpediente({ ...CTX, valorEstimado: 0 })).not.toContain("Valor estimado");
  });
});

describe("promptSustento", () => {
  it("prohíbe citar normas: las citas del expediente salen de código", () => {
    for (const campo of Object.keys(CAMPOS_SUSTENTO) as (keyof typeof CAMPOS_SUSTENTO)[]) {
      const p = promptSustento(campo, CTX);
      expect(p).toContain("NO cites artículos");
    }
  });

  it("prohíbe inventar datos y acota el formato de salida", () => {
    const p = promptSustento("objetivo", CTX);
    expect(p).toContain("ÚNICAMENTE los datos de arriba");
    expect(p).toContain("No inventes cifras");
    expect(p).toContain("Un solo párrafo");
  });

  it("lleva el elemento concreto que se sustenta", () => {
    const p = promptSustento("factor", { ...CTX, detalle: "Plazo de entrega o ejecución" });
    expect(p).toContain("ELEMENTO A SUSTENTAR: Plazo de entrega o ejecución");
  });

  it("sin datos registrados lo dice en vez de callarlo", () => {
    expect(promptSustento("objetivo", {})).toContain("No hay datos registrados todavía");
  });

  it("el sustento del factor es consciente del procedimiento y del valor por dinero", () => {
    const p = promptSustento("factor", { ...CTX, detalle: "Experiencia del postor" });
    expect(p).toContain("Licitación pública abreviada"); // el procedimiento viaja en el contexto
    expect(p).toContain("procedimiento de selección"); // y la tarea lo tiene en cuenta
    expect(p).toContain("valor por el dinero");
    expect(p).toContain("competencia");
    expect(p).toContain("NO cites artículos"); // sigue sin citar
  });

  it("con un borrador base, parte de él y ordena mejorarlo (no copiarlo)", () => {
    const p = promptSustento("factor", { ...CTX, detalle: "Precio", base: "La oferta económica es factor." });
    expect(p).toContain("BORRADOR DE PARTIDA");
    expect(p).toContain("La oferta económica es factor.");
    expect(p).toMatch(/MEJÓRALO|no lo copies/i);
    expect(p).toContain("NO cites artículos"); // la regla anti-cita sigue
  });

  it("sin base no añade la sección de borrador", () => {
    expect(promptSustento("factor", { ...CTX, detalle: "Precio" })).not.toContain("BORRADOR DE PARTIDA");
  });
});

describe("esCampoSustento · la lista es cerrada", () => {
  it("acepta solo los campos previstos", () => {
    expect(esCampoSustento("objetivo")).toBe(true);
    expect(esCampoSustento("factor")).toBe(true);
    expect(esCampoSustento("punto_no_negociable")).toBe(true);
  });

  it("rechaza cualquier otro, incluidos los que sí decide el código", () => {
    expect(esCampoSustento("var_a_procedimiento")).toBe(false);
    expect(esCampoSustento("cuantia")).toBe(false);
    expect(esCampoSustento("")).toBe(false);
    expect(esCampoSustento(undefined)).toBe(false);
    expect(esCampoSustento("constructor")).toBe(false);
  });
});

describe("citaNormaLegal · red de seguridad", () => {
  it("detecta la cita que el prompt prohíbe", () => {
    expect(citaNormaLegal("Conforme al artículo 72.3 del Reglamento, el postor…")).toBe(true);
    expect(citaNormaLegal("Según el Art. 46 de la norma…")).toBe(true);
    expect(citaNormaLegal("De acuerdo con la Ley N° 32069…")).toBe(true);
    expect(citaNormaLegal("Lo previsto en el numeral 3 del citado cuerpo legal")).toBe(true);
    expect(citaNormaLegal("conforme al D.S. 009-2025-EF")).toBe(true);
  });

  it("no salta con un párrafo técnico sin citas", () => {
    expect(
      citaNormaLegal(
        "El plazo de entrega resulta determinante para la continuidad operativa del sistema, por lo que se evalúa como factor.",
      ),
    ).toBe(false);
  });
});
