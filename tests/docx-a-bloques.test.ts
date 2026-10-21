import { describe, expect, it } from "vitest";
import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx";
import { leerDocx } from "@/lib/docx-a-bloques";

async function docConParrafos(parrafos: Paragraph[]): Promise<Buffer> {
  return Packer.toBuffer(new Document({ sections: [{ children: parrafos }] }));
}

describe("leerDocx", () => {
  it("extrae el texto de cada párrafo", async () => {
    const buf = await docConParrafos([
      new Paragraph({ children: [new TextRun("Primera línea")] }),
      new Paragraph({ children: [new TextRun("Segunda línea")] }),
    ]);
    const p = await leerDocx(buf);
    const textos = p.map((x) => x.fragmentos.map((f) => f.texto).join(""));
    expect(textos).toContain("Primera línea");
    expect(textos).toContain("Segunda línea");
  });

  it("conserva negrita, cursiva y subrayado", async () => {
    // Es lo que hace que la previa se parezca al documento: sin el formato,
    // sería un volcado de texto plano.
    const buf = await docConParrafos([
      new Paragraph({
        children: [
          new TextRun({ text: "N", bold: true }),
          new TextRun({ text: "C", italics: true }),
          new TextRun({ text: "S", underline: {} }),
          new TextRun({ text: "P" }),
        ],
      }),
    ]);
    const [p] = await leerDocx(buf);
    const porTexto = Object.fromEntries(p.fragmentos.map((f) => [f.texto, f]));
    expect(porTexto.N.negrita).toBe(true);
    expect(porTexto.C.cursiva).toBe(true);
    expect(porTexto.S.subrayado).toBe(true);
    expect(porTexto.P).toMatchObject({ negrita: false, cursiva: false, subrayado: false });
  });

  it("lee la alineación del párrafo", async () => {
    const buf = await docConParrafos([
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun("centro")] }),
      new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [new TextRun("justo")] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun("derecha")] }),
    ]);
    const p = await leerDocx(buf);
    const alin = Object.fromEntries(
      p.filter((x) => x.fragmentos.length).map((x) => [x.fragmentos[0].texto, x.alineacion]),
    );
    expect(alin.centro).toBe("center");
    expect(alin.justo).toBe("both");
    expect(alin.derecha).toBe("right");
  });

  it("traduce el salto de línea del run a \n", async () => {
    const buf = await docConParrafos([
      new Paragraph({ children: [new TextRun({ text: "arriba", break: 1 })] }),
    ]);
    const [p] = await leerDocx(buf);
    expect(p.fragmentos.some((f) => f.texto.includes("\n"))).toBe(true);
  });

  it("conserva los párrafos vacíos (espaciado de la maqueta)", async () => {
    const buf = await docConParrafos([
      new Paragraph({ children: [new TextRun("uno")] }),
      new Paragraph({ children: [] }),
      new Paragraph({ children: [new TextRun("dos")] }),
    ]);
    const p = await leerDocx(buf);
    expect(p.some((x) => x.fragmentos.length === 0)).toBe(true);
  });

  it("decodifica las entidades XML (& < >)", async () => {
    const buf = await docConParrafos([new Paragraph({ children: [new TextRun("A & B < C > D")] })]);
    const [p] = await leerDocx(buf);
    expect(p.fragmentos.map((f) => f.texto).join("")).toBe("A & B < C > D");
  });
});

import { buildEvaluadorDoc } from "@/lib/evaluadores-docx";

describe("la previa de A6 sale del documento, no de un render aparte", () => {
  const INPUT = {
    entidad: "MDCH",
    lugar: "Challhuahuacho",
    fecha: "2026-07-23",
    tipoEvaluadorLabel: "Comité de selección",
    tipoEvaluador: "comite",
    procedimientoLabel: "Subasta Inversa Electrónica",
    nomenclatura: "44-2026-DEC-MDCH-1",
    memoNumero: "45-2026-DEC-MDCH",
    integrantes: [{ nombre: "JUAN PEREZ QUISPE", dni: "12345678", grado: "ING.", cargo: "UA" }],
    emisor: { grado: "MAG.", nombre: "JUAN ROJAS MAYTAN" },
  };

  for (const kind of ["memo", "jurada", "consentimiento"] as const) {
    it(`el texto leído coincide con el .docx de ${kind}`, async () => {
      // La previa lee EL MISMO buffer que se descarga, así que su texto tiene
      // que estar íntegro en el documento generado.
      const buffer = await buildEvaluadorDoc(kind, INPUT as never);
      const parrafos = await leerDocx(buffer);
      expect(parrafos.some((p) => p.fragmentos.length)).toBe(true);
      // Datos del expediente que deben aparecer en el documento y en la previa.
      const texto = parrafos.flatMap((p) => p.fragmentos.map((f) => f.texto)).join(" ");
      expect(texto).toContain("JUAN PEREZ QUISPE");
    });
  }

  it("el memorándum trae el número con formato del documento", async () => {
    const parrafos = await leerDocx(await buildEvaluadorDoc("memo", INPUT as never));
    // Es comité: el documento de designación es un INFORME (no un memorándum).
    const titulo = parrafos.find((p) =>
      p.fragmentos.some((f) => f.texto.includes("INFORME")),
    );
    // En el .docx el número va subrayado y en negrita: la previa lo refleja.
    expect(titulo?.fragmentos.some((f) => f.negrita && f.subrayado)).toBe(true);
  });
});
