import { describe, expect, it } from "vitest";
import {
  CURSOS, avance, buscarClase, buscarCurso, claseParaSeguir, clasesEnOrden, duracionTotal, estadoClase, formatoDuracion, hrefBaseLegal,
  textoBaseLegal, vecinas, vistaProgreso,
} from "@/lib/cursos/catalogo";
import { rutaCanonicaCursos } from "@/lib/cursos/ruta-canonica";
import { FICHA_CIFRAS } from "@/lib/cursos/ficha-cifras";
import { PREGUNTAS_EXAMEN, preguntasCompetencia, temaExamen, temasDeClase, temasSinClase, textoPeso } from "@/lib/cursos/temario-examen";

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

    it(`${curso.slug}: cada competencia cierra con práctica en el simulador; los complementos no`, () => {
      for (const s of curso.secciones) {
        expect(s.clases.length, s.slug).toBeGreaterThan(0);
        if (s.competencia) expect(s.puntoControl?.href.startsWith("/simulador"), s.slug).toBe(true);
        else expect(s.puntoControl, s.slug).toBeUndefined();
      }
      expect(curso.examenFinal.href.startsWith("/simulador")).toBe(true);
    });

    it(`${curso.slug}: cada clase trabaja temas oficiales de la competencia de su sección`, () => {
      for (const s of curso.secciones) {
        for (const c of s.clases) {
          for (const code of c.temas) expect(temaExamen(code), `${c.slug}: ${code}`).not.toBeNull();
          if (s.competencia) {
            expect(c.temas.length, `${c.slug} no declara temas del examen`).toBeGreaterThan(0);
            for (const t of temasDeClase(c)) expect(t.competency, `${c.slug}: ${t.code} es de otra competencia`).toBe(s.competencia);
          } else {
            expect(c.temas, `${c.slug} está en complementos pero declara temas del examen`).toEqual([]);
          }
        }
      }
    });

    it(`${curso.slug}: las competencias van en el orden del temario y los complementos al final`, () => {
      const orden = curso.secciones.map((s) => s.competencia ?? "complementos");
      expect(orden).toEqual(["1", "2", "3", "complementos"]);
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

  it("el curso OECE sigue las competencias del temario oficial", () => {
    const c = buscarCurso("certificacion-oece")!;
    expect(c.secciones.map((s) => s.clases.length)).toEqual([9, 5, 10, 2]);
    expect(clasesEnOrden(c).map((x) => x.modulo)).toEqual([
      "I", "IV", "V", "VI", "XXIV", "XXV", "XXVI", "III", "VII",
      "X", "II", "XIX", "XI", "XII",
      "XIII", "XV", "XX", "XIV", "XXI", "XVI", "XVIII", "XXII", "XVII", "XXIII",
      "VIII", "IX",
    ]);
    // El examen evalúa el perfeccionamiento en Selección (2.9 y 2.10), no en Ejecución.
    expect(buscarClase(c, "perfeccionamiento-contrato")?.seccion.competencia).toBe("2");
    expect(duracionTotal(c)).toBeGreaterThan(0);
  });

  it("el examen tiene 72 preguntas: 25 + 22 + 25", () => {
    expect(PREGUNTAS_EXAMEN).toBe(72);
    expect((["1", "2", "3"] as const).map(preguntasCompetencia)).toEqual([25, 22, 25]);
    expect(textoPeso(13)).toBe("≈13 de 72 preguntas");
    expect(textoPeso(1)).toBe("≈1 de 72 preguntas");
  });

  it("los temas oficiales sin clase solo pueden disminuir", () => {
    // Trinquete de la alineación con el temario (docs/superpowers/plans/2026-11-17-cursos-alineacion-temario-oece.md).
    // Al crear la clase de un tema, sácalo de esta lista; si aparece uno nuevo aquí, una clase perdió su tema.
    // 2.4, 2.5, 3.9 y 3.12 salieron con las clases de refuerzo XIX, XXI y XXIII.
    const PENDIENTES = ["1.4", "1.8", "2.3", "2.6", "3.4", "3.7", "3.8", "3.11"];
    expect(temasSinClase(buscarCurso("certificacion-oece")!).map((t) => t.code)).toEqual(PENDIENTES);
  });

  it("las reglas vigentes tras el D.S. 001-2026-EF están en el contenido", () => {
    // Contradicciones del análisis de coherencia (docs/evaluaciones/2026-11-17-coherencia-simulador-curso.md, §2):
    // el curso enseñaba la regla anterior o la general sin su excepción, y el banco evalúa la vigente.
    const todo = JSON.stringify(buscarCurso("certificacion-oece"));
    // 42.3 sustituido: con la necesidad en el CMN, la DEC segmenta al recibir el requerimiento.
    expect(todo).toContain("luego de la recepción del requerimiento");
    // 42.5: catálogos electrónicos, no competitivos y supuestos excluidos no se segmentan.
    expect(todo).toContain("no se segmentan");
    // 302.1 y 302.3: la AGA resuelve de forma indelegable; nulidad de oficio y cancelación, siempre ante el TCP.
    expect(todo).toContain("indelegable");
    expect(todo).toContain("con independencia de la cuantía");
    // 60.4: con negociación o diálogo competitivo, el jurado conduce las rondas.
    expect(todo).toContain("el jurado conduce las rondas");
    // 295.1: en el MDA no aplican segmentación ni interacción con el mercado.
    expect(todo).toContain("sin segmentación ni interacción con el mercado");
    // 14.2.a con 59.5.c y 60.3: la DEC no registra lo que corresponde a los evaluadores.
    expect(todo).toContain("los comités registran sus actas");
    // 108.3: el silencio de la entidad DENIEGA la subcontratación (no la aprueba).
    expect(todo).toContain("se entiende denegada");
    // 51.3 modificado: la absolución de la difusión del requerimiento es en 6 días hábiles (antes, 3).
    expect(todo).toContain("absuelven en un máximo de 6 días hábiles");
    // 52.1.b: por ítems, cada contratación individual debe superar la cuantía de un contrato menor.
    expect(todo).toContain("supere la de un contrato menor");
  });

  it("toda clase trae al menos tres casos tipo examen con su base legal", () => {
    // El examen pregunta casos, no definiciones: el banco del simulador es casi todo casuística.
    for (const c of clasesEnOrden(buscarCurso("certificacion-oece")!)) {
      expect(c.contenido.casuisticas?.length ?? 0, c.slug).toBeGreaterThanOrEqual(3);
      for (const caso of c.contenido.casuisticas ?? []) {
        expect(caso.enunciado.length, c.slug).toBeGreaterThan(40);
        expect(caso.resolucion.length, c.slug).toBeGreaterThan(40);
        expect(caso.baseLegal.length, c.slug).toBeGreaterThan(0);
        // Lo que sostiene el caso tiene que estar en la base legal de la clase (y por tanto verificado con ella).
        const declarada = new Set(c.contenido.baseLegal.map((b) => `${b.norma}|${b.articulo}`));
        for (const b of caso.baseLegal) {
          expect(declarada.has(`${b.norma}|${b.articulo}`), `${c.slug}: caso cita ${b.norma} Art. ${b.articulo} fuera de su base legal`).toBe(true);
        }
      }
    }
  });

  it("la ficha de cifras solo cita lo que respalda una clase verificada del curso", () => {
    const c = buscarCurso("certificacion-oece")!;
    const datos = FICHA_CIFRAS.flatMap((g) => g.datos);
    expect(datos.length).toBeGreaterThan(10);
    expect(new Set(datos.map((d) => d.tema)).size, "temas repetidos en la ficha").toBe(datos.length);
    for (const g of FICHA_CIFRAS) {
      for (const d of g.datos) {
        const encontrada = buscarClase(c, d.clase);
        expect(encontrada, `${d.tema}: la clase ${d.clase} no existe`).not.toBeNull();
        expect(encontrada!.clase.contenido.verificada, `${d.tema}: ${d.clase} no está verificada`).toBe(true);
        // El grupo de la ficha es la competencia de la sección donde vive la clase.
        expect(encontrada!.seccion.competencia ?? null, `${d.tema}: grupo equivocado`).toBe(g.competencia);
        const declarada = new Set(encontrada!.clase.contenido.baseLegal.map((b) => `${b.norma}|${b.articulo}`));
        for (const b of d.base) {
          expect(declarada.has(`${b.norma}|${b.articulo}`), `${d.tema}: ${b.norma} Art. ${b.articulo} no está en la clase`).toBe(true);
        }
      }
    }
  });

  it("los temas de una clase salen del más pesado al más ligero; a igual peso, en el orden declarado", () => {
    const c = buscarCurso("certificacion-oece")!;
    expect(temasDeClase(buscarClase(c, "plan-anual-contrataciones")!.clase).map((t) => t.code)).toEqual(["1.6", "1.5"]);
    expect(temasDeClase(buscarClase(c, "procedimientos-seleccion")!.clase).map((t) => t.code)).toEqual(["2.2", "2.1"]);
    expect(temasDeClase(buscarClase(c, "actos-preparatorios")!.clase)).toMatchObject([{ code: "1.2", quota: 13 }]);
  });

  it("el avance ignora slugs que no son del curso", () => {
    const c = buscarCurso("certificacion-oece")!;
    const [primera, segunda] = clasesEnOrden(c);
    expect(avance(c, new Set([primera.slug, "otra-cosa"]))).toEqual({ hechas: 1, total: 26, porcentaje: 4 });
    expect(claseParaSeguir(c, new Set([primera.slug])).slug).toBe(segunda.slug);
    expect(claseParaSeguir(c, new Set(clasesEnOrden(c).map((x) => x.slug))).slug).toBe(primera.slug);
  });

  it("el panel de progreso numera todo el curso y marca completada / viendo ahora", () => {
    const c = buscarCurso("certificacion-oece")!;
    const [primera, segunda, tercera] = clasesEnOrden(c);
    const v = vistaProgreso(c, new Set([primera.slug, segunda.slug]), segunda.slug);
    expect(v).toMatchObject({ hechas: 2, total: 26, porcentaje: 8 });
    const clases = v.secciones.flatMap((s) => s.clases);
    expect(clases.map((x) => x.numero)).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
    expect(clases[0].estado).toBe("completada");
    // La abierta se ve «Viendo ahora» aunque ya esté completada.
    expect(clases[1].estado).toBe("actual");
    expect(clases[2]).toMatchObject({ slug: tercera.slug, estado: "pendiente" });
    expect(v.secciones[0].hechas).toBe(2);
    // No viaja el contenido de las clases al cliente.
    expect(JSON.stringify(v)).not.toContain("puntosClave");
  });

  it("estadoClase sin clase abierta", () => {
    expect(estadoClase("a", new Set(["a"]))).toBe("completada");
    expect(estadoClase("b", new Set(["a"]))).toBe("pendiente");
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
