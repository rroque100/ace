import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { construirSustituciones, fusionarRuns, rellenarBasesDocx } from "@/lib/bases-docx-relleno";
import { nombrePlantillaDocx } from "@/lib/bases-docx-plantilla";
import { PLANTILLAS_BASES } from "@/lib/bases-plantillas";
import type { HitosMap } from "@/lib/procurement-fases";

const DIR = path.join(process.cwd(), "actuaciones-preparatorias", "bases");
const DOCX = path.join(DIR, "7614342-2-bases-estandar-licitacion-publica-abreviada-para-bienes.docx");

// Expediente real N° 52-DEC-MDCH-1 (madera tornillo), datos de A1-A8.
const HITOS: HitosMap = {
  A3: {
    data: {
      finalidad_publica: "Atender la necesidad de mejorar y ampliar el servicio de limpieza pública.",
      descripcion: "1. MADERA TORNILLO 50.80 mm X 76.20 mm X 3.00 m (1000 UNIDAD)\n2. MADERA TORNILLO 76.20 mm X 101.60 mm (500 UNIDAD)",
      lugar_entrega: "Apurímac - Cotabambas - Challhuahuacho (comunidad de Queña)",
      plazo_dias: "10",
      plazo_unidad: "calendario",
    },
  },
  A4: {
    data: {
      var_a_nomenclatura: "52-DEC-MDCH-1",
      var_h_modalidad_pago: "suma_alzada",
      var_i_sistema_entrega: "no_aplica",
    },
  },
} as unknown as HitosMap;

function plano(xml: string): string {
  return [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("").replace(/&amp;/g, "&");
}

describe("fusionarRuns", () => {
  it("reagrupa un marcador partido palabra por palabra en un solo <w:t>", () => {
    const roto =
      "<w:p><w:r><w:rPr/><w:t>[INDICAR</w:t></w:r><w:r><w:rPr><w:spacing w:val=\"-7\"/></w:rPr><w:t> </w:t></w:r>" +
      "<w:r><w:rPr/><w:t>LA</w:t></w:r><w:r><w:rPr><w:spacing w:val=\"-5\"/></w:rPr><w:t> </w:t></w:r>" +
      "<w:r><w:rPr/><w:t>FINALIDAD]</w:t></w:r></w:p>";
    expect(plano(fusionarRuns(roto))).toBe("[INDICAR LA FINALIDAD]");
    expect(fusionarRuns(roto)).toContain("<w:t xml:space=\"preserve\">[INDICAR LA FINALIDAD]</w:t>");
  });

  it("no fusiona runs con formato realmente distinto (negrita entre texto normal)", () => {
    const mixto =
      "<w:p><w:r><w:rPr/><w:t>antes </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>NEGRITA</w:t></w:r>" +
      "<w:r><w:rPr/><w:t> despues</w:t></w:r></w:p>";
    expect(fusionarRuns(mixto)).toContain("<w:rPr><w:b/></w:rPr><w:t xml:space=\"preserve\">NEGRITA</w:t>");
  });
});

describe("rellenarBasesDocx sobre el .docx oficial LP abreviada para bienes", () => {
  it("respeta la estructura del formato y solo sustituye los marcadores con dato", async () => {
    const plantilla = await readFile(DOCX);
    const antes = await JSZip.loadAsync(plantilla);
    const xmlAntes = await antes.file("word/document.xml")!.async("string");
    const saltosPaginaAntes = (xmlAntes.match(/<w:br w:type="page"\/>/g) ?? []).length;
    const sectPrAntes = (xmlAntes.match(/<w:sectPr[ >]/g) ?? []).length;

    const subs = construirSustituciones({
      hitos: HITOS,
      entidad: "MUNICIPALIDAD DISTRITAL DE CHALLHUAHUACHO",
      anioFiscal: "2026",
      nomenclaturaProceso: "REQ-2026-0046 — ADQUISICION DE MADERA TORNILLO PARA EL PROYECTO",
    });
    const { buffer, aplicadas, sinCoincidencia } = await rellenarBasesDocx(plantilla, subs);

    const despues = await JSZip.loadAsync(buffer);
    const xml = await despues.file("word/document.xml")!.async("string");
    const texto = plano(xml);
    const header = plano(await despues.file("word/header1.xml")!.async("string"));

    // 1. estructura de página intacta
    expect((xml.match(/<w:br w:type="page"\/>/g) ?? []).length).toBe(saltosPaginaAntes);
    expect((xml.match(/<w:sectPr[ >]/g) ?? []).length).toBe(sectPrAntes);
    // 2. XML sin desbalancear
    expect((xml.match(/<w:r>/g) ?? []).length).toBe((xml.match(/<\/w:r>/g) ?? []).length);
    expect((xml.match(/<w:t[ >]/g) ?? []).length).toBe((xml.match(/<\/w:t>/g) ?? []).length);
    // 3. los datos de A1-A8 entraron
    expect(aplicadas).toEqual(
      expect.arrayContaining([
        "entidad",
        "nomenclatura",
        "anioFiscal",
        "finalidad",
        "descripcion",
        "plazo",
        "lugar",
        "modalidadPago",
        "sistemaEntrega",
      ]),
    );
    // `sinCoincidencia` es informativo (marcadores de otras familias); no debe romper.
    void sinCoincidencia;
    expect(texto).toContain("MADERA TORNILLO 50.80 mm");
    expect(texto).toContain("10 días calendario");
    expect(texto).toContain("modalidad de pago Suma alzada");
    expect(texto).toContain("sistema de entrega de No aplica");
    expect(texto).toContain("Challhuahuacho (comunidad de Queña)");
    expect(header).toContain("MUNICIPALIDAD DISTRITAL DE CHALLHUAHUACHO");
    expect(header).toContain("52-DEC-MDCH-1");
    // 4. no se inventó nada: el marcador de especificaciones técnicas (sin dato) sigue ahí
    expect(texto).toContain("[INCLUIR LAS ESPECIFICACIONES TÉCNICAS DEL REQUERIMIENTO");
  });
});

describe("rellenarBasesDocx es genérico para todas las familias", () => {
  const subs = construirSustituciones({
    hitos: HITOS,
    entidad: "MUNICIPALIDAD DISTRITAL DE CHALLHUAHUACHO",
    anioFiscal: "2026",
    nomenclaturaProceso: "REQ-2026-0046 — ADQUISICION DE MADERA TORNILLO",
  });

  // Un .docx por cada tipo con plantilla registrada (bienes, obras, servicios,
  // consultoría en general y de obra, mantenimiento vial, SIE, comparación...).
  const procesos = Object.keys(PLANTILLAS_BASES).filter((p) => nombrePlantillaDocx(p));

  it.each(procesos)("preserva la estructura del formato: %s", async (proceso) => {
    const archivo = nombrePlantillaDocx(proceso)!;
    const plantilla = await readFile(path.join(DIR, archivo));
    const antes = await (await JSZip.loadAsync(plantilla)).file("word/document.xml")!.async("string");
    const { buffer, aplicadas } = await rellenarBasesDocx(plantilla, subs);
    const xml = await (await JSZip.loadAsync(buffer)).file("word/document.xml")!.async("string");

    const cuenta = (s: string, re: RegExp) => (s.match(re) ?? []).length;
    expect(cuenta(xml, /<\/w:p>/g)).toBe(cuenta(antes, /<\/w:p>/g));
    expect(cuenta(xml, /<w:sectPr[ >]/g)).toBe(cuenta(antes, /<w:sectPr[ >]/g));
    expect(cuenta(xml, /<w:tbl>/g)).toBe(cuenta(antes, /<w:tbl>/g));
    expect(cuenta(xml, /<w:r\b/g)).toBe(cuenta(xml, /<\/w:r>/g));
    expect(cuenta(xml, /<w:t\b/g)).toBe(cuenta(xml, /<\/w:t>/g));
    // en toda familia entran al menos entidad + nomenclatura + finalidad
    expect(aplicadas).toEqual(expect.arrayContaining(["entidad", "nomenclatura", "finalidad"]));
  });

  it("hay 15 .docx oficiales en actuaciones-preparatorias/bases", async () => {
    const docx = (await readdir(DIR)).filter((f) => f.endsWith(".docx"));
    expect(docx.length).toBe(15);
  });
});
