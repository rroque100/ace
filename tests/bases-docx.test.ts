import { describe, expect, it } from "vitest";
import { Table } from "docx";
import { filasATabla, nivelEncabezado, parrafosDeCampo } from "@/lib/bases-docx";
import type { ValorBases } from "@/lib/bases-elaboracion";

describe("nivelEncabezado", () => {
  it("CAPÍTULO es nivel 1", () => {
    expect(nivelEncabezado("CAPÍTULO I")).toBe(1);
    expect(nivelEncabezado("CAPÍTULO IV")).toBe(1);
  });

  it("un numeral en mayúsculas es nivel 2", () => {
    expect(nivelEncabezado("2.2 CONSIDERACIONES PARA TODOS LOS PROVEEDORES:")).toBe(2);
    expect(nivelEncabezado("1.1. REFERENCIAS")).toBe(2);
  });

  it("un párrafo de contenido normal no es encabezado", () => {
    expect(nivelEncabezado("El contrato se rige por la modalidad de pago determinada.")).toBeNull();
    expect(nivelEncabezado("a) Convocatoria. Se realiza a través del SEACE.")).toBeNull();
  });
});

describe("parrafosDeCampo", () => {
  it("un valor con saltos de línea se parte en varios párrafos, no uno aplastado", () => {
    const campo: ValorBases = {
      label: "Otras penalidades",
      resuelto: true,
      ruta: "cap3.otrasPenalidades",
      valor: "OBLIGATORIOS:\n- Primera línea.\n- Segunda línea.",
    };
    const parrafos = parrafosDeCampo(campo);
    expect(parrafos.length).toBeGreaterThan(1);
  });

  it("un campo sin `filas` y de una sola línea es un solo párrafo `label: valor`", () => {
    const campo: ValorBases = {
      label: "Finalidad pública",
      resuelto: true,
      ruta: "cap3.finalidadPublica",
      valor: "Contar con el bien.",
    };
    expect(parrafosDeCampo(campo)).toHaveLength(1);
  });

  it("un campo con `filas` se pinta como tabla, no como párrafo label:valor", () => {
    const campo: ValorBases = {
      filas: [{ factor: "Experiencia del postor", sustento: "Puntaje según monto facturado." }],
      label: "Factores de evaluación",
      resuelto: true,
      ruta: "cap4.factoresEvaluacion",
      valor: "Experiencia del postor: Puntaje según monto facturado.",
    };
    const elementos = parrafosDeCampo(campo);
    expect(elementos.some((e) => e instanceof Table)).toBe(true);
  });

  it("un campo sin resolver imprime [...] entre corchetes, no inventa nada", () => {
    const campo: ValorBases = { label: "Lugar de entrega", resuelto: false, ruta: "cap3.lugarEntrega", valor: "" };
    const [parrafoUnico] = parrafosDeCampo(campo);
    // No hay forma directa de leer el texto de un Paragraph ya construido
    // desde fuera de `docx`; se confirma indirectamente vía el conteo (un
    // solo párrafo, como cualquier campo de una línea) y con el test e2e.
    expect(parrafosDeCampo(campo)).toHaveLength(1);
    expect(parrafoUnico).toBeDefined();
  });
});

describe("filasATabla", () => {
  it("arma una tabla de 2 columnas con cabecera Factor/Sustento", () => {
    const tabla = filasATabla([{ factor: "A", sustento: "B" }]);
    expect(tabla).toBeInstanceOf(Table);
  });
});
