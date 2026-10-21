import { describe, expect, it } from "vitest";
import {
  componerDenominacion,
  detectarMarca,
  nomenclaturaExpediente,
  type PiezasDenominacion,
} from "@/lib/necesidad-denominacion";

// Caso real: REQ-2026-0004 de la base. Tiene el objeto y el ámbito, pero le
// falta la descripción de catálogo.
//
// El destinatario de la contratación es el ÁREA USUARIA. Antes se tomaba de la
// "población beneficiaria" y solo se caía al área si faltaba; ese campo se
// retiró de la ficha (no lo consumía ninguna fase), así que ahora manda el área.
const REQ_0004: PiezasDenominacion = {
  tipoObjeto: "bienes",
  descripcionCatalogo: null,
  areaUsuaria: "GERENCIA DE SERVICIOS MUNICIPALES Y GESTION AMBIENTAL",
  entidad: null,
  distrito: "CHALLHUAHUACHO",
  anioFiscal: 2026,
};

describe("componerDenominacion", () => {
  it("compone el nombre completo cuando están todas las piezas", () => {
    const d = componerDenominacion({
      ...REQ_0004,
      descripcionCatalogo: "servidor de datos",
      areaUsuaria: "las áreas administrativas",
      entidad: "Municipalidad Distrital de Challhuahuacho",
    });
    expect(d.completa).toBe(true);
    expect(d.faltantes).toEqual([]);
    expect(d.sugerencia).toBe(
      "ADQUISICIÓN DE SERVIDOR DE DATOS PARA LAS ÁREAS ADMINISTRATIVAS DE MUNICIPALIDAD DISTRITAL DE CHALLHUAHUACHO — 2026",
    );
  });

  // Los formatos oficiales, el SEACE y las bases estándar denominan en
  // mayúsculas. Los acentos se conservan ("ADQUISICIÓN", no "ADQUISICION").
  it("la denominación va en mayúsculas, con acentos", () => {
    const d = componerDenominacion({
      ...REQ_0004,
      descripcionCatalogo: "servidor",
      areaUsuaria: "las áreas",
    });
    expect(d.sugerencia).toBe(d.sugerencia.toUpperCase());
    expect(d.sugerencia).toContain("ADQUISICIÓN");
  });

  // Caso real reportado: la población beneficiaria ya traía la entidad y el
  // distrito, así que encadenar el ámbito detrás repetía el nombre tres veces.
  it("no repite el ámbito si la población ya lo menciona", () => {
    const d = componerDenominacion({
      tipoObjeto: "bienes",
      descripcionCatalogo: "SERVIDOR PARA EL SISTEMA INTEGRADO DE GESTION ADMINISTRATIVA (SIGA)",
      areaUsuaria: "MUNICIPALIDAD DISTRITAL DE CHALLHUAHUACHO-DEL DISTRITO DE CHALLHUAHUACHO",
      entidad: "Municipalidad distrital de Challhuahuacho",
      distrito: "CHALLHUAHUACHO",
      anioFiscal: 2026,
    });
    // La entidad no se vuelve a añadir: ya estaba dicha (aunque con otra grafía).
    expect(d.sugerencia).not.toContain("DE MUNICIPALIDAD DISTRITAL DE CHALLHUAHUACHO —");
    expect(d.sugerencia).toBe(
      "ADQUISICIÓN DE SERVIDOR PARA EL SISTEMA INTEGRADO DE GESTION ADMINISTRATIVA (SIGA) PARA MUNICIPALIDAD DISTRITAL DE CHALLHUAHUACHO-DEL DISTRITO DE CHALLHUAHUACHO — 2026",
    );
  });

  it("la detección de repetición ignora acentos, mayúsculas y guiones", () => {
    const d = componerDenominacion({
      ...REQ_0004,
      descripcionCatalogo: "servidor",
      // Misma entidad, grafía distinta a la de `entidad`.
      areaUsuaria: "obreros de la MUNICIPALIDAD-DISTRITAL de challhuahuacho",
      entidad: "Municipalidad Distrital de Challhuahuacho",
    });
    expect((d.sugerencia.match(/CHALLHUAHUACHO/g) ?? []).length).toBe(1);
  });

  it("el verbo lo fija el objeto contractual (Art. 44.10)", () => {
    const base = { ...REQ_0004, descripcionCatalogo: "X", areaUsuaria: "Y" };
    expect(componerDenominacion({ ...base, tipoObjeto: "bienes" }).sugerencia).toMatch(/^ADQUISICIÓN DE/);
    expect(componerDenominacion({ ...base, tipoObjeto: "servicios" }).sugerencia).toMatch(/^SERVICIO DE/);
    expect(componerDenominacion({ ...base, tipoObjeto: "obras" }).sugerencia).toMatch(/^EJECUCIÓN DE LA OBRA/);
    expect(componerDenominacion({ ...base, tipoObjeto: "consultoria_obra" }).sugerencia).toMatch(/^CONSULTORÍA PARA/);
  });

  // Lo importante: no rellenar huecos por su cuenta. El nombre acaba en el
  // Anexo N° 2 y en un informe firmado.
  it("señala lo que falta en vez de inventarlo", () => {
    const d = componerDenominacion(REQ_0004);
    expect(d.completa).toBe(false);
    expect(d.faltantes.map((f) => f.campo)).toEqual(["descripcion_catalogo"]);
    expect(d.sugerencia).toContain("⟨QUÉ SE CONTRATA⟩");
    // Cada faltante dice dónde se rellena.
    expect(d.faltantes[0].seccion).toBe("Objeto de la contratación");
  });

  it("el destinatario es el área usuaria", () => {
    const d = componerDenominacion({ ...REQ_0004, descripcionCatalogo: "servidor" });
    expect(d.sugerencia).toContain("PARA GERENCIA DE SERVICIOS MUNICIPALES");
    // La población beneficiaria ya no es una pieza: no puede faltar.
    expect(d.faltantes.map((f) => f.campo)).not.toContain("poblacion_beneficiaria");
  });

  it("sin entidad cae al distrito para el ámbito", () => {
    const d = componerDenominacion({
      ...REQ_0004,
      descripcionCatalogo: "servidor",
      areaUsuaria: "las áreas administrativas",
    });
    expect(d.sugerencia).toContain("DE DISTRITO DE CHALLHUAHUACHO");
  });

  it("tipo de objeto desconocido se señala y no inventa verbo", () => {
    const d = componerDenominacion({ ...REQ_0004, tipoObjeto: "otra_cosa" });
    expect(d.sugerencia).toContain("⟨ACCIÓN⟩");
    expect(d.faltantes.map((f) => f.campo)).toContain("tipo_objeto");
  });
});

// Art. 44.6: el requerimiento no refiere marca, fabricante ni origen, "ni
// descripción que oriente la contratación hacia ellos".
describe("detectarMarca", () => {
  it("caza marcas frecuentes", () => {
    expect(detectarMarca("Adquisición de servidor HP ProLiant")).toContainEqual({
      termino: "hp",
      tipo: "marca",
    });
    expect(detectarMarca("Adquisición de laptops Lenovo")[0].termino).toBe("lenovo");
  });

  it("caza los giros que orientan sin nombrar la marca", () => {
    expect(detectarMarca("Servidor compatible con Dell PowerEdge").map((a) => a.termino)).toContain(
      "compatible con",
    );
    expect(detectarMarca("Equipo similar a la marca Bosch").map((a) => a.tipo)).toContain("giro");
  });

  it("no salta con nombres genéricos y limpios", () => {
    expect(detectarMarca("Adquisición de servidor de datos para la entidad")).toEqual([]);
    expect(detectarMarca("Adquisición de leche evaporada entera")).toEqual([]);
  });

  // Con límites de palabra: "hp" dentro de otra palabra no es una marca.
  it("no confunde una marca con una subcadena", () => {
    expect(detectarMarca("Adquisición de champú y jabón")).toEqual([]);
    expect(detectarMarca("Servicio de amoblamiento")).toEqual([]);
  });

  it("es indiferente a mayúsculas y acentos", () => {
    expect(detectarMarca("ADQUISICIÓN DE MONITORES SAMSUNG").length).toBeGreaterThan(0);
  });
});

// La componen dos sitios (derivar y renombrar). Si divergen, un expediente
// renombrado tendría un formato distinto al de los recién derivados.
describe("nomenclaturaExpediente", () => {
  it("une código y nombre con el separador del formato", () => {
    expect(nomenclaturaExpediente("REQ-2026-0004", "Adquisición de servidor")).toBe(
      "REQ-2026-0004 — Adquisición de servidor",
    );
  });

  it("sin código devuelve solo el nombre", () => {
    expect(nomenclaturaExpediente(null, "Adquisición de servidor")).toBe("Adquisición de servidor");
    expect(nomenclaturaExpediente("", "Adquisición de servidor")).toBe("Adquisición de servidor");
  });

  it("sin nombre devuelve solo el código (no deja el separador colgando)", () => {
    expect(nomenclaturaExpediente("REQ-2026-0004", null)).toBe("REQ-2026-0004");
    expect(nomenclaturaExpediente("REQ-2026-0004", "   ")).toBe("REQ-2026-0004");
  });

  it("sin nada devuelve cadena vacía (el llamante decide qué hacer)", () => {
    expect(nomenclaturaExpediente(null, null)).toBe("");
  });

  it("recorta los espacios sobrantes", () => {
    expect(nomenclaturaExpediente("  REQ-2026-0004  ", "  Adquisición  ")).toBe(
      "REQ-2026-0004 — Adquisición",
    );
  });
});
