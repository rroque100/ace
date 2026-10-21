import { describe, expect, it } from "vitest";
import {
  insumosDeInteraccion,
  puedeCerrarEstrategia,
  sustentoNormativoN,
} from "@/lib/interaccion-insumo";

describe("insumo de la interacción (A5) hacia la estrategia (A4)", () => {
  it("no inventa avisos cuando A5 está vacío", () => {
    // Un aviso vacío deja de significar algo y se ignora.
    expect(insumosDeInteraccion({})).toEqual({});
  });

  it("lleva la cuantía actualizada a la variable k) del Art. 46.1", () => {
    const r = insumosDeInteraccion({
      cuantia_actualizada: 125_400.5,
      resultado_cuantia: "Tres cotizaciones bajaron el estimado",
    });
    expect(r.var_k_financiamiento_cuantia).toContain("S/ 125,400.50");
    expect(r.var_k_financiamiento_cuantia).toContain("Tres cotizaciones");
  });

  it("ignora una cuantía sin actualizar", () => {
    expect(insumosDeInteraccion({ cuantia_actualizada: 0 })).toEqual({});
  });

  it("traduce el nivel a su etiqueta en la variable n)", () => {
    const r = insumosDeInteraccion({ nivel: "consulta_mercado_avanzada", fuentes: "PLADICOP" });
    expect(r.var_n_tipo_interaccion).toContain("Consulta al mercado avanzada");
    expect(r.var_n_tipo_interaccion).toContain("PLADICOP");
    // El value crudo no debe filtrarse a la vista.
    expect(r.var_n_tipo_interaccion).not.toContain("consulta_mercado_avanzada");
  });

  it("no revienta con un nivel desconocido", () => {
    const r = insumosDeInteraccion({ nivel: "inventado", fuentes: "SEACE" });
    expect(r.var_n_tipo_interaccion).toContain("SEACE");
  });

  it("lleva riesgos y competencia a la variable s)", () => {
    const r = insumosDeInteraccion({
      resultado_competencia: "Solo dos proveedores en la región",
      resultado_riesgos: "Plazo de importación de 60 días",
    });
    expect(r.var_s_objetivo).toContain("Plazo de importación");
    expect(r.var_s_objetivo).toContain("Solo dos proveedores");
  });
});

describe("cierre de la estrategia (Art. 46.1 + 47.1)", () => {
  it("no deja cerrar A4 con la interacción pendiente o a medias", () => {
    // Cerrar la estrategia sin la interacción es sustentar las variables con
    // información que todavía no se ha recogido.
    expect(puedeCerrarEstrategia(undefined)).toBe(false);
    expect(puedeCerrarEstrategia("pendiente")).toBe(false);
    expect(puedeCerrarEstrategia("en_curso")).toBe(false);
  });

  it("deja cerrar A4 con la interacción hecha", () => {
    expect(puedeCerrarEstrategia("hecho")).toBe(true);
  });

  it("deja cerrar A4 si la interacción no aplica", () => {
    // Contratos menores y catálogos electrónicos de acuerdo marco.
    expect(puedeCerrarEstrategia("na")).toBe(true);
  });
});

// n) El sustento normativo se siembra en A4 y VARÍA con A2 (categorización) y
// A5 (nivel realizado), citando los artículos aplicables.
describe("sustentoNormativoN (texto normativo de n)", () => {
  it("cita el Art. 46.1.n y encabeza la categorización y el nivel", () => {
    const t = sustentoNormativoN(null, null);
    expect(t).toContain("artículo 46.1.n del Reglamento");
    expect(t).toContain("La categorización del objeto de la contratación y el nivel de interacción");
  });

  it("con A2 y A5 refleja la categoría, el nivel mínimo y el nivel realizado", () => {
    // Bienes/servicios, cuantía baja, sin riesgo → Rutinaria (indagación básica).
    const t = sustentoNormativoN(
      { objeto: "bienes_servicios", cuantiaAlta: false, condicionesRiesgo: [] },
      { nivel: "consulta_mercado_basica" },
    );
    expect(t).toContain("Rutinaria");
    expect(t).toContain("artículos 42 y 125 del Reglamento"); // segmentación bienes/servicios
    expect(t).toContain("artículos 48 al 50 del Reglamento"); // niveles de interacción
    expect(t).toContain("Se realizó: Consulta al mercado básica."); // nivel de A5
  });

  it("en obras cita el artículo 153", () => {
    const t = sustentoNormativoN({ objeto: "obras_consultoria_obras", cuantiaAlta: false }, {});
    expect(t).toContain("artículos 42 y 153 del Reglamento");
  });

  it("devuelve NO CORRESPONDE si el nivel realizado no supera el mínimo (numeral 127.2)", () => {
    // Rutinaria → mínimo indagación básica; A5 realiza indagación básica (= mínimo):
    // no se subió de nivel, así que el sustento de un «nivel más avanzado» de B129 no
    // corresponde (es lo que también escribe el export).
    const t = sustentoNormativoN(
      { objeto: "bienes_servicios", cuantiaAlta: false, condicionesRiesgo: [] },
      { nivel: "indagacion_basica" },
    );
    expect(t).toBe("NO CORRESPONDE");
  });

  it("sin A2/A5 deja los huecos señalados en vez de inventar datos", () => {
    const t = sustentoNormativoN(null, null);
    expect(t).toContain("[pendiente");
    expect(t).toContain("Se realizó: [registrar el nivel");
  });
});
