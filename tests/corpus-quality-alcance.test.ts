import { describe, expect, it } from "vitest";
import { documentAppliesToProcess } from "@/lib/corpus-quality";
import { LEY_32069_PROCESOS_CATALOGO } from "@/lib/procesos-catalogo-32069";

// El panel de cobertura de /documentos daba verde en falso: `!document.process_type`
// hacía que un documento SIN clasificar respaldara a TODOS los procedimientos. Con
// un único modelo sin proceso —el del no competitivo— los diez procedimientos que
// evaluaba salían "operativo", incluidos «Adjudicación Simplificada» y «Acuerdo
// Marco», que ni siquiera existen en la Ley 32069.

function doc(over: Partial<Parameters<typeof documentAppliesToProcess>[0]> = {}) {
  return {
    document_type: "bases_integradas",
    file_name: null,
    id: "d1",
    metadata: {},
    process_type: null,
    status: "indexed",
    title: "doc",
    ...over,
  } as Parameters<typeof documentAppliesToProcess>[0];
}

const UNO = "licitacion_publica_para_bienes";
const OTRO = "concurso_publico_de_servicios";

describe("alcance de un documento sobre un procedimiento", () => {
  it("«todos» respalda a cualquier procedimiento: es Ley y Reglamento", () => {
    const ley = doc({ document_type: "ley", process_type: "todos" });
    expect(documentAppliesToProcess(ley, UNO)).toBe(true);
    expect(documentAppliesToProcess(ley, OTRO)).toBe(true);
  });

  it("las opiniones del OECE son de alcance general aunque no declaren proceso", () => {
    // Se suben así a propósito (processScopeFor → "general").
    const opinion = doc({ document_type: "opinion", process_type: null });
    expect(documentAppliesToProcess(opinion, UNO)).toBe(true);
    expect(documentAppliesToProcess(opinion, OTRO)).toBe(true);
  });

  it("unas bases SIN proceso declarado ya no respaldan a ninguno", () => {
    // Este es el fallo: antes devolvía true para los 18.
    const sinProceso = doc({ process_type: null });
    for (const p of LEY_32069_PROCESOS_CATALOGO) {
      expect(documentAppliesToProcess(sinProceso, p.code), p.label).toBe(false);
    }
  });

  it("una directiva respalda solo al procedimiento que declara", () => {
    const directiva = doc({ document_type: "directiva", process_type: "subasta_inversa_electronica" });
    expect(documentAppliesToProcess(directiva, "subasta_inversa_electronica")).toBe(true);
    expect(documentAppliesToProcess(directiva, UNO)).toBe(false);
  });

  it("el vínculo del modelo manda sobre el process_type heredado", () => {
    // Los 15 modelos tienen process_type grueso ("concurso_publico") y el vínculo
    // exacto en metadata. Debe contar el vínculo.
    const modelo = doc({
      metadata: { kind: "modelo_requerimiento", procesoSeleccion: "Concurso Público de servicios" },
      process_type: "concurso_publico",
    });
    expect(documentAppliesToProcess(modelo, OTRO)).toBe(true);
    expect(documentAppliesToProcess(modelo, "concurso_publico_de_consultoria")).toBe(false);
    expect(documentAppliesToProcess(modelo, UNO)).toBe(false);
  });

  it("el vocabulario grueso heredado respalda a su familia, no a otras", () => {
    const heredado = doc({ process_type: "licitacion_publica" });
    expect(documentAppliesToProcess(heredado, UNO)).toBe(true);
    expect(documentAppliesToProcess(heredado, "licitacion_publica_de_obras")).toBe(true);
    expect(documentAppliesToProcess(heredado, OTRO)).toBe(false);
  });

  it("un modelo cuenta para todo procedimiento que lo declare como base", () => {
    // El catálogo dice que el modelo de obras vale para la licitación de obras,
    // la de precalificación y la de negociación. El copiloto lo usa para las
    // tres (resolverModeloDocId cae al nombre del archivo), así que el panel no
    // puede decir "sin modelo" de dos de ellas.
    const obras = doc({
      file_name: "REQUERIMIENTO LICITACIÓN PÚBLICA DE OBRAS.pdf",
      metadata: { kind: "modelo_requerimiento", procesoSeleccion: "Licitación Pública de obras" },
    });
    expect(documentAppliesToProcess(obras, "licitacion_publica_de_obras")).toBe(true);
    expect(documentAppliesToProcess(obras, "licitacion_publica_de_obras_con_precalificacion")).toBe(true);
    expect(documentAppliesToProcess(obras, "licitacion_publica_de_obras_con_negociacion")).toBe(true);
    // Pero no para uno que no lo declara.
    expect(documentAppliesToProcess(obras, "concurso_publico_de_servicios")).toBe(false);
    expect(documentAppliesToProcess(obras, "licitacion_publica_para_bienes")).toBe(false);
  });

  it("un vínculo en blanco no cuenta como vínculo", () => {
    const raro = doc({ metadata: { procesoSeleccion: "   " }, process_type: "licitacion_publica" });
    expect(documentAppliesToProcess(raro, UNO)).toBe(true);
  });
});

describe("qué procedimientos se evalúan", () => {
  it("son los 21 del régimen vigente, sin vocabulario derogado", () => {
    // 9 del Art. 93 + 6 del Art. 94 + 5 del Art. 95 + el no competitivo del Art. 55.
    expect(LEY_32069_PROCESOS_CATALOGO).toHaveLength(21);
    const codigos = LEY_32069_PROCESOS_CATALOGO.map((p) => p.code);
    for (const derogado of ["adjudicacion_simplificada", "acuerdo_marco", "seleccion_consultores_individuales", "procedimiento_especial", "otros"]) {
      expect(codigos, derogado).not.toContain(derogado);
    }
  });
});
