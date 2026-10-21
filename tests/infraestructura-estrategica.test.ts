import { describe, expect, it } from "vitest";
import { ACREDITACION_INFRAESTRUCTURA, REQUISITO_INFRAESTRUCTURA } from "@/lib/infraestructura-estrategica";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";
import { estructuraDelRequerimiento } from "@/lib/requerimiento-estructura";
import { necesidadUpdateSchema } from "@/lib/necesidades";

/**
 * Infraestructura estratégica (Art. 72.3.b, C.3). No es cuadro: dos textos del
 * formato —el requisito, con su hueco, y su acreditación—.
 */
describe("los textos son los del formato", () => {
  it("el requisito es el hueco del formato (entre corchetes)", () => {
    expect(REQUISITO_INFRAESTRUCTURA).toMatch(/^\[CONSIGNAR SOLO LA INFRAESTRUCTURA CLASIFICADA COMO ESTRATÉGICA/);
    expect(REQUISITO_INFRAESTRUCTURA).toContain("SEGÚN LA ESTRATEGIA DE CONTRATACIÓN, QUE DEBE SER ACREDITADA");
  });

  it("la acreditación trae la copia de documentos y la advertencia del consorcio", () => {
    expect(ACREDITACION_INFRAESTRUCTURA).toContain(
      "Copia simple de los documentos que sustenten la propiedad, la posesión, el compromiso de compraventa o alquiler",
    );
    expect(ACREDITACION_INFRAESTRUCTURA).toContain("acredite la disponibilidad de la infraestructura estratégica");
    expect(ACREDITACION_INFRAESTRUCTURA).toContain(
      "En el caso que el postor sea un consorcio los documentos de acreditación de este requisito pueden estar a nombre del consorcio",
    );
  });

  it("la advertencia va en viñeta: el Word la convierte en bullet", () => {
    const bullets = ACREDITACION_INFRAESTRUCTURA.split("\n").filter((l) => l.startsWith("- "));
    expect(bullets).toHaveLength(1);
  });
});

describe("está en la ficha (3.5.1), oculto, y va al documento", () => {
  const seccion = FICHA_SECCIONES.find((s) => s.title === "3.5 Requisitos de calificación y/o precalificación")!;

  it("los dos campos existen y son ocultos", () => {
    for (const api of ["infraestructuraEstrategica", "infraestructuraEstrategicaAcreditacion"]) {
      const f = seccion.fields.find((x) => x.api === api);
      expect(f?.oculto, api).toBe(true);
      expect(f?.kind, api).toBe("textarea");
    }
  });

  it("el esquema los acepta", () => {
    const r = necesidadUpdateSchema.safeParse({
      infraestructuraEstrategica: "Un laboratorio de suelos acreditado",
      infraestructuraEstrategicaAcreditacion: ACREDITACION_INFRAESTRUCTURA,
    });
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
  });

  it("aunque ocultos, entran en el requerimiento con valor", () => {
    const secciones = estructuraDelRequerimiento([], {
      infraestructuraEstrategica: "Un laboratorio de suelos acreditado",
      infraestructuraEstrategicaAcreditacion: ACREDITACION_INFRAESTRUCTURA,
    });
    const apis = secciones.flatMap((s) => s.campos).map((c) => c.api);
    expect(apis).toContain("infraestructuraEstrategica");
    expect(apis).toContain("infraestructuraEstrategicaAcreditacion");
  });

  it("el editor los compone con «Redactar con IA»", async () => {
    const { readFileSync } = await import("node:fs");
    const editor = readFileSync("app/components/requisitos-calificacion-editor.tsx", "utf-8");
    expect(editor).toContain('onCampoFicha("infraestructuraEstrategica", REQUISITO_INFRAESTRUCTURA)');
    expect(editor).toContain('onCampoFicha("infraestructuraEstrategicaAcreditacion", ACREDITACION_INFRAESTRUCTURA)');
    expect(editor).toContain(">C.4 Infraestructura estratégica<");
  });
});
