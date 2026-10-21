import { describe, expect, it } from "vitest";
import {
  type AdelantoDirecto,
  componerAdelantoDirecto,
  parseAdelantoDirecto,
  PLANTILLA_ADELANTO_OBRA,
  TEXTO_NO_CORRESPONDE,
} from "@/lib/adelanto-directo";

/**
 * Apartado e): se elige una opción y el par componer/parse debe ser reversible,
 * o el editor perdería la elección al reabrir la ficha.
 */
describe("adelanto directo · componer ↔ parse", () => {
  it("«No corresponde» va y vuelve como su propia modalidad", () => {
    const datos: AdelantoDirecto = { modalidad: "no_corresponde", detalle: "" };
    const texto = componerAdelantoDirecto(datos);
    expect(texto).toBe(TEXTO_NO_CORRESPONDE);
    expect(parseAdelantoDirecto(texto)).toEqual(datos);
  });

  it("«se otorga» conserva el detalle", () => {
    const datos: AdelantoDirecto = {
      modalidad: "otorga",
      detalle: "La entidad otorgará 1 adelanto directo por el 30% del monto del contrato original.",
    };
    const leido = parseAdelantoDirecto(componerAdelantoDirecto(datos));
    expect(leido.modalidad).toBe("otorga");
    expect(leido.detalle).toBe(datos.detalle);
  });

  it("un texto libre antiguo se lee como «se otorga» (no se pierde)", () => {
    const leido = parseAdelantoDirecto("Hasta 30% del monto del contrato");
    expect(leido.modalidad).toBe("otorga");
    expect(leido.detalle).toBe("Hasta 30% del monto del contrato");
  });

  it("vacío no tiene modalidad y no compone nada", () => {
    expect(parseAdelantoDirecto("").modalidad).toBeNull();
    expect(parseAdelantoDirecto(null).modalidad).toBeNull();
    expect(componerAdelantoDirecto({ modalidad: null, detalle: "" })).toBe("");
  });
});

describe("plantilla de obras · topes y plazo del régimen de obras (Arts. 178-179)", () => {
  it("distingue el tope por sistema de entrega: 10% y 30% del componente de diseño", () => {
    expect(PLANTILLA_ADELANTO_OBRA).toMatch(/10\s*%/);
    expect(PLANTILLA_ADELANTO_OBRA).toMatch(/30\s*%/);
    expect(PLANTILLA_ADELANTO_OBRA).toMatch(/solo construcci[oó]n/i);
    expect(PLANTILLA_ADELANTO_OBRA).toMatch(/dise[ñn]o y construcci[oó]n/i);
    expect(PLANTILLA_ADELANTO_OBRA).toMatch(/178/);
  });

  it("fija el plazo de diez días (Art. 179), propio de obras y no de bienes/servicios", () => {
    expect(PLANTILLA_ADELANTO_OBRA).toMatch(/diez \(10\) d[ií]as/i);
    expect(PLANTILLA_ADELANTO_OBRA).toMatch(/179/);
  });
});
