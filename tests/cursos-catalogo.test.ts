import { describe, expect, it } from "vitest";
import {
  CURSOS, avance, buscarClase, buscarCurso, claseParaSeguir, clasesEnOrden, duracionTotal, formatoDuracion, hrefBaseLegal, textoBaseLegal, vecinas,
} from "@/lib/cursos/catalogo";
import { rutaCanonicaCursos } from "@/lib/cursos/ruta-canonica";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ROMANO = /^[IVXL]+$/;

describe("catálogo de cursos", () => {
  for (const curso of CURSOS) {
    const clases = clasesEnOrden(curso);

    it(`${curso.slug}: slugs válidos y únicos en todo el curso`, () => {
      expect(curso.slug).toMatch(SLUG);
      for (const s of curso.secciones) expect(s.slug, s.slug).toMatch(SLUG);
      const slugs = clases.map((c) => c.slug);
      for (const s of slugs) expect(s, s).toMatch(SLUG);
      expect(new Set(slugs).size).toBe(slugs.length);
      expect(new Set(clases.map((c) => c.modulo)).size, "módulos repetidos").toBe(clases.length);
    });

    it(`${curso.slug}: toda clase tiene resumen, puntos clave y base legal`, () => {
      for (const c of clases) {
        expect(c.modulo, c.slug).toMatch(ROMANO);
        expect(c.descripcion.length, c.slug).toBeGreaterThan(60);
        expect(c.minutos, c.slug).toBeGreaterThan(0);
        expect(c.contenido.resumen.length, c.slug).toBeGreaterThanOrEqual(2);
        for (const b of c.contenido.resumen) {
          expect(b.pregunta.trim().endsWith("?"), `${c.slug}: «${b.pregunta}»`).toBe(true);
          expect(b.parrafos.length, c.slug).toBeGreaterThan(0);
        }
        expect(c.contenido.puntosClave.length, c.slug).toBeGreaterThanOrEqual(3);
        expect(c.contenido.baseLegal.length, c.slug).toBeGreaterThan(0);
      }
    });

    it(`${curso.slug}: cada artículo citado en el texto figura en la base legal`, () => {
      // Si el resumen menciona «Art. 64» o «artículo 64», ese artículo tiene que estar en la base legal: así el enlace
      // a la norma existe para todo lo que la clase afirma.
      for (const c of clases) {
        const texto = [...c.contenido.resumen.flatMap((b) => b.parrafos), ...c.contenido.puntosClave].join(" ");
        const citados = [...texto.matchAll(/\b(?:Art\.|artículo)\s+(\d+)/g)].map((m) => m[1]);
        const declarados = new Set(c.contenido.baseLegal.map((b) => b.articulo));
        for (const a of citados) expect(declarados.has(a), `${c.slug} cita el Art. ${a} sin declararlo`).toBe(true);
      }
    });

    it(`${curso.slug}: cada sección cierra con un punto de control en el simulador`, () => {
      for (const s of curso.secciones) {
        expect(s.clases.length, s.slug).toBeGreaterThan(0);
        expect(s.puntoControl.href.startsWith("/simulador"), s.slug).toBe(true);
      }
      expect(curso.examenFinal.href.startsWith("/simulador")).toBe(true);
    });

    it(`${curso.slug}: la numeración es correlativa y no reinicia por sección`, () => {
      clases.forEach((c, i) => expect(buscarClase(curso, c.slug)?.numero, c.slug).toBe(i + 1));
    });

    it(`${curso.slug}: anterior y siguiente encadenan todas las clases`, () => {
      expect(vecinas(curso, clases[0].slug).anterior).toBeNull();
      expect(vecinas(curso, clases.at(-1)!.slug).siguiente).toBeNull();
      for (let i = 1; i < clases.length; i++) {
        expect(vecinas(curso, clases[i].slug).anterior?.slug).toBe(clases[i - 1].slug);
        expect(vecinas(curso, clases[i - 1].slug).siguiente?.slug).toBe(clases[i].slug);
      }
    });
  }

  it("el taller OECE tiene las 4 secciones y las 18 clases del aula, en su orden", () => {
    const c = buscarCurso("certificacion-oece")!;
    expect(c.secciones.map((s) => s.clases.length)).toEqual([7, 3, 5, 3]);
    expect(clasesEnOrden(c).map((x) => x.modulo)).toEqual([
      "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "X", "XI", "XII", "XIV", "XV", "XVI", "XVIII", "IX", "XIII", "XVII",
    ]);
    expect(duracionTotal(c)).toBeGreaterThan(0);
  });

  it("el avance ignora slugs que no son del curso", () => {
    const c = buscarCurso("certificacion-oece")!;
    const [primera, segunda] = clasesEnOrden(c);
    expect(avance(c, new Set([primera.slug, "otra-cosa"]))).toEqual({ hechas: 1, total: 18, porcentaje: 6 });
    expect(claseParaSeguir(c, new Set([primera.slug])).slug).toBe(segunda.slug);
    expect(claseParaSeguir(c, new Set(clasesEnOrden(c).map((x) => x.slug))).slug).toBe(primera.slug);
  });

  it("un slug desconocido no rompe", () => {
    const c = buscarCurso("certificacion-oece")!;
    expect(buscarCurso("no-existe")).toBeNull();
    expect(buscarClase(c, "no-existe")).toBeNull();
    expect(vecinas(c, "no-existe")).toEqual({ anterior: null, siguiente: null });
  });

  it("normaliza /Cursos a minúscula sin redirigir la ruta que ya es canónica", () => {
    expect(rutaCanonicaCursos("/Cursos")).toBe("/cursos");
    expect(rutaCanonicaCursos("/Cursos/Certificacion-OECE/garantias")).toBe("/cursos/certificacion-oece/garantias");
    expect(rutaCanonicaCursos("/CURSOS/")).toBe("/cursos/");
    // La ruta canónica no se redirige: es lo que hacía bucle con redirects() de next.config.
    expect(rutaCanonicaCursos("/cursos")).toBeNull();
    expect(rutaCanonicaCursos("/cursos/certificacion-oece")).toBeNull();
    // Otras rutas, ni con mayúsculas.
    expect(rutaCanonicaCursos("/Cursosx")).toBeNull();
    expect(rutaCanonicaCursos("/Normas")).toBeNull();
  });

  it("formatea duraciones y enlaces a la norma", () => {
    expect(formatoDuracion(45)).toBe("45 min");
    expect(formatoDuracion(120)).toBe("2 h");
    expect(formatoDuracion(135)).toBe("2 h 15 min");
    expect(hrefBaseLegal({ norma: "Reglamento", articulo: "54" })).toMatch(/^\/normas\?documentId=[0-9a-f-]{36}&article=54$/);
    expect(textoBaseLegal({ norma: "Ley 32069", articulo: "64" })).toBe("Ley 32069 · Art. 64");
    expect(textoBaseLegal({ norma: "Reglamento", articulo: "DCT-1" })).toBe(
      "Reglamento de la Ley 32069 · Primera Disposición Complementaria Transitoria",
    );
  });
});
