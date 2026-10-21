import { describe, expect, it } from "vitest";
import {
  ACREDITACION_PERSONAL_CLAVE,
  formatPersonalClave,
  parsePersonalClave,
  personalClaveIncompletas,
} from "@/lib/personal-clave";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";
import { LIMITES_TEXTO, necesidadUpdateSchema } from "@/lib/necesidades";

/**
 * Experiencia del personal clave (Art. 72.3.b). Es una LISTA de puestos —cada
 * uno con su tiempo mínimo, la actividad y el cargo—, serializada en una columna
 * y pintada como cuadro, igual que «otras penalidades».
 */
const FILAS = [
  { actividad: "Estructuras metálicas", cantidad: "1", tiempo: "tres (3) años", trabajos: "supervisión de montaje de estructuras metálicas", puesto: "Ingeniero residente" },
  { actividad: "Control de calidad", cantidad: "2", tiempo: "dos (2) años", trabajos: "control de calidad de soldadura", puesto: "Supervisor de calidad" },
];
const vacia = { actividad: "", cantidad: "", tiempo: "", trabajos: "", puesto: "" };

describe("la lista se serializa y se vuelve a leer sin perder nada", () => {
  it("el par parse/format es reversible", () => {
    expect(parsePersonalClave(formatPersonalClave(FILAS))).toEqual(FILAS);
  });

  it("numera las filas y etiqueta cada campo, con actividad y cantidad delante", () => {
    const t = formatPersonalClave(FILAS);
    expect(t).toContain("1. Actividad: Estructuras metálicas · Cantidad: 1 · Tiempo: tres (3) años · Prestaciones: supervisión de montaje de estructuras metálicas · Puesto: Ingeniero residente");
    expect(t).toContain("2. Actividad: Control de calidad · Cantidad: 2 ·");
  });

  it("sin filas útiles no compone nada: el requisito puede no aplicar", () => {
    expect(formatPersonalClave([])).toBe("");
    expect(formatPersonalClave([{ ...vacia }])).toBe("");
    expect(parsePersonalClave("")).toEqual([]);
    expect(parsePersonalClave(null)).toEqual([]);
  });

  it("una fila con algo escrito se conserva, con corchete donde falta", () => {
    const t = formatPersonalClave([{ ...vacia, tiempo: "un (1) año" }]);
    expect(t).toContain("Actividad: [POR DEFINIR] · Cantidad: [POR DEFINIR] · Tiempo: un (1) año · Prestaciones: [POR DEFINIR] · Puesto: [POR DEFINIR]");
  });

  it("una fila con solo la actividad también es una fila", () => {
    expect(formatPersonalClave([{ ...vacia, actividad: "Estructuras" }])).toContain("Actividad: Estructuras ·");
  });

  it("un texto que no es del formato no aporta filas", () => {
    expect(parsePersonalClave("una frase suelta cualquiera")).toEqual([]);
  });
});

describe("filas a medio declarar", () => {
  it("se cuentan para avisar, sin bloquear", () => {
    expect(personalClaveIncompletas(FILAS)).toEqual([]);
    // Falta prestaciones: el núcleo del requisito. La actividad/cantidad no cuentan.
    expect(personalClaveIncompletas([{ ...vacia, tiempo: "3 años", puesto: "Residente" }])).toEqual([1]);
    expect(personalClaveIncompletas([{ ...vacia }])).toEqual([]);
    // Solo actividad/cantidad (el encuadre), sin tiempo/trabajos/puesto: no se marca.
    expect(personalClaveIncompletas([{ ...vacia, actividad: "Estructuras", cantidad: "2" }])).toEqual([]);
  });
});

describe("está en la ficha, en 3.5.1, oculta y como cuadro", () => {
  const seccion = FICHA_SECCIONES.find((s) => s.title === "3.5 Requisitos de calificación y/o precalificación")!;
  const campo = seccion.fields.find((f) => f.api === "personalClaveExperiencia");

  it("existe, es oculta y su kind la pinta como cuadro", () => {
    // Oculta: no se pinta suelta; el editor de requisitos la pinta dentro de la
    // tarjeta de experiencia del postor. `kind: "personalClave"` → tabla en Word.
    expect(campo?.oculto).toBe(true);
    expect(campo?.kind).toBe("personalClave");
  });

  it("los tres huecos de una sola fila ya no existen: ahora es una lista", () => {
    for (const api of ["personalClaveTiempo", "personalClaveTrabajos", "personalClavePuesto"]) {
      expect(FICHA_SECCIONES.flatMap((s) => s.fields).map((f) => f.api), api).not.toContain(api);
    }
  });

  it("el esquema acepta la lista serializada: sin esto el guardado responde 400", () => {
    const r = necesidadUpdateSchema.safeParse({ personalClaveExperiencia: formatPersonalClave(FILAS) });
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
  });

  it("un cuadro razonable cabe en el tope del campo", () => {
    const muchas = Array.from({ length: 8 }, () => FILAS[0]);
    expect(formatPersonalClave(muchas).length).toBeLessThanOrEqual(LIMITES_TEXTO.personalClaveExperiencia);
  });

  it("la acreditación del personal clave es un campo aparte, oculto, y va al Word", () => {
    const acr = seccion.fields.find((f) => f.api === "personalClaveAcreditacion");
    expect(acr?.oculto).toBe(true);
    expect(acr?.kind).toBe("textarea");
  });

  it("el texto estándar cita el Anexo 19, los 25 años y el traslape", () => {
    expect(ACREDITACION_PERSONAL_CLAVE).toContain("Anexo N° 19");
    expect(ACREDITACION_PERSONAL_CLAVE).toContain("veinticinco años anteriores a la fecha de la presentación de ofertas");
    expect(ACREDITACION_PERSONAL_CLAVE).toContain("solo se considera una vez el periodo traslapado");
    expect(ACREDITACION_PERSONAL_CLAVE).toContain("En ningún caso corresponde exigir que el mismo personal clave acredite experiencia en más de un cargo");
  });

  it("el editor lo compone con «Redactar con IA» y lo escribe por api", async () => {
    const { readFileSync } = await import("node:fs");
    const editor = readFileSync("app/components/requisitos-calificacion-editor.tsx", "utf-8");
    expect(editor).toContain("ACREDITACION_PERSONAL_CLAVE");
    expect(editor).toContain('onCampoFicha("personalClaveAcreditacion", ACREDITACION_PERSONAL_CLAVE)');
  });

  it("el editor lo pinta en su sección propia (capacidad_tecnica), con «Agregar»", async () => {
    // Se vigila el fuente porque el suite no monta React. El bloque se movió de
    // «Experiencia del postor» a su sección propia «Requisitos de calificación
    // adicionales» (el tipo capacidad_tecnica), entre Experiencia y Consorcio.
    const { readFileSync } = await import("node:fs");
    const editor = readFileSync("app/components/requisitos-calificacion-editor.tsx", "utf-8");
    expect(editor).toContain("PersonalClaveEditor");
    expect(editor).toContain('tipo.key === "capacidad_tecnica" && estado !== "no" && onCampoFicha');
    const comp = readFileSync("app/components/personal-clave-editor.tsx", "utf-8");
    expect(comp).toContain("Agregar personal clave");
  });
});
