import { describe, expect, it } from "vitest";
import { PROCESOS_SELECCION, esNoCompetitivo } from "@/lib/procesos-seleccion";
import { PROCEDIMIENTOS_COMPETITIVOS, procedimientoGenerico } from "@/lib/estrategia-formato";

/**
 * A4 a) muestra el proceso ESPECÍFICO de la ficha (los 21 de los Arts. 93/94/95),
 * pero por debajo se deriva el procedimiento GENÉRICO del Art. 54 (los 7) con el
 * que trabajan el cronograma y los plazos. `procedimientoGenerico` es esa
 * traducción. El test recorre el catálogo entero: un proceso nuevo que no derive
 * a un genérico válido salta aquí y no en un documento firmado.
 */
const VALIDOS = new Set(PROCEDIMIENTOS_COMPETITIVOS.map((p) => p.value));

describe("procedimientoGenerico · deriva el genérico del Art. 54 desde el proceso de la ficha", () => {
  it("todo proceso del catálogo deriva a un genérico válido o a null (nunca a un valor inventado)", () => {
    for (const p of PROCESOS_SELECCION) {
      const r = procedimientoGenerico(p.value);
      if (r !== null) expect(VALIDOS, `${p.value} → ${r}`).toContain(r);
    }
  });

  it("los no competitivos y el «por definir» no derivan (van a la variable b)", () => {
    for (const p of PROCESOS_SELECCION) {
      if (esNoCompetitivo(p.value) || p.value === "") {
        expect(procedimientoGenerico(p.value)).toBeNull();
      }
    }
  });

  it("Licitación → licitacion_publica; Concurso → concurso_publico; y la abreviada se conserva", () => {
    expect(procedimientoGenerico("Licitación Pública para bienes")).toBe("licitacion_publica");
    expect(procedimientoGenerico("Licitación Pública abreviada de obras")).toBe("licitacion_publica_abreviada");
    expect(procedimientoGenerico("Concurso Público de servicios")).toBe("concurso_publico");
    expect(procedimientoGenerico("Concurso Público abreviado")).toBe("concurso_publico_abreviado");
  });

  it("las diferenciadas del Art. 95 derivan a su propio valor", () => {
    expect(procedimientoGenerico("Subasta Inversa Electrónica")).toBe("subasta_inversa_electronica");
    expect(procedimientoGenerico("Comparación de Precios")).toBe("comparacion_precios");
    expect(procedimientoGenerico("Asociación para la Innovación")).toBe("compra_publica_innovacion");
    expect(procedimientoGenerico("Compra Pública Precomercial")).toBe("compra_publica_innovacion");
  });

  it("un valor genérico ya resuelto (dato antiguo) se devuelve tal cual", () => {
    expect(procedimientoGenerico("licitacion_publica_abreviada")).toBe("licitacion_publica_abreviada");
    expect(procedimientoGenerico("subasta_inversa_electronica")).toBe("subasta_inversa_electronica");
  });

  it("sin proceso no afirma nada", () => {
    expect(procedimientoGenerico(null)).toBeNull();
    expect(procedimientoGenerico("")).toBeNull();
    expect(procedimientoGenerico("Procedimiento de Selección No Competitivo")).toBeNull();
  });
});
