import { describe, expect, it } from "vitest";
import { ACREDITACION_EQUIPAMIENTO, REQUISITO_EQUIPAMIENTO } from "@/lib/equipamiento-estrategico";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";
import { estructuraDelRequerimiento } from "@/lib/requerimiento-estructura";
import { necesidadUpdateSchema } from "@/lib/necesidades";

/**
 * Equipamiento estratégico (Art. 72.3.b, C.3). No es cuadro: dos textos del
 * formato —el requisito, con su hueco, y su acreditación—.
 */
describe("los textos son los del formato", () => {
  it("el requisito es el hueco del formato (entre corchetes)", () => {
    expect(REQUISITO_EQUIPAMIENTO).toMatch(/^\[CONSIGNAR SOLO EL EQUIPAMIENTO CLASIFICADO COMO ESTRATÉGICO/);
    expect(REQUISITO_EQUIPAMIENTO).toContain("SEGÚN LA ESTRATEGIA DE CONTRATACIÓN, QUE DEBE SER ACREDITADA");
  });

  it("la acreditación trae la copia de documentos y la advertencia del consorcio", () => {
    expect(ACREDITACION_EQUIPAMIENTO).toContain(
      "Copia simple de los documentos que sustenten la propiedad, la posesión, el compromiso de compraventa o alquiler",
    );
    expect(ACREDITACION_EQUIPAMIENTO).toContain("acredite la disponibilidad del equipamiento estratégico");
    expect(ACREDITACION_EQUIPAMIENTO).toContain(
      "En el caso que el postor sea un consorcio los documentos de acreditación de este requisito pueden estar a nombre del consorcio",
    );
  });

  it("la advertencia va en viñeta: el Word la convierte en bullet", () => {
    const bullets = ACREDITACION_EQUIPAMIENTO.split("\n").filter((l) => l.startsWith("- "));
    expect(bullets).toHaveLength(1);
  });
});

describe("está en la ficha (3.5.1), oculto, y va al documento", () => {
  const seccion = FICHA_SECCIONES.find((s) => s.title === "3.5 Requisitos de calificación y/o precalificación")!;

  it("los dos campos existen y son ocultos", () => {
    for (const api of ["equipamientoEstrategico", "equipamientoEstrategicoAcreditacion"]) {
      const f = seccion.fields.find((x) => x.api === api);
      expect(f?.oculto, api).toBe(true);
      expect(f?.kind, api).toBe("textarea");
    }
  });

  it("el esquema los acepta", () => {
    const r = necesidadUpdateSchema.safeParse({
      equipamientoEstrategico: "Dos estaciones totales",
      equipamientoEstrategicoAcreditacion: ACREDITACION_EQUIPAMIENTO,
    });
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
  });

  it("aunque ocultos, entran en el requerimiento con valor", () => {
    const secciones = estructuraDelRequerimiento([], {
      equipamientoEstrategico: "Dos estaciones totales",
      equipamientoEstrategicoAcreditacion: ACREDITACION_EQUIPAMIENTO,
    });
    const apis = secciones.flatMap((s) => s.campos).map((c) => c.api);
    expect(apis).toContain("equipamientoEstrategico");
    expect(apis).toContain("equipamientoEstrategicoAcreditacion");
  });

  it("el editor los compone con «Redactar con IA»", async () => {
    const { readFileSync } = await import("node:fs");
    const editor = readFileSync("app/components/requisitos-calificacion-editor.tsx", "utf-8");
    expect(editor).toContain('onCampoFicha("equipamientoEstrategico", REQUISITO_EQUIPAMIENTO)');
    expect(editor).toContain('onCampoFicha("equipamientoEstrategicoAcreditacion", ACREDITACION_EQUIPAMIENTO)');
    expect(editor).toContain(">C.3 Equipamiento estratégico<");
  });
});
