import { describe, expect, it } from "vitest";
import { CURSOS, clasesEnOrden } from "@/lib/cursos/catalogo";
import { FICHA_CIFRAS } from "@/lib/cursos/ficha-cifras";
import { GLOSARIO, buscarSigla } from "@/lib/cursos/glosario";

// Palabras en mayúsculas que no son siglas: énfasis en el texto y el sufijo de los decretos supremos («001-2026-EF»).
const NO_SON_SIGLAS = new Set(["EF", "DENEGADA", "NO", "SÍ"]);
const ROMANO = /^[IVXLC]+$/;

function textosDelCurso(): string[] {
  const textos: string[] = [];
  for (const curso of CURSOS) {
    for (const c of clasesEnOrden(curso)) {
      const k = c.contenido;
      textos.push(c.titulo, c.descripcion, ...k.puntosClave);
      for (const r of k.resumen) textos.push(r.pregunta, ...r.parrafos);
      for (const caso of k.casuisticas ?? []) textos.push(caso.enunciado, caso.resolucion);
    }
  }
  for (const g of FICHA_CIFRAS) for (const d of g.datos) textos.push(d.tema, d.dato);
  return textos;
}

describe("glosario de siglas", () => {
  it("toda sigla que usa el curso está en el glosario", () => {
    const siglas = new Set(
      textosDelCurso().flatMap((t) => t.match(/(?<![\p{L}\d-])\p{Lu}{2,}(?![\p{L}\d])/gu) ?? []),
    );
    for (const s of siglas) {
      if (NO_SON_SIGLAS.has(s) || ROMANO.test(s)) continue;
      expect(buscarSigla(s), `«${s}» se usa en el curso y no está en el glosario`).not.toBeNull();
    }
  });

  it("no repite siglas y cada una tiene significado", () => {
    const vistas = GLOSARIO.map((s) => s.sigla.toLowerCase());
    expect(new Set(vistas).size).toBe(vistas.length);
    for (const s of GLOSARIO) expect(s.significado.length, s.sigla).toBeGreaterThan(3);
  });

  it("recoge el régimen vigente (Art. 3.1 del Reglamento) y no las siglas del anterior", () => {
    for (const s of ["OECE", "Pladicop", "TCP", "DEC", "PAC del CMN", "UIT", "JPRD"]) {
      expect(buscarSigla(s)?.fuente, s).toEqual({ norma: "Reglamento", articulo: "3" });
    }
    expect(buscarSigla("OSCE")).toBeNull();
  });
});
