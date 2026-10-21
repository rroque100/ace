import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { pasoF1 } from "@/lib/actuaciones-preparatorias";
import {
  CELDA_SISTEMA_ENTREGA,
  OPCIONES_SISTEMA_ENTREGA,
  sistemaEntregaDeTexto,
} from "@/lib/estrategia-formato";
import { generarExcelF1, type ProcesoExport } from "@/lib/fase1-export";
import type { HitosMap } from "@/lib/procurement-fases";

const proceso: ProcesoExport = {
  amount: 98_000,
  entity: "MDCH",
  nomenclature: "N-1",
  object_type: "bienes",
  procedure_type: null,
  valor_estimado: 98_000,
};

async function hoja(hitos: HitosMap) {
  const { buffer } = await generarExcelF1("estrategia", { hitos, proceso });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  return (a: string) => {
    const c = ws.getCell(a);
    const t = c.isMerged ? c.master : c;
    const v = t.value;
    if (v == null) return "";
    if (typeof v === "object" && "richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((x: { text?: string }) => x.text ?? "").join("").trim();
    }
    return String(v).trim();
  };
}

const a4 = (data: Record<string, unknown>): HitosMap => ({ A4: { data, status: "hecho" } });

describe("i) sistema de entrega", () => {
  it("las 14 opciones del select tienen su celda", () => {
    // Si el value y la clave del mapa divergen, la casilla no se marca y no
    // falla nada. Es el fallo de COLUMNAS_SEED otra vez.
    for (const o of OPCIONES_SISTEMA_ENTREGA) {
      expect(CELDA_SISTEMA_ENTREGA[o.value], `falta la celda de "${o.value}"`).toBeTruthy();
    }
    expect(Object.keys(CELDA_SISTEMA_ENTREGA)).toHaveLength(OPCIONES_SISTEMA_ENTREGA.length);
  });

  it("marca la casilla elegida", async () => {
    const c = await hoja(a4({ var_i_sistema_entrega: "no_aplica" }));
    expect(c("J76")).toBe("X"); // No aplica — lo que dice el formato firmado
    expect(c("F74")).toBe(""); // y no otra
  });

  it("NO se hereda de la propuesta de A3: la estrategia es decisión de la DEC", async () => {
    // El 44.2 pone el sistema de entrega en boca del área usuaria, pero el 72.1
    // deja la decisión en la DEC. Marcar la casilla con la propuesta haría que
    // el documento afirme una decisión que nadie tomó, con la firma del
    // responsable al pie. La propuesta se ofrece en la UI con un botón.
    const c = await hoja({
      A3: { data: { propuesta_sistema_entrega: "Llave en mano con mantenimiento" }, status: "hecho" },
      A4: { data: {}, status: "hecho" },
    });
    expect(Object.values(CELDA_SISTEMA_ENTREGA).filter((celda) => c(celda) === "X")).toEqual([]);
  });

  it("sistemaEntregaDeTexto distingue llave en mano de llave en mano CON mantenimiento", () => {
    expect(sistemaEntregaDeTexto("Llave en mano")).toBe("llave_en_mano");
    expect(sistemaEntregaDeTexto("LLAVE EN MANO CON MANTENIMIENTO")).toBe("llave_en_mano_mantenimiento");
    expect(sistemaEntregaDeTexto("Cualquier cosa")).toBeNull();
  });
});

describe("f) requisitos de calificación", () => {
  it("reparte obligatorios (matriz) y facultativos (DEC) en filas distintas, no en un bloque", async () => {
    // El exportador volcaba TODO el bloque en B44. Ahora la obligatoriedad la
    // fija la matriz de bases estándar según el procedimiento (concurso →
    // capacidad técnica + experiencia), y los facultativos que registró la DEC
    // van a su propio bloque con su sustento.
    const c = await hoja(
      a4({
        var_a_proceso: "Concurso Público de servicios",
        var_f_requisitos_calificacion: "FACULTATIVOS:\n- CAPACIDAD LEGAL — Sustento: Vigencia de poder",
      }),
    );
    // Orden de TIPOS_REQUISITO_ART72: experiencia_postor va antes que
    // capacidad_tecnica desde el reordenamiento. Ambos son obligatorios por
    // bases estándar en Concurso.
    expect(c("B44")).toContain("Experiencia del postor");
    expect(c("B45")).toContain("Capacidad técnica");
    expect(c("B45")).toContain("Obligatorio por bases estándar");
    expect(c("B49")).toBe("CAPACIDAD LEGAL");
    expect(c("C49")).toContain("Vigencia de poder");
  });
});

describe("g) factores de evaluación", () => {
  it("reproduce los tres factores del formato firmado", async () => {
    // SKM_651i26071505561.pdf: PLAZO DE ENTREGA · INTEGRIDAD · GARANTÍA COMERCIAL.
    const c = await hoja(
      a4({
        factores_items: [
          { nombre: "PLAZO DE ENTREGA", sustento: "Se evaluará en función al plazo de entrega ofertado." },
          { nombre: "INTEGRIDAD EN LA CONTRATACIÓN PÚBLICA", sustento: "Certificación antisoborno." },
          { nombre: "GARANTÍA COMERCIAL DEL POSTOR", sustento: "Tiempo de garantía comercial ofertado." },
        ],
      }),
    );
    expect(c("B56")).toBe("PLAZO DE ENTREGA");
    expect(c("C56")).toContain("plazo de entrega ofertado");
    expect(c("B57")).toBe("INTEGRIDAD EN LA CONTRATACIÓN PÚBLICA");
    expect(c("B58")).toBe("GARANTÍA COMERCIAL DEL POSTOR");
  });

  it("inserta filas si hay más de tres factores", async () => {
    const c = await hoja(a4({ factores_items: [1, 2, 3, 4].map((n) => ({ nombre: `FACTOR ${n}` })) }));
    expect(c("B59")).toBe("FACTOR 4");
  });

  it("A4 ya no guarda los factores como texto libre", () => {
    const campos = pasoF1("A4")!.campos.map((x) => x.name);
    expect(campos).not.toContain("var_g_factores_evaluacion");
    expect(campos).toContain("factores_items");
  });
});

describe("la propuesta de A3 se normaliza para el select de i)", () => {
  it("el valor que ofrece 'Usar esta propuesta' existe en el select", async () => {
    // La ficha guarda "Llave en mano" (texto libre) y en A4 i) es un select:
    // sin normalizar, el botón metería un valor que no está en la lista y el
    // campo saldría vacío. Esto replica lo que hace propuestasA3 en el panel.
    const propuesta = "Llave en mano con mantenimiento";
    const normalizado = sistemaEntregaDeTexto(propuesta);
    expect(normalizado).toBeTruthy();
    expect(OPCIONES_SISTEMA_ENTREGA.map((o) => o.value)).toContain(normalizado);

    // Y adoptado, marca su casilla.
    const c = await hoja(a4({ var_i_sistema_entrega: normalizado! }));
    expect(c("F75")).toBe("X");
  });
});
