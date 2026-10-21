import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { generarExcelF1, type ProcesoExport } from "@/lib/fase1-export";
import type { HitosMap } from "@/lib/procurement-fases";

const proceso: ProcesoExport = {
  amount: 98_000,
  entity: "MDCH",
  nomenclature: "N° 42-2026-DEC-MDCH",
  object_type: "bienes",
  procedure_type: null,
  valor_estimado: 98_000,
};

async function hoja(a4: Record<string, unknown>) {
  const hitos: HitosMap = { A4: { data: a4, status: "hecho" } };
  const { buffer } = await generarExcelF1("estrategia", { hitos, proceso });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  const leer = (addr: string) => {
    const c = ws.getCell(addr);
    const t = c.isMerged ? c.master : c;
    const v = t.value;
    if (v == null) return "";
    if (typeof v === "object" && "richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((x: { text?: string }) => x.text ?? "").join("").trim();
    }
    return String(v).trim();
  };
  return { leer, ws };
}

/** Las 11 filas del formato firmado (SKM_651i26071505561.pdf). */
const CRONOGRAMA_REAL = [
  { fase: "preparatorias", actividad: "Aprobación del expediente", fin: "2026-07-16", inicio: "2026-07-16" },
  { fase: "preparatorias", actividad: "Elaboración de las bases", fin: "2026-07-16", inicio: "2026-07-16" },
  { fase: "seleccion", actividad: "Convocatoria", fin: "2026-07-17", inicio: "2026-07-17" },
  { fase: "seleccion", actividad: "Formulación de consultas y observaciones", fin: "2026-07-22", inicio: "2026-07-22" },
  { fase: "seleccion", actividad: "Absolución de consultas y observaciones", fin: "2026-07-23", inicio: "2026-07-23" },
  { fase: "seleccion", actividad: "Integración de las Bases", fin: "2026-07-23", inicio: "2026-07-23" },
  { fase: "seleccion", actividad: "Otorgamiento de buena pro", fin: "2026-07-30", inicio: "2026-07-30" },
  { fase: "seleccion", actividad: "Consentimiento de buena pro", fin: "2026-08-12", inicio: "2026-08-12" },
  { fase: "ejecucion", actividad: "Presentación de requisitos para firma", fin: "2026-08-24", inicio: "2026-08-13" },
  { fase: "ejecucion", actividad: "Suscripción del contrato", fin: "2026-08-27", inicio: "2026-08-16" },
  { fase: "ejecucion", actividad: "Ejecución contractual", fin: "SEGÚN BASES", inicio: "SEGÚN BASES" },
];

const ROLES_REAL = [
  { etapa: "actos_preparatorios", rol: "Área Usuaria: elabora las Especificaciones Técnicas" },
  { etapa: "actos_preparatorios", rol: "Oficina de Abastecimiento: planificación y segmentación" },
  { etapa: "convocatoria", rol: "Oficial de compra: elaboración y aprobación de bases" },
  { etapa: "post_convocatoria", rol: "Oficina de Abastecimiento: formalización contractual" },
  { etapa: "ejecucion_contractual", rol: "Área Usuaria: control de ingreso y conformidad" },
];

describe("o) Cronograma", () => {
  it("cabe en las 3 filas de la plantilla sin insertar nada", async () => {
    const { leer } = await hoja({
      cronograma_items: [
        { actividad: "Convocatoria", fase: "seleccion", fin: "2026-07-17", inicio: "2026-07-17" },
      ],
    });
    expect(leer("C135")).toBe("Convocatoria");
    expect(leer("G135")).toBe("17/07/2026");
    expect(leer("I135")).toBe("17/07/2026");
  });

  it("inserta filas cuando hay más actividades que huecos", async () => {
    // La plantilla trae 3 filas de selección; el formato firmado tiene 6.
    const { leer } = await hoja({ cronograma_items: CRONOGRAMA_REAL });
    expect(leer("C135")).toBe("Convocatoria");
    expect(leer("C140")).toBe("Consentimiento de buena pro"); // la 6.ª
    expect(leer("G140")).toBe("12/08/2026");
  });

  it("deja pasar el texto libre de la ejecución contractual", async () => {
    // El formato firmado pone "SEGÚN BASES", que no es una fecha.
    const { leer } = await hoja({ cronograma_items: CRONOGRAMA_REAL });
    expect(leer("G143")).toBe("SEGÚN BASES");
  });

  it("solo pone las fechas de las actividades preimpresas", async () => {
    const { leer } = await hoja({ cronograma_items: CRONOGRAMA_REAL });
    // La plantilla ya trae el texto de la actividad: no se pisa.
    expect(leer("C133")).toContain("Aprobación del expediente de contratación");
    expect(leer("G133")).toBe("16/07/2026");
  });
});

describe("p) Roles", () => {
  it("inserta filas: la plantilla trae 2 y el formato firmado tiene 5", async () => {
    const { leer } = await hoja({ roles_items: ROLES_REAL });
    expect(leer("B145")).toContain("Área Usuaria");
    expect(leer("F145")).toBe("ACTOS PREPARATORIOS");
    expect(leer("B149")).toContain("control de ingreso");
    expect(leer("F149")).toBe("EJECUCIÓN CONTRACTUAL");
  });
});

describe("insertar filas NO destroza el formato de abajo", () => {
  it("las variables q) a t) siguen en su sitio y con su contenido", async () => {
    // Es el riesgo real de duplicateRow: todo lo de debajo se desplaza. Por eso
    // el volcado va al final y de abajo hacia arriba.
    const { ws, leer } = await hoja({
      cronograma_items: CRONOGRAMA_REAL, // +3 filas de selección
      roles_items: ROLES_REAL, // +3 filas de roles
      var_s_objetivo: "Continuidad del SIAF",
    });
    const desplazamiento = 3 + 3;
    // s) estaba en B166; con 6 filas insertadas encima, ahora en B172.
    expect(leer(`B${166 + desplazamiento}`)).toBe("Continuidad del SIAF");
    // Y sus rótulos viajaron con él.
    const buscar = (txt: string) => {
      for (let r = 1; r <= ws.rowCount; r++) {
        const c = ws.getCell(`B${r}`);
        let v = "";
        try {
          v = String(c.text ?? "");
        } catch {
          /* celda combinada vacía */
        }
        if (v.includes(txt)) return r;
      }
      return -1;
    };
    expect(buscar("q) Evaluación de la posibilidad de agrupar"), "falta el rótulo de q)").toBeGreaterThan(0);
    expect(buscar("r) Verificación de si el requerimiento"), "falta el rótulo de r)").toBeGreaterThan(0);
    expect(buscar("II. SOLO PARA OBRAS Y CONSULTORÍA"), "falta la sección de obras").toBeGreaterThan(0);
  });
});

// o) Las actividades de la fase de selección dependen del procedimiento (a).
describe("actividadesSeleccionDe (Art. 46.1.o)", () => {
  it("licitación y concurso comparten la secuencia competitiva", async () => {
    const { actividadesSeleccionDe } = await import("@/lib/estrategia-formato");
    const lp = actividadesSeleccionDe("licitacion_publica");
    expect(lp).toContain("Convocatoria");
    expect(lp).toContain("Registro de participantes");
    expect(lp).toContain("Consultas y observaciones");
    expect(lp).toContain("Absolución e integración");
    expect(lp).toContain("Otorgamiento de la buena pro");
    // El cronograma de la fase de SELECCIÓN termina en el otorgamiento: el
    // consentimiento (Art. 82.1) es de la ejecución y ya no se lista aquí.
    expect(lp).not.toContain("Consentimiento de la buena pro");
    expect(actividadesSeleccionDe("concurso_publico")).toEqual(lp);
  });

  it("subasta inversa añade el periodo de lances (puja)", async () => {
    const { actividadesSeleccionDe } = await import("@/lib/estrategia-formato");
    const s = actividadesSeleccionDe("subasta_inversa_electronica");
    expect(s.some((a) => a.toLowerCase().includes("lances"))).toBe(true);
  });

  it("comparación de precios es una secuencia corta de cotizaciones", async () => {
    const { actividadesSeleccionDe } = await import("@/lib/estrategia-formato");
    const c = actividadesSeleccionDe("comparacion_precios");
    expect(c.some((a) => a.toLowerCase().includes("cotizacion"))).toBe(true);
    expect(c.length).toBeLessThan(actividadesSeleccionDe("licitacion_publica").length);
  });

  it("sin procedimiento cae en la lista genérica", async () => {
    const { actividadesSeleccionDe, ACTIVIDADES_SELECCION_SUGERIDAS } = await import("@/lib/estrategia-formato");
    expect(actividadesSeleccionDe(undefined)).toBe(ACTIVIDADES_SELECCION_SUGERIDAS);
  });
})

// La vista previa (previewHoja) usa duplicateRow para expandir el cronograma;
// tras duplicar, model.merges queda desfasado y ocultaba las últimas
// actividades. Deben aparecer TODAS, igual que en el Excel.
describe("o) todas las actividades cargan en la vista previa", () => {
  it("las 9 actividades de selección aparecen en la previa (no solo las 6 de plantilla)", async () => {
    const { previewHoja } = await import("@/lib/fase1-export");
    const sel = [
      "Convocatoria", "Registro de participantes", "Formulación de consultas y observaciones",
      "Absolución de consultas y observaciones", "Integración de las Bases", "Presentación de ofertas",
      "Evaluación y calificación de ofertas", "Otorgamiento de la buena pro", "Consentimiento de la buena pro",
    ].map((actividad) => ({ fase: "seleccion", actividad, inicio: "2026-08-19", fin: "2026-08-20" }));
    const hoja = await previewHoja("estrategia", {
      hitos: { A4: { data: { cronograma_items: sel }, status: "hecho" } },
      proceso: { nomenclature: "X", entity: "E", amount: 1, object_type: "bienes", procedure_type: null, valor_estimado: 1 },
    });
    const textos = new Set(hoja.filas.flat().map((c) => c.texto.trim()));
    for (const s of sel) expect(textos.has(s.actividad), s.actividad).toBe(true);
  });
});
