import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  buildAnuncioFuturoDocx,
  datosAnuncioFuturo,
  type AnuncioFuturoInput,
} from "@/lib/anuncio-futuro-docx";

/**
 * A10 · Anuncio de contratación futura (Art. 43). El builder es puro: las fechas
 * llegan como texto ISO y se formatean sin `Date`, así que el .docx es
 * determinista y se puede comprobar sin red ni relojes.
 */

const base: AnuncioFuturoInput = {
  entidad: "Municipalidad Distrital de Challhuahuacho",
  ciudad: "Challhuahuacho",
  nomenclatura: "REQ-2026-0030 — ADQUISICIÓN DE CEMENTO",
  objetoLabel: "Bien",
  datosEntidad: null,
  descripcionPreliminar: "Cemento Portland Tipo IP para obras de saneamiento.",
  tipoProcedimiento: "Licitación Pública para bienes",
  fechaAproxConvocatoria: "2026-09-15",
  publicadoPladicop: true,
  publicadoSede: false,
  fechaPublicacion: "2026-07-31",
  beneficio40dias: false,
  plazoReducido: null,
  hoy: "2026-07-31",
};

function esZipValido(buf: Buffer): boolean {
  return buf.length > 0 && buf[0] === 0x50 && buf[1] === 0x4b; // "PK"
}

async function textoDelDocx(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml")!.async("string");
  return xml
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#176;/g, "°")
    .replace(/\s+/g, " ")
    .trim();
}

describe("buildAnuncioFuturoDocx", () => {
  it("genera un .docx válido (ZIP con firma PK)", async () => {
    expect(esZipValido(await buildAnuncioFuturoDocx(base))).toBe(true);
  });

  it("incluye el título, la nomenclatura y la cita del Art. 43", async () => {
    const texto = await textoDelDocx(await buildAnuncioFuturoDocx(base));
    expect(texto).toContain("ANUNCIO DE CONTRATACIÓN FUTURA");
    expect(texto).toContain("REQ-2026-0030");
    expect(texto).toContain("artículo 43 del Reglamento");
  });

  it("compone los cuatro apartados del Art. 43 (a–d)", async () => {
    const texto = await textoDelDocx(await buildAnuncioFuturoDocx(base));
    expect(texto).toContain("a) Datos de la entidad contratante");
    expect(texto).toContain("b) Descripción preliminar del requerimiento");
    expect(texto).toContain("Cemento Portland Tipo IP");
    expect(texto).toContain("c) Tipo de procedimiento de selección previsto");
    expect(texto).toContain("Licitación Pública para bienes");
    expect(texto).toContain("d) Fecha aproximada de convocatoria");
  });

  it("formatea las fechas ISO sin desfase de zona horaria", async () => {
    const texto = await textoDelDocx(await buildAnuncioFuturoDocx(base));
    expect(texto).toContain("15 de septiembre de 2026"); // convocatoria
    expect(texto).toContain("Challhuahuacho, 31 de julio de 2026"); // pie
  });

  it("a falta de dato en un apartado obligatorio, lo marca como pendiente", async () => {
    const texto = await textoDelDocx(
      await buildAnuncioFuturoDocx({ ...base, tipoProcedimiento: null, fechaAproxConvocatoria: null }),
    );
    expect(texto).toContain("c) Tipo de procedimiento de selección previsto: [Por completar]");
    expect(texto).toContain("d) Fecha aproximada de convocatoria: [Por completar]");
  });

  it("cita el beneficio del Art. 64.3 solo cuando se marca", async () => {
    const sin = await textoDelDocx(await buildAnuncioFuturoDocx(base));
    expect(sin).toContain("no sustituye la convocatoria");
    expect(sin).not.toContain("64.3");

    const con = await textoDelDocx(
      await buildAnuncioFuturoDocx({ ...base, beneficio40dias: true, plazoReducido: 15 }),
    );
    expect(con).toContain("numeral 64.3 del artículo 64");
    expect(con).toContain("plazo reducido de 15 días");
  });

  it("sin datos de entidad propios, cae a la denominación de la entidad", async () => {
    const texto = await textoDelDocx(await buildAnuncioFuturoDocx(base));
    expect(texto).toContain("a) Datos de la entidad contratante: Municipalidad Distrital de Challhuahuacho");
  });
});

describe("datosAnuncioFuturo · mapeo del JSONB de A10", () => {
  it("lee los campos del paso y respeta booleanos y número", () => {
    const input = datosAnuncioFuturo(
      {
        datos_entidad: "RUC 20288774553",
        descripcion_preliminar: "Suministro de barras de construcción.",
        tipo_procedimiento_previsto: "Comparación de Precios",
        fecha_aprox_convocatoria: "2026-10-01",
        publicado_pladicop: true,
        publicado_sede_digital: false,
        fecha_publicacion_anuncio: "2026-08-15",
        aplica_beneficio_40dias: true,
        plazo_reducido: 20,
      },
      { entidad: "MDCH", nomenclatura: "REQ-X", ciudad: "Cotabambas", objetoLabel: "Bien", hoy: "2026-08-01" },
    );
    expect(input.datosEntidad).toBe("RUC 20288774553");
    expect(input.tipoProcedimiento).toBe("Comparación de Precios");
    expect(input.publicadoPladicop).toBe(true);
    expect(input.publicadoSede).toBe(false);
    expect(input.beneficio40dias).toBe(true);
    expect(input.plazoReducido).toBe(20);
    expect(input.entidad).toBe("MDCH");
  });

  it("las cadenas vacías o en blanco se leen como null; el plazo no positivo, null", () => {
    const input = datosAnuncioFuturo(
      { descripcion_preliminar: "   ", plazo_reducido: 0 },
      { entidad: "MDCH", nomenclatura: "REQ-X", hoy: "2026-08-01" },
    );
    expect(input.descripcionPreliminar).toBeNull();
    expect(input.plazoReducido).toBeNull();
    expect(input.publicadoPladicop).toBe(false);
  });
});

describe("márgenes de página", () => {
  it("usa el margen normal: 2.5cm superior/inferior, 3cm izquierda/derecha", async () => {
    const zip = await JSZip.loadAsync(await buildAnuncioFuturoDocx(base));
    const xml = await zip.file("word/document.xml")!.async("string");
    // docx mide en twips (567 = 1cm): 1418 ≈ 2.5cm, 1701 = 3cm.
    expect(xml).toContain('w:top="1418"');
    expect(xml).toContain('w:bottom="1418"');
    expect(xml).toContain('w:left="1701"');
    expect(xml).toContain('w:right="1701"');
  });
});
