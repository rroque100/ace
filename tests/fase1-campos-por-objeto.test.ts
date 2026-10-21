import { describe, expect, it } from "vitest";
import { PASOS_F1 } from "@/lib/actuaciones-preparatorias";
import { regimenDe } from "@/lib/regimen-seleccion";
import { aplicabilidadHito } from "@/lib/aplicabilidad-fases";
import { esNoCompetitivo, PROCESO_NO_COMPETITIVO } from "@/lib/procesos-seleccion";

const OBJETOS = ["bien", "servicio", "obra", "consultoria_obra"];

const campos = Object.values(PASOS_F1).flatMap((p) => p.campos ?? []);
const campo = (name: string) => campos.find((c) => c.name === name);

describe("mostrarParaObjeto", () => {
  it("solo usa objetos del vocabulario de A3", () => {
    for (const c of campos) {
      for (const o of c.mostrarParaObjeto ?? []) expect(OBJETOS).toContain(o);
    }
  });

  it("acota las prestaciones accesorias a bienes y obras (Art. 44.4)", () => {
    expect(campo("prestaciones_accesorias")?.mostrarParaObjeto).toEqual(["bien", "obra"]);
  });

  it("acota las condiciones de obra a obra y consultoría de obra", () => {
    expect(campo("condiciones_obra")?.mostrarParaObjeto).toEqual(["obra", "consultoria_obra"]);
  });

  it("ningún campo queda acotado a una lista vacía", () => {
    // Una lista vacía escondería el campo para TODO objeto, que es borrarlo por
    // la puerta de atrás en vez de quitarlo del catálogo.
    for (const c of campos) {
      if (c.mostrarParaObjeto) expect(c.mostrarParaObjeto.length).toBeGreaterThan(0);
    }
  });
});

describe("régimen anticipado por la ficha (Art. 101.1)", () => {
  it("reconoce el valor del catálogo", () => {
    expect(esNoCompetitivo(PROCESO_NO_COMPETITIVO)).toBe(true);
    expect(esNoCompetitivo("Licitación Pública para Bienes")).toBe(false);
    expect(esNoCompetitivo(null)).toBe(false);
  });

  it("es no competitivo con la ficha aunque A1 aún no registre la causal", () => {
    expect(regimenDe({}, PROCESO_NO_COMPETITIVO)).toBe("no_competitivo");
    expect(regimenDe({})).toBe("competitivo");
  });

  it("excluye A2 desde la ficha, y no toca los pasos que sí aplican", () => {
    expect(aplicabilidadHito("A2", { tipoProceso: PROCESO_NO_COMPETITIVO }).estado).toBe("no_aplica");
    expect(aplicabilidadHito("A3", { tipoProceso: PROCESO_NO_COMPETITIVO }).estado).toBe("aplica");
    expect(aplicabilidadHito("A2", { tipoProceso: "Licitación Pública para Bienes" }).estado).toBe(
      "aplica",
    );
  });
});
