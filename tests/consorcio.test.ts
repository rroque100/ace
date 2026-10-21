import { describe, expect, it } from "vitest";
import {
  ACREDITACION_CONSORCIO,
  CONDICIONES_CONSORCIO_VACIO,
  MENSAJE_CONSORCIO,
  componerConsorcio,
  parseConsorcio,
} from "@/lib/consorcio";

/**
 * Condiciones de participación en consorcio (Art. 72.3.d). Tres casillas
 * —D.1/D.2/D.3— con su número; se incluyen «una o más». Se compone en el detalle
 * del tipo `consorcio` y se relee de él.
 */
describe("compone según las casillas marcadas", () => {
  it("las tres, con sus números y el «%» donde toca", () => {
    const t = componerConsorcio({ d1: true, n1: "2", d2: true, n2: "30", d3: true, n3: "40" });
    expect(t).toContain("D.1. El número máximo de consorciados es de 2.");
    expect(t).toContain("D.2. El porcentaje mínimo de participación de cada consorciado es de 30%.");
    expect(t).toContain(
      "D.3. El porcentaje mínimo de participación en la ejecución del contrato, para el integrante del consorcio que acredite mayor experiencia, es de 40%.",
    );
  });

  it("solo las marcadas aparecen", () => {
    const t = componerConsorcio({ d1: false, n1: "", d2: true, n2: "25", d3: false, n3: "" });
    expect(t).not.toContain("D.1.");
    expect(t).toContain("D.2.");
    expect(t).not.toContain("D.3.");
  });

  it("una casilla marcada sin número conserva su corchete", () => {
    const t = componerConsorcio({ ...CONDICIONES_CONSORCIO_VACIO, d1: true });
    expect(t).toContain("es de [CONSIGNAR EL NÚMERO MÁXIMO DE INTEGRANTES DEL CONSORCIO");
  });

  it("sin ninguna marcada, sale el mensaje del formato", () => {
    expect(componerConsorcio(CONDICIONES_CONSORCIO_VACIO)).toBe(MENSAJE_CONSORCIO);
  });
});

describe("relee las casillas y sus números del requisito", () => {
  it("el par compone/parse es reversible", () => {
    const c = { d1: true, n1: "3", d2: false, n2: "", d3: true, n3: "51" };
    expect(parseConsorcio(componerConsorcio(c))).toEqual(c);
  });

  it("el corchete no cuenta como número", () => {
    const parsed = parseConsorcio(componerConsorcio({ ...CONDICIONES_CONSORCIO_VACIO, d2: true }));
    expect(parsed.d2).toBe(true);
    expect(parsed.n2).toBe("");
  });

  it("el mensaje no marca ninguna", () => {
    expect(parseConsorcio(MENSAJE_CONSORCIO)).toEqual(CONDICIONES_CONSORCIO_VACIO);
    expect(parseConsorcio("")).toEqual(CONDICIONES_CONSORCIO_VACIO);
  });
});

describe("el editor lo usa para el tipo consorcio", () => {
  it("la acreditación es el texto fijo del formato", () => {
    expect(ACREDITACION_CONSORCIO).toBe("Se acredita con la promesa de consorcio.");
  });

  it("el tipo consorcio pinta el ConsorcioEditor, no un textarea de detalle", async () => {
    const { readFileSync } = await import("node:fs");
    const editor = readFileSync("app/components/requisitos-calificacion-editor.tsx", "utf-8");
    expect(editor).toContain("ConsorcioEditor");
    expect(editor).toContain('tipo.key === "consorcio" && estado !== "no"');
    expect(editor).toContain('editar("consorcio", "acreditacion", ACREDITACION_CONSORCIO)');
  });
});
