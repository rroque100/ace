import { describe, expect, it } from "vitest";
import { construirCaratula, type DatosCaratula } from "@/lib/caratula-expediente";

const BASE: DatosCaratula = {
  areaUsuaria: "GERENCIA DE DESARROLLO SOCIAL JEFATURA",
  codigoNecesidad: "NEC-2026-0018",
  entidad: "Municipalidad distrital de Challhuahuacho",
  estado: "Actuaciones preparatorias",
  fechaEmision: "22 de julio de 2026",
  metaPresupuestal: "237",
  moneda: "PEN",
  nomenclatura: "REQ-2026-0018 — ADQUISICIÓN DE CUYES REPRODUCTORES",
  objeto: "Bienes",
  procedimiento: null,
  valorEstimado: 128450,
  resumen: {
    aprobacion: "GERENCIA MUNICIPAL — ANEXO N° 02",
    certificacionPresupuestal: null,
    formulaReajuste: null,
    garantiasAdelantos: "Garantía de fiel cumplimiento 10%",
    interaccionMercado: null,
    modalidadPago: null,
    requisitosCalificacion: "OBLIGATORIOS: capacidad técnica",
    sistemaEntrega: null,
    tipoEvaluador: null,
  },
};

/**
 * Texto plano del .docx.
 *
 * Se descomprime con `jszip`, que llega como dependencia transitiva de `docx`.
 * Si algún día deja de estar, el test lo dice en vez de fingir que pasó: un
 * `catch` silencioso aquí dejaría de comprobar el contenido sin que nadie se
 * entere.
 */
async function textoDelDocx(buffer: Buffer): Promise<string[]> {
  const { default: JSZip } = (await import("jszip")) as unknown as {
    default: { loadAsync: (b: Buffer) => Promise<{ file: (p: string) => { async: (t: "string") => Promise<string> } | null }> };
  };
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml")!.async("string");
  return [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).filter((t) => t.trim());
}

describe("carátula del expediente", () => {
  it("produce un .docx válido", async () => {
    const buffer = await construirCaratula(BASE);
    // Un .docx es un zip: empieza por "PK".
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("lleva la identificación y las decisiones", async () => {
    const lineas = await textoDelDocx(await construirCaratula(BASE));
    const texto = lineas.join("\n");
    expect(texto).toContain("CARÁTULA DEL EXPEDIENTE DE CONTRATACIÓN");
    expect(texto).toContain("REQ-2026-0018");
    expect(texto).toContain("GERENCIA DE DESARROLLO SOCIAL JEFATURA");
    expect(texto).toContain("NEC-2026-0018");
    expect(texto).toContain("GERENCIA MUNICIPAL — ANEXO N° 02");
  });

  it("dice en qué paso se resuelve cada dato", async () => {
    // La referencia viaja al papel: quien recibe la carátula y ve un hueco sabe
    // en qué actuación se resuelve, sin tener que preguntar.
    const texto = (await textoDelDocx(await construirCaratula(BASE))).join("\n");
    for (const paso of ["(A3)", "(A4)", "(A5)", "(A7)", "(A8)", "(Ficha)"]) {
      expect(texto, paso).toContain(paso);
    }
  });

  it("imprime las filas vacías con guion en vez de omitirlas", async () => {
    // Un hueco visible dice "esto falta"; omitir la fila haría parecer completo
    // un expediente que no lo está.
    const texto = (await textoDelDocx(await construirCaratula(BASE))).join("\n");
    expect(texto).toContain("Certificación presupuestal (A7)");
    expect(texto).toContain("—");
  });

  it("formatea el importe en soles", async () => {
    const texto = (await textoDelDocx(await construirCaratula(BASE))).join("\n");
    expect(texto).toContain("S/ 128,450.00");
  });

  it("usa el símbolo del dólar cuando la moneda es USD", async () => {
    const texto = (
      await textoDelDocx(await construirCaratula({ ...BASE, moneda: "USD" }))
    ).join("\n");
    expect(texto).toContain("US$ 128,450.00");
  });

  it("sin valor estimado no inventa un importe de cero", async () => {
    const texto = (
      await textoDelDocx(await construirCaratula({ ...BASE, valorEstimado: null }))
    ).join("\n");
    expect(texto).not.toContain("S/ 0");
  });

  it("un expediente recién creado no revienta", async () => {
    const vacio: DatosCaratula = {
      ...BASE,
      areaUsuaria: null,
      codigoNecesidad: null,
      entidad: null,
      metaPresupuestal: null,
      moneda: null,
      valorEstimado: null,
      resumen: {
        aprobacion: null,
        certificacionPresupuestal: null,
        formulaReajuste: null,
        garantiasAdelantos: null,
        interaccionMercado: null,
        modalidadPago: null,
        requisitosCalificacion: null,
        sistemaEntrega: null,
        tipoEvaluador: null,
      },
    };
    const buffer = await construirCaratula(vacio);
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("advierte de que no sustituye al expediente del Art. 54", async () => {
    // Sin esta nota, una portada de una página podría pasar por el legajo.
    const texto = (await textoDelDocx(await construirCaratula(BASE))).join("\n");
    expect(texto).toContain("No sustituye");
    expect(texto).toContain("54");
  });

  it("usa el margen normal: 2.5cm superior/inferior, 3cm izquierda/derecha", async () => {
    const { default: JSZip } = (await import("jszip")) as unknown as {
      default: { loadAsync: (b: Buffer) => Promise<{ file: (p: string) => { async: (t: "string") => Promise<string> } | null }> };
    };
    const zip = await JSZip.loadAsync(await construirCaratula(BASE));
    const xml = await zip.file("word/document.xml")!.async("string");
    // docx mide en twips (567 = 1cm): 1418 ≈ 2.5cm, 1701 = 3cm.
    expect(xml).toContain('w:top="1418"');
    expect(xml).toContain('w:bottom="1418"');
    expect(xml).toContain('w:left="1701"');
    expect(xml).toContain('w:right="1701"');
  });
});
