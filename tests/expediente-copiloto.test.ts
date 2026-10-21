import { describe, expect, it } from "vitest";
import type { CampoFormulario } from "@/lib/actuaciones-preparatorias";
import {
  camposAplicables,
  peticionRedaccion,
  peticionRedaccionA2,
  resumenEstadoExpediente,
} from "@/lib/expediente-copiloto";
import type { HitosMap } from "@/lib/procurement-fases";

/**
 * Copiloto del expediente · iteración 2. La parte determinista: qué apartados de
 * A3 se ofrecen a la IA y cómo se aplican las propuestas (solo a los huecos).
 */

const campos = [
  { name: "descripcion", label: "Alcance", tipo: "textarea", baseLegal: "Art. 44.2.a", required: true },
  { name: "finalidad_publica", label: "Finalidad pública", tipo: "textarea", baseLegal: "Art. 44.1", required: true },
  { name: "objeto_contractual", label: "Objeto", tipo: "select" },
  { name: "plazo_dias", label: "Plazo", tipo: "number", baseLegal: "Art. 126.2" },
  { name: "estandarizado", label: "Estandarizado", tipo: "select" },
] as CampoFormulario[];

describe("peticionRedaccion", () => {
  it("solo ofrece a la IA los apartados de texto largo (textarea)", () => {
    const { camposObjetivo } = peticionRedaccion("A3", campos, {});
    expect(camposObjetivo.map((c) => c.api)).toEqual(["descripcion", "finalidad_publica"]);
    // Cada objetivo lleva su ancla legal, para que el RAG se ancle al artículo.
    expect(camposObjetivo.find((c) => c.api === "finalidad_publica")?.baseLegal).toBe("Art. 44.1");
    expect(camposObjetivo[0].seccion).toContain("Art. 44");
    expect(camposObjetivo[0].obligatorio).toBe(true);
  });

  it("la sección se ancla al artículo del paso: A3 → Art. 44, A4 → Art. 46", () => {
    expect(peticionRedaccion("A3", campos, {}).camposObjetivo[0].seccion).toContain("Art. 44");
    expect(peticionRedaccion("A4", campos, {}).camposObjetivo[0].seccion).toContain("Art. 46");
  });

  it("los apartados ya rellenos viajan como contexto (camposLlenos), no se re-proponen a la fuerza", () => {
    const { camposObjetivo, camposLlenos } = peticionRedaccion("A3", campos, {
      descripcion: "Suministro de cemento.",
    });
    expect(camposObjetivo).toHaveLength(2); // todos los textarea, con valor o sin él
    expect(camposLlenos).toEqual([
      { key: "descripcion", label: "Alcance", valor: "Suministro de cemento." },
    ]);
  });

  it("los vacíos o en blanco no cuentan como llenos", () => {
    const { camposLlenos } = peticionRedaccion("A3", campos, { descripcion: "   ", finalidad_publica: "" });
    expect(camposLlenos).toEqual([]);
  });
});

describe("peticionRedaccionA2 · narrativa del Informe de Segmentación", () => {
  it("ofrece los cinco apartados de análisis (A2 no tiene esquema de campos)", () => {
    const { camposObjetivo } = peticionRedaccionA2({});
    expect(camposObjetivo.map((c) => c.api)).toEqual([
      "justificacion",
      "continuidad",
      "riesgoMercado",
      "estrategiaMitigacion",
      "puntoControl",
    ]);
    expect(camposObjetivo[0].seccion).toContain("Art. 125");
    expect(camposObjetivo.find((c) => c.api === "estrategiaMitigacion")?.baseLegal).toContain("125.4");
  });

  it("lo ya escrito viaja como contexto, no se re-propone", () => {
    const { camposLlenos } = peticionRedaccionA2({ justificacion: "Amplia pluralidad de proveedores." });
    expect(camposLlenos).toEqual([
      { key: "justificacion", label: "Justificación de la categoría de segmentación", valor: "Amplia pluralidad de proveedores." },
    ]);
  });
});

describe("resumenEstadoExpediente · fuente de verdad del chat", () => {
  const COMPLETO: HitosMap = {
    A1: { data: { en_cmn: true }, status: "hecho" },
    A3: { data: { estandarizado: false }, status: "hecho" },
    A4: { data: {}, status: "hecho" },
    A5: { data: {}, status: "hecho" },
    A6: { data: {}, status: "hecho" },
    A7: { data: { monto: 285_924 }, status: "hecho" },
  };
  const VALOR = 285_924;

  it("enumera el estado de los 10 pasos y la cuantía", () => {
    const r = resumenEstadoExpediente(COMPLETO, VALOR);
    expect(r).toContain("A1: hecho");
    expect(r).toContain("A2: pendiente");
    expect(r).toContain("285,924"); // la cuantía, en su formato
  });

  it("un expediente completo dice que puede aprobarse", () => {
    expect(resumenEstadoExpediente(COMPLETO, VALOR)).toContain("puede aprobarse");
  });

  it("lista los literales pendientes: sin evaluadores, falta el 54.2.e", () => {
    const sinA6 = { ...COMPLETO, A6: { data: {}, status: "pendiente" as const } };
    const r = resumenEstadoExpediente(sinA6, VALOR);
    expect(r).toContain("54.2.e");
    expect(r).not.toContain("puede aprobarse");
  });

  it("sin cuantía lo dice y remite a A5", () => {
    const r = resumenEstadoExpediente(COMPLETO, null);
    expect(r).toContain("aún no fijada");
    expect(r).toContain("interacción con el mercado, A5");
  });
});

describe("camposAplicables", () => {
  it("solo aplica a los apartados VACÍOS: rellena huecos, no pisa lo escrito", () => {
    const propuesta = { descripcion: "Texto propuesto A", finalidad_publica: "Texto propuesto B" };
    const a3 = { descripcion: "ya escrito por la DEC" };
    expect(camposAplicables(propuesta, a3)).toEqual({ finalidad_publica: "Texto propuesto B" });
  });

  it("ignora propuestas vacías", () => {
    expect(camposAplicables({ descripcion: "   ", finalidad_publica: "X" }, {})).toEqual({
      finalidad_publica: "X",
    });
  });
});
