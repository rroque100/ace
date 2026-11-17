import { describe, expect, it } from "vitest";
import { CERTIFICACION_OECE } from "@/lib/cursos/certificacion-oece";
import { clasesEnOrden } from "@/lib/cursos/catalogo";
import { CLASES_TEMA, claseParaTema } from "@/lib/cursos/clases-tema";

describe("mapa tema→clase del curso", () => {
  it("cada fila es una (clase, tema) real del catálogo, en orden del curso", () => {
    const clases = clasesEnOrden(CERTIFICACION_OECE);
    const orden = new Map(clases.map((c, i) => [c.slug, i]));
    let anterior = -1;
    for (const [i, fila] of CLASES_TEMA.entries()) {
      const clase = clases.find((c) => c.slug === fila.slug);
      expect(clase, fila.slug).toBeTruthy();
      expect(clase!.temas, fila.slug).toContain(fila.tema);
      const pos = orden.get(fila.slug)!;
      expect(pos, fila.slug).toBeGreaterThanOrEqual(anterior);
      if (pos === anterior) {
        // Dos temas de la misma clase conservan el orden en que la clase los declara.
        const previa = CLASES_TEMA[i - 1];
        const clasePrev = clases.find((c) => c.slug === previa.slug)!;
        expect((clase!.temas as readonly string[]).indexOf(fila.tema), fila.slug).toBeGreaterThan(
          (clasePrev.temas as readonly string[]).indexOf(previa.tema),
        );
      }
      anterior = pos;
    }
  });

  it("cubre todos los temas declarados y ninguno más", () => {
    const clases = clasesEnOrden(CERTIFICACION_OECE);
    const esperadas = clases.flatMap((c) => c.temas.map((t) => `${c.slug}:${t}`)).sort();
    const filas = CLASES_TEMA.map((f) => `${f.slug}:${f.tema}`).sort();
    expect(filas).toEqual(esperadas);
  });

  it("resuelve la primera clase del curso que enseña el tema pedido", () => {
    expect(claseParaTema("2.8")?.slug).toBe("recurso-apelacion");
    expect(claseParaTema("1.2")?.slug).toBe("segmentacion-contrataciones");
    expect(claseParaTema("9.9")).toBeNull();
  });
});
