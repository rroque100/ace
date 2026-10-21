import { describe, expect, it } from "vitest";
import { processTypeLabel } from "@/lib/legal-taxonomy";
import { PROCEDIMIENTOS_COMPETITIVOS } from "@/lib/estrategia-formato";

describe("processTypeLabel conoce la Ley 32069", () => {
  it("etiqueta los 7 códigos del select de A4", () => {
    // Devolvía null y la cabecera de a) del Formato de Estrategia salía vacía
    // en cualquier expediente con procedimiento nuevo.
    for (const p of PROCEDIMIENTOS_COMPETITIVOS) {
      expect(processTypeLabel(p.value), p.value).toBeTruthy();
    }
  });

  it("etiqueta los códigos del catálogo de Configuración", () => {
    expect(processTypeLabel("licitacion_publica_abreviada_bienes")).toContain("Abreviada");
    expect(processTypeLabel("procedimiento_no_competitivo")).toContain("No Competitivo");
    expect(processTypeLabel("contrato_menor")).toBe("Contrato Menor");
  });

  it("sigue etiquetando los códigos históricos (Ley 30225)", () => {
    // El módulo documental filtra documentos antiguos con estos valores: no se
    // eliminan, solo dejan de ser la única lista.
    expect(processTypeLabel("adjudicacion_simplificada")).toBeTruthy();
    expect(processTypeLabel("contratacion_directa")).toBeTruthy();
  });
});
