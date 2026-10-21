import { describe, expect, it } from "vitest";
import { compactFilter } from "@/lib/pinecone";
import { filtrarModelosPorObjeto } from "@/lib/necesidad-copiloto";

// Un procedimiento del Reglamento puede tener VARIAS plantillas: el «Concurso
// Público abreviado» del Art. 94 es uno solo y la entidad tiene cuatro modelos
// (servicios, consultoría en general, consultoría de obra y mantenimiento vial).
// El copiloto se quedaba con el más reciente, así que acertaba una de cada
// cuatro. Ahora ancla en el CONJUNTO y deja que el ranking del RAG elija, después
// de descartar los que ni siquiera son del objeto de la necesidad.

const modelo = (nombre: string, objeto?: string) => ({
  file_name: nombre,
  metadata: objeto ? { kind: "modelo_requerimiento", objeto } : { kind: "modelo_requerimiento" },
});

const ABREVIADOS = [
  modelo("ABREVIADO DE SERVICIOS.pdf", "servicios"),
  modelo("ABREVIADO PARA CONSULTORÍA EN GENERAL.pdf", "servicios"),
  modelo("ABREVIADO PARA CONSULTORÍA DE OBRA.pdf", "consultoria_obra"),
  modelo("ABREVIADO PARA MANTENIMIENTO VIAL.pdf", "servicios"),
];

describe("filtrarModelosPorObjeto", () => {
  it("una consultoría de obra no compite por un servicio, ni al revés", () => {
    expect(filtrarModelosPorObjeto(ABREVIADOS, "servicios").map((m) => m.file_name)).toEqual([
      "ABREVIADO DE SERVICIOS.pdf",
      "ABREVIADO PARA CONSULTORÍA EN GENERAL.pdf",
      "ABREVIADO PARA MANTENIMIENTO VIAL.pdf",
    ]);
    expect(filtrarModelosPorObjeto(ABREVIADOS, "consultoria_obra").map((m) => m.file_name)).toEqual([
      "ABREVIADO PARA CONSULTORÍA DE OBRA.pdf",
    ]);
  });

  it("sin objeto en la necesidad, no descarta nada", () => {
    for (const sin of ["", "   ", null, undefined]) {
      expect(filtrarModelosPorObjeto(ABREVIADOS, sin)).toHaveLength(4);
    }
  });

  it("un modelo que no declara objeto sigue compitiendo", () => {
    // Es como quedaron los subidos antes de que existiera el campo: no se les
    // puede excluir por un dato que nadie les puso.
    const conUnoSinDeclarar = [...ABREVIADOS, modelo("PLANTILLA INTERNA.pdf")];
    expect(filtrarModelosPorObjeto(conUnoSinDeclarar, "consultoria_obra").map((m) => m.file_name)).toEqual([
      "ABREVIADO PARA CONSULTORÍA DE OBRA.pdf",
      "PLANTILLA INTERNA.pdf",
    ]);
  });

  it("si el filtro dejaría la lista vacía, devuelve la original", () => {
    // Mejor un modelo de otro objeto que ninguno: el copiloto degrada a redactar
    // solo con el corpus legal, que es peor.
    expect(filtrarModelosPorObjeto(ABREVIADOS, "obras")).toHaveLength(4);
  });
});

describe("compactFilter · anclar el RAG en varios documentos", () => {
  it("con varios ids usa $in", () => {
    expect(compactFilter({ documentIds: ["a", "b", "c"] })).toEqual({
      document_id: { $in: ["a", "b", "c"] },
    });
  });

  it("con uno solo sigue usando $eq", () => {
    expect(compactFilter({ documentId: "a" })).toEqual({ document_id: { $eq: "a" } });
  });

  it("una lista vacía no filtra por documento: filtraría a cero resultados", () => {
    expect(compactFilter({ documentIds: [], documentType: "bases_integradas" })).toEqual({
      document_type: { $eq: "bases_integradas" },
    });
  });

  it("la lista manda sobre el id suelto si llegaran los dos", () => {
    expect(compactFilter({ documentId: "a", documentIds: ["b", "c"] })).toEqual({
      document_id: { $in: ["b", "c"] },
    });
  });
});
