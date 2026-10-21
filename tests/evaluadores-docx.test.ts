import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  buildConsentimientoDatosDocx,
  buildDeclaracionJuradaDocx,
  buildEvaluadorDoc,
  buildMemoDesignacionDocx,
  type EvaluadoresDocInput,
} from "@/lib/evaluadores-docx";

// Los .docx son ZIP; el texto vive en word/document.xml.
async function texto(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml")!.async("string");
  return xml.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

const BASE: EvaluadoresDocInput = {
  entidad: "Municipalidad distrital de Challhuahuacho",
  lugar: "Challhuahuacho",
  fecha: "2026-04-29",
  tipoEvaluadorLabel: "Oficial de compra",
  tipoEvaluador: "oficial_compra",
  procedimientoLabel: "Licitación pública abreviada",
  nomenclatura: "04-2026-DEC-MDCH-1",
  integrantes: [{ nombre: "WALTER CCANA CONDORI", dni: "24714212", grado: "ABG.", cargo: "UNIDAD DE ADQUISICIÓN" }],
  memoNumero: "52-2026-JRM-OL-OGA/MDCH",
  emisor: { grado: "MAG. CPC", nombre: "JUAN ROJAS MAYTAN" },
};

describe("memorándum de designación", () => {
  it("lleva los datos del expediente en el encabezado del memorándum", async () => {
    const t = await texto(await buildMemoDesignacionDocx(BASE));
    expect(t).toContain("MEMORANDUM N° 52-2026-JRM-OL-OGA/MDCH");
    // El emisor (jefe de logística/DEC) va en la línea "DE:".
    expect(t).toContain("MAG. CPC JUAN ROJAS MAYTAN");
    expect(t).toContain("DEPENDENCIA ENCARGADA DE LAS CONTRATACIONES");
    expect(t).toContain("ABG. WALTER CCANA CONDORI"); // A: con su grado
    // …y debajo del nombre, su cargo/unidad (como la dependencia bajo "DE:").
    expect(t).toContain("UNIDAD DE ADQUISICIÓN");
    expect(t).toContain("DESIGNACIÓN COMO OFICIAL DE COMPRA");
    expect(t).toContain("LICITACIÓN PÚBLICA ABREVIADA N° 04-2026-DEC-MDCH-1");
    expect(t).toContain("Challhuahuacho, 29 de abril del 2026");
  });

  it("no duplica «MEMORANDUM N°» si el usuario ya lo escribió en el número", async () => {
    // El caso real: el usuario tecleó "MEMORADUN NRO 52-…" (con errata) en el
    // campo del número; la cabecera no debe anteponerle otro "MEMORANDUM N°".
    const t = await texto(await buildMemoDesignacionDocx({ ...BASE, memoNumero: "MEMORADUN NRO 52-2026-JRM-OL-OGA-MDCH" }));
    expect(t).toContain("MEMORANDUM N° 52-2026-JRM-OL-OGA-MDCH");
    expect(t).not.toContain("MEMORANDUM N° MEMOR");
    expect(t.match(/MEMORANDUM/g)?.length).toBe(1);
  });

  it("no lleva bloque de firma al pie (el emisor va en «DE:»)", async () => {
    const t = await texto(await buildMemoDesignacionDocx(BASE));
    expect(t).not.toContain("_______________________________");
  });

  it("el cuerpo cita los artículos 56 y 58 del Reglamento", async () => {
    const t = await texto(await buildMemoDesignacionDocx(BASE));
    expect(t).toContain("artículo 56");
    expect(t).toContain("58.1");
    expect(t).toContain("58.2");
  });

  it("el cuerpo cambia con el tipo de evaluador", async () => {
    const comite = await texto(await buildMemoDesignacionDocx({ ...BASE, tipoEvaluador: "comite", tipoEvaluadorLabel: "Comité" }));
    expect(comite).toContain("Comité de Selección");
    expect(comite).toContain("decisión colegiada");
    const jurado = await texto(await buildMemoDesignacionDocx({ ...BASE, tipoEvaluador: "jurado", tipoEvaluadorLabel: "Jurado" }));
    expect(jurado).toContain("Jurado");
    expect(jurado).toContain("evaluación de las ofertas");
  });

  it("sin emisor sale con la línea «DE:» en blanco, no roto", async () => {
    const t = await texto(await buildMemoDesignacionDocx({ ...BASE, emisor: { nombre: "" } }));
    expect(t).toContain("MEMORANDUM");
    expect(t).toContain("____________________"); // el hueco del emisor
  });

  it("con varios integrantes los designa a todos", async () => {
    const t = await texto(
      await buildMemoDesignacionDocx({
        ...BASE,
        tipoEvaluador: "comite",
        tipoEvaluadorLabel: "Comité",
        integrantes: [
          { nombre: "ANA PÉREZ", dni: "11111111", grado: "ING.", cargo: "OFICINA DE OBRAS" },
          { nombre: "LUIS GARCÍA", dni: "22222222", grado: "ABOG.", cargo: "ASESORÍA LEGAL" },
        ],
      }),
    );
    expect(t).toContain("ING. ANA PÉREZ");
    expect(t).toContain("OFICINA DE OBRAS");
    expect(t).toContain("ABOG. LUIS GARCÍA");
    expect(t).toContain("ASESORÍA LEGAL");
  });
});

describe("declaración jurada de no conflicto (Anexo N° 1)", () => {
  it("lleva el nombre y DNI del evaluador y cita el Art. 56.7", async () => {
    const t = await texto(await buildDeclaracionJuradaDocx(BASE));
    expect(t).toContain("ANEXO N° 1");
    expect(t).toContain("DECLARACIÓN JURADA DE NO TENER CONFLICTO DE INTERES");
    expect(t).toContain("Yo, WALTER CCANA CONDORI identificado con DNI N° 24714212");
    expect(t).toContain("56.7");
    expect(t).toContain("082-2023-PCM"); // definición de conflicto de intereses
    expect(t).toContain("Challhuahuacho, 29 del mes de abril del 2026");
  });

  it("una página por integrante", async () => {
    const buffer = await buildDeclaracionJuradaDocx({
      ...BASE,
      integrantes: [
        { nombre: "ANA PÉREZ", dni: "11111111" },
        { nombre: "LUIS GARCÍA", dni: "22222222" },
        { nombre: "MARÍA SOTO", dni: "33333333" },
      ],
    });
    const t = await texto(buffer);
    expect(t.match(/ANEXO N° 1/g)?.length).toBe(3);
    expect(t).toContain("ANA PÉREZ");
    expect(t).toContain("MARÍA SOTO");
  });

  it("por miembro: con un solo integrante sale UNA declaración, solo la suya", async () => {
    // Es lo que produce generarEvaluadorDoc al filtrar a un miembro: la lista que
    // recibe el generador trae una sola persona.
    const t = await texto(
      await buildDeclaracionJuradaDocx({
        ...BASE,
        integrantes: [{ nombre: "ANA PÉREZ", dni: "11111111" }],
      }),
    );
    expect(t.match(/ANEXO N° 1/g)?.length).toBe(1);
    expect(t).toContain("Yo, ANA PÉREZ identificado con DNI N° 11111111");
    expect(t).not.toContain("MARÍA SOTO");
  });
});

describe("consentimiento de datos personales (Anexo N° 3)", () => {
  it("lleva el nombre y DNI del evaluador y cita la Ley 29733", async () => {
    const t = await texto(await buildConsentimientoDatosDocx(BASE));
    expect(t).toContain("ANEXO N° 3");
    expect(t).toContain("CONSENTIMIENTO PARA EL TRATAMIENTO DE DATOS PERSONALES");
    expect(t).toContain("Ley N° 29733");
    expect(t).toContain("016-2024-JUS");
    expect(t).toContain("Nombre y apellidos del ciudadano: WALTER CCANA CONDORI");
    expect(t).toContain("DNI: 24714212");
  });
});

describe("huecos cuando falta un dato: nunca cae, deja el espacio para completar a mano", () => {
  it("sin DNI el documento sale con la línea en blanco, no roto", async () => {
    const t = await texto(await buildDeclaracionJuradaDocx({ ...BASE, integrantes: [{ nombre: "ANA PÉREZ", dni: "" }] }));
    expect(t).toContain("ANA PÉREZ");
    expect(t).toContain("____________"); // el hueco del DNI
  });

  it("sin integrantes genera un formato en blanco para rellenar a mano", async () => {
    const t = await texto(await buildConsentimientoDatosDocx({ ...BASE, integrantes: [] }));
    expect(t).toContain("CONSENTIMIENTO PARA EL TRATAMIENTO DE DATOS PERSONALES");
  });
});

describe("buildEvaluadorDoc · despacho por tipo", () => {
  it("cada clave devuelve su documento", async () => {
    expect(await texto(await buildEvaluadorDoc("memo", BASE))).toContain("MEMORANDUM");
    expect(await texto(await buildEvaluadorDoc("jurada", BASE))).toContain("ANEXO N° 1");
    expect(await texto(await buildEvaluadorDoc("consentimiento", BASE))).toContain("ANEXO N° 3");
  });
});

describe("márgenes de página", () => {
  it("usa el margen normal: 2.5cm superior/inferior, 3cm izquierda/derecha", async () => {
    const zip = await JSZip.loadAsync(await buildMemoDesignacionDocx(BASE));
    const xml = await zip.file("word/document.xml")!.async("string");
    // docx mide en twips (567 = 1cm): 1418 ≈ 2.5cm, 1701 = 3cm.
    expect(xml).toContain('w:top="1418"');
    expect(xml).toContain('w:bottom="1418"');
    expect(xml).toContain('w:left="1701"');
    expect(xml).toContain('w:right="1701"');
  });
});
