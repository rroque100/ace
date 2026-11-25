import { expect, it } from "vitest";
import { verificarConcordanciaFicha } from "@/lib/necesidad-concordancia";

const adjunto = {
  id: "669596eb-dce6-4858-aa50-55cf48e87617",
  file_name: "TDR Allilluma.docx",
  metadata: { textoExtraido: "Código Único de Inversión (CUI), de corresponder\n:\n2402031\nPlazo de ejecución\n:\n90 días calendario (3 meses)" },
};
const procedimiento = "Licitación Pública abreviada de obras";

it("detecta las tres divergencias documentadas en Allilluma", () => {
  const hallazgos = verificarConcordanciaFicha({ tipo_objeto: "bienes", tipo_proceso_seleccion: procedimiento }, [adjunto]);
  expect(hallazgos.map((item) => item.ajuste)).toEqual([
    { tipoObjeto: "obras" }, { cui: "2402031" }, { plazoEjecucion: "90", plazoEjecucionUnidad: "calendario" },
  ]);
  expect(hallazgos.every((item) => item.bloquea)).toBe(true);
});

it("omite discrepancias ambiguas cuando hay varios adjuntos sin fuente confirmada", () => {
  const hallazgos = verificarConcordanciaFicha({ tipo_objeto: "obras", tipo_proceso_seleccion: procedimiento }, [
    adjunto, { ...adjunto, id: "otro" },
  ]);
  expect(hallazgos).toHaveLength(1);
  expect(hallazgos[0].bloquea).toBe(false);
});

it("señala el origen retirado y conserva la compatibilidad con matrices previas", () => {
  expect(verificarConcordanciaFicha({ gestion_riesgos: "Matriz anterior" }, [])[0].bloquea).toBe(false);
  expect(verificarConcordanciaFicha({ gestion_riesgos: `Identificador del adjunto: ${adjunto.id}` }, [])[0].bloquea).toBe(true);
});
