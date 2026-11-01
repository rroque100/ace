import JSZip from "jszip";
import { beforeAll, describe, expect, it } from "vitest";
import { PLANTILLAS_BASES } from "@/lib/bases-plantillas";
import { leerPlantillaDocx, nombrePlantillaDocx } from "@/lib/bases-docx-plantilla";
import {
  CAMPOS_HITO_EN_WORD, CAMPOS_HITO_SIN_MARCADOR, construirSustituciones, rellenarBasesDocx, type ResultadoRelleno,
} from "@/lib/bases-docx-relleno";
import type { HitosMap } from "@/lib/procurement-fases";

// Vigila que lo que `resolverBases` sabe resolver no se quede por el camino al Word oficial del OECE. La ruta de exportación
// rellena ese Word con `construirSustituciones`, que antes aplicaba una lista corta escrita a mano: los datos de las plantillas
// (lib/bases-plantillas.ts) se resolvían, pero nadie comprobaba que llegaran al documento. Aquí cada campo de paso enlazado por
// una plantilla tiene que figurar en CAMPOS_HITO_EN_WORD (y entonces se prueba contra los .docx reales) o en
// CAMPOS_HITO_SIN_MARCADOR (con el motivo por el que no se vuelca).

const camposEnlazados = new Set<string>();
for (const plantilla of Object.values(PLANTILLAS_BASES)) {
  for (const campo of plantilla.seccionEspecifica) if (campo.origen === "literal") camposEnlazados.add(`${campo.hito}.${campo.campoHito}`);
}

describe("todo campo de paso que una plantilla de bases enlaza está contabilizado", () => {
  it("figura en el registro de lo que llega al Word, o en el de lo que no llega con su motivo", () => {
    for (const campo of camposEnlazados) {
      const enWord = campo in CAMPOS_HITO_EN_WORD;
      const sinMarcador = campo in CAMPOS_HITO_SIN_MARCADOR;
      expect(enWord || sinMarcador, `${campo} lo resuelve una plantilla pero no está en ningún registro`).toBe(true);
      expect(enWord && sinMarcador, `${campo} figura en los dos registros`).toBe(false);
    }
  });

  it("no hay entradas de más: cada campo registrado lo usa al menos una plantilla", () => {
    for (const campo of [...Object.keys(CAMPOS_HITO_EN_WORD), ...Object.keys(CAMPOS_HITO_SIN_MARCADOR)]) {
      // A4.cui lo usa el marcador de obras aunque ninguna plantilla de texto lo enlace como campo propio: es el único permitido.
      if (campo === "A4.cui") continue;
      expect(camposEnlazados.has(campo), `${campo} está registrado y ninguna plantilla lo enlaza`).toBe(true);
    }
  });

  it("cada campo que NO se vuelca al Word dice por qué, con una razón concreta y no una etiqueta", () => {
    for (const [campo, motivo] of Object.entries(CAMPOS_HITO_SIN_MARCADOR)) {
      expect(motivo.length, campo).toBeGreaterThan(80);
      expect(motivo, campo).not.toMatch(/pendiente|TODO|por hacer/i);
    }
  });
});

// Un valor distinguible por campo; los que se transforman al volcarse (plazo, modalidad, sistema) se comprueban por su clave.
const SENTINELAS: Record<string, string> = {
  "A3.finalidad_publica": "ZZFINALIDADZZ", "A3.descripcion": "ZZDESCRIPCIONZZ", "A3.lugar_entrega": "ZZLUGARZZ",
  "A3.formula_reajuste": "ZZREAJUSTEZZ", "A3.otras_penalidades": "ZZOTRASPENALIDADESZZ", "A4.cui": "ZZCUIZZ",
};

function hitosCompletos(): HitosMap {
  const A3: Record<string, unknown> = { plazo_dias: "45", plazo_unidad: "calendario" };
  const A4: Record<string, unknown> = { var_h_modalidad_pago: "suma_alzada", var_i_sistema_entrega: "llave_en_mano", var_a_nomenclatura: "LP-1-2026" };
  for (const [campo, valor] of Object.entries(SENTINELAS)) (campo.startsWith("A3.") ? A3 : A4)[campo.slice(3)] = valor;
  return { A3: { status: "hecho", data: A3 }, A4: { status: "hecho", data: A4 } } as HitosMap;
}

async function textoDocumento(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  return await zip.file("word/document.xml")!.async("string");
}

describe("cada campo que se vuelca al Word llega a los .docx oficiales reales", () => {
  const resultados = new Map<string, { relleno: ResultadoRelleno; xml: string }>();

  beforeAll(async () => {
    const hechos = new Set<string>();
    for (const nombre of Object.keys(PLANTILLAS_BASES)) {
      const archivo = nombrePlantillaDocx(nombre);
      if (!archivo || hechos.has(archivo)) continue;
      hechos.add(archivo);
      const docx = (await leerPlantillaDocx(nombre))!;
      const relleno = await rellenarBasesDocx(docx, construirSustituciones({
        hitos: hitosCompletos(), entidad: "ENTIDAD DE PRUEBA", anioFiscal: "2026", nomenclaturaProceso: "REQ-1 — Contratación de prueba",
      }));
      resultados.set(nombre, { relleno, xml: await textoDocumento(relleno.buffer) });
    }
  }, 180_000);

  it("las 15 plantillas oficiales se pudieron rellenar", () => {
    expect(resultados.size).toBe(15);
  });

  it("cada clave del registro se aplica en al menos un .docx (la expresión casa con el marcador real del OECE)", () => {
    const aplicadas = new Set([...resultados.values()].flatMap((r) => r.relleno.aplicadas));
    for (const [campo, clave] of Object.entries(CAMPOS_HITO_EN_WORD)) {
      expect(aplicadas.has(clave), `${campo} → «${clave}» no casa con ningún marcador de los 15 Word oficiales`).toBe(true);
    }
  });

  it("el texto del área usuaria llega al documento tal cual, en los tipos que tienen su marcador", () => {
    for (const [campo, sentinela] of Object.entries(SENTINELAS)) {
      const algunDocumento = [...resultados.values()].some((r) => r.xml.includes(sentinela));
      expect(algunDocumento, `«${sentinela}» (${campo}) no aparece en ningún Word rellenado`).toBe(true);
    }
  });

  it("la fórmula de reajuste y «otras penalidades» sustituyen a su marcador: no queda la instrucción del OECE", () => {
    for (const [, { xml }] of resultados) {
      if (xml.includes("ZZREAJUSTEZZ")) expect(xml).not.toMatch(/DE SER EL CASO, CONSIGNAR LAS F[ÓO]RMULAS DE REAJUSTE/);
      if (xml.includes("ZZOTRASPENALIDADESZZ")) expect(xml).not.toContain("INCLUIR OTRAS PENALIDADES, DE SER EL CASO");
    }
  });

  it("el CUI solo se suma al nombre en los marcadores de obras, que son los que lo piden", () => {
    const conCui = [...resultados.entries()].filter(([, r]) => r.xml.includes("ZZCUIZZ")).map(([n]) => n);
    expect(conCui.length).toBeGreaterThan(0);
    for (const nombre of conCui) expect(nombre, "el CUI no debe aparecer en un tipo que no es de obra").toMatch(/obra/i);
    for (const [, r] of resultados) expect(r.xml).not.toContain("(CUI ZZCUIZZ) (CUI");
  });
});

describe("sin dato no se inventa nada", () => {
  it("un expediente sin A3/A4 no sustituye ni el reajuste, ni las penalidades, ni el CUI", () => {
    const subs = construirSustituciones({ hitos: {}, entidad: "", anioFiscal: "", nomenclaturaProceso: "" });
    const claves = new Set(subs.map((s) => s.clave));
    for (const clave of ["formulaReajuste", "otrasPenalidades", "objeto"]) expect(claves.has(clave), clave).toBe(false);
  });

  it("«No aplica» es una respuesta y se vuelca, porque el marcador dice «de ser el caso»", async () => {
    const hitos = { A3: { status: "hecho", data: { formula_reajuste: "No aplica" } } } as HitosMap;
    const docx = (await leerPlantillaDocx("Licitación Pública para bienes"))!;
    const { buffer, aplicadas } = await rellenarBasesDocx(docx, construirSustituciones({ hitos, entidad: "", anioFiscal: "", nomenclaturaProceso: "" }));
    expect(aplicadas).toContain("formulaReajuste");
    expect(await textoDocumento(buffer)).not.toMatch(/DE SER EL CASO, CONSIGNAR LAS F[ÓO]RMULAS DE REAJUSTE/);
  });

  it("una obra sin CUI lleva solo el nombre; con CUI, el nombre y su código", async () => {
    const docx = (await leerPlantillaDocx("Licitación Pública de obras"))!;
    const sinCui = await rellenarBasesDocx(docx, construirSustituciones({ hitos: {}, entidad: "", anioFiscal: "", nomenclaturaProceso: "REQ-1 — Mejoramiento de la vía" }));
    const conCui = await rellenarBasesDocx(docx, construirSustituciones({
      hitos: { A4: { status: "hecho", data: { cui: "2661009" } } } as HitosMap, entidad: "", anioFiscal: "", nomenclaturaProceso: "REQ-1 — Mejoramiento de la vía",
    }));
    const xmlSin = await textoDocumento(sinCui.buffer);
    const xmlCon = await textoDocumento(conCui.buffer);
    expect(xmlSin).toContain("Mejoramiento de la vía");
    expect(xmlSin).not.toContain("(CUI ");
    expect(xmlCon).toContain("Mejoramiento de la vía (CUI 2661009)");
  });
});
