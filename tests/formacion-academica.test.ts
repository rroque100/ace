import { describe, expect, it } from "vitest";
import {
  ACREDITACION_FORMACION_ACADEMICA,
  componerRequisitoFormacion,
  formacionIncompletas,
  formatFilasFormacion,
  parseFilasFormacion,
} from "@/lib/formacion-academica";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";
import { LIMITES_TEXTO, necesidadUpdateSchema } from "@/lib/necesidades";

/**
 * Formación académica del personal clave (Art. 72.3.b, C.2.1). Es una LISTA de
 * requisitos —un puesto por fila— serializada en una columna; en el Word sale
 * como cuadro y el texto de cada fila se compone con su grado y su puesto.
 */
const FILAS = [
  { actividad: "Estructuras metálicas", grado: "Título profesional de Ingeniero Civil", puesto: "Ingeniero residente" },
  { actividad: "Control de calidad", grado: "Bachiller en Contabilidad", puesto: "Especialista en costos" },
];
const vacia = { actividad: "", grado: "", puesto: "" };

describe("el requisito de una fila se compone con sus dos campos", () => {
  it("en el orden del formato", () => {
    expect(componerRequisitoFormacion(FILAS[0])).toBe(
      "Título profesional de Ingeniero Civil del personal clave requerido como Ingeniero residente.",
    );
  });

  it("un hueco sin rellenar conserva su corchete", () => {
    expect(componerRequisitoFormacion({ grado: "Bachiller" })).toContain(
      "Bachiller del personal clave requerido como [CONSIGNAR EL PERSONAL CLAVE REQUERIDO",
    );
    expect((componerRequisitoFormacion({}).match(/\[CONSIGNAR/g) ?? []).length).toBe(2);
  });
});

describe("la lista se serializa y se vuelve a leer sin perder nada", () => {
  it("el par parse/format es reversible", () => {
    expect(parseFilasFormacion(formatFilasFormacion(FILAS))).toEqual(FILAS);
  });

  it("numera y etiqueta cada fila, con la actividad heredada delante", () => {
    const t = formatFilasFormacion(FILAS);
    expect(t).toContain("1. Actividad: Estructuras metálicas · Grado: Título profesional de Ingeniero Civil · Puesto: Ingeniero residente");
    expect(t).toContain("2. Actividad: Control de calidad · Grado: Bachiller en Contabilidad ·");
  });

  it("sin filas útiles no compone nada", () => {
    expect(formatFilasFormacion([])).toBe("");
    expect(formatFilasFormacion([{ ...vacia }])).toBe("");
    expect(parseFilasFormacion("")).toEqual([]);
    expect(parseFilasFormacion("una frase suelta")).toEqual([]);
  });

  it("una fila con solo la actividad heredada también es una fila", () => {
    expect(formatFilasFormacion([{ ...vacia, actividad: "Estructuras" }])).toContain("Actividad: Estructuras ·");
  });
});

describe("filas a medio declarar", () => {
  it("la actividad viene heredada y no cuenta; se marca al empezar grado o puesto", () => {
    expect(formacionIncompletas(FILAS)).toEqual([]);
    // Solo la actividad heredada: aún no se ha tocado, NO se marca (era el bug).
    expect(formacionIncompletas([{ actividad: "Estructuras", grado: "", puesto: "" }])).toEqual([]);
    // En cuanto se escribe el grado pero falta el puesto, sí se marca.
    expect(formacionIncompletas([{ actividad: "Estructuras", grado: "Bachiller", puesto: "" }])).toEqual([1]);
    expect(formacionIncompletas([{ ...vacia }])).toEqual([]);
  });
});

describe("está en la ficha, en 3.5.1, oculta y como cuadro", () => {
  const campo = FICHA_SECCIONES.find((s) => s.title === "3.5 Requisitos de calificación y/o precalificación")!
    .fields.find((f) => f.api === "formacionAcademica");

  it("existe, oculta, kind formacionAcademica (tabla en Word)", () => {
    expect(campo?.oculto).toBe(true);
    expect(campo?.kind).toBe("formacionAcademica");
  });

  it("el esquema acepta la lista serializada", () => {
    const r = necesidadUpdateSchema.safeParse({ formacionAcademica: formatFilasFormacion(FILAS) });
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
  });

  it("un cuadro razonable cabe en el tope del campo", () => {
    const muchas = Array.from({ length: 6 }, () => FILAS[0]);
    expect(formatFilasFormacion(muchas).length).toBeLessThanOrEqual(LIMITES_TEXTO.formacionAcademica);
  });

  it("la acreditación de la formación es un campo aparte, oculto, y va al Word", () => {
    const acr = FICHA_SECCIONES.find((s) => s.title === "3.5 Requisitos de calificación y/o precalificación")!
      .fields.find((f) => f.api === "formacionAcademicaAcreditacion");
    expect(acr?.oculto).toBe(true);
    expect(acr?.kind).toBe("textarea");
  });

  it("el texto estándar cita el Anexo 19, la SUNEDU y el MINEDU con sus links", () => {
    expect(ACREDITACION_FORMACION_ACADEMICA).toContain("Anexo N° 19");
    expect(ACREDITACION_FORMACION_ACADEMICA).toContain("SUNEDU");
    expect(ACREDITACION_FORMACION_ACADEMICA).toContain("https://enlinea.sunedu.gob.pe/");
    expect(ACREDITACION_FORMACION_ACADEMICA).toContain("https://titulosinstitutos.minedu.gob.pe/");
  });

  it("el editor lo compone con «Redactar con IA» y lo escribe por api", async () => {
    const { readFileSync } = await import("node:fs");
    const editor = readFileSync("app/components/requisitos-calificacion-editor.tsx", "utf-8");
    expect(editor).toContain("ACREDITACION_FORMACION_ACADEMICA");
    expect(editor).toContain('onCampoFicha("formacionAcademicaAcreditacion", ACREDITACION_FORMACION_ACADEMICA)');
  });

  it("hereda las actividades del cuadro de experiencia del personal clave", async () => {
    // Las filas se copian del cuadro de experiencia (Art. 72.3.b): una por
    // actividad, mismo orden. El editor lee las actividades de ese cuadro.
    const { readFileSync } = await import("node:fs");
    const editor = readFileSync("app/components/requisitos-calificacion-editor.tsx", "utf-8");
    expect(editor).toContain("FormacionAcademicaEditor");
    expect(editor).toContain("parsePersonalClave(personalClaveExperiencia");
    expect(editor).toContain(".map((f) => f.actividad)");
    const comp = readFileSync("app/components/formacion-academica-editor.tsx", "utf-8");
    // Una fila por actividad heredada, en orden, con grado/puesto por índice.
    expect(comp).toContain("actividades.map((actividad, i) => ({");
    expect(comp).toContain("grado: guardadas[i]?.grado ?? \"\"");
  });
});
