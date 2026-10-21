import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { generarExcelF1, previewHoja, type ProcesoExport } from "@/lib/fase1-export";
import type { HitosMap } from "@/lib/procurement-fases";

const proceso: ProcesoExport = {
  amount: 285_924,
  entity: "MDCH",
  nomenclature: "N° 42-2026",
  object_type: "bienes",
  procedure_type: null,
  valor_estimado: 285_924,
};

const hitos: HitosMap = {
  A1: { data: { procedimiento_pac: "licitacion_publica" }, status: "hecho" },
  A2: { data: { condicionesRiesgo: [], cuantiaAlta: false, objeto: "bienes_servicios" }, status: "hecho" },
  A4: { data: { var_a_procedimiento: "licitacion_publica", var_e_tipo_evaluador: "comite" }, status: "hecho" },
  A5: { data: { herr_solicitud: true, nivel: "consulta_mercado_basica" }, status: "hecho" },
  // A6/A7/A8 alimentan el Anexo N° 2 (designación, CCP, aprobación).
  A6: { data: { documento_designacion: "MEMO 45-2026" }, status: "hecho" },
  A7: { data: { numero: "6119", monto: 77700.6 }, status: "hecho" },
  A8: { data: { autoridad: "GERENCIA MUNICIPAL", numero_documento: "RES-014" }, status: "hecho" },
};

describe("la vista previa ES la hoja que se descarga", () => {
  it("cada celda de la previa coincide con la del .xlsx", async () => {
    // Si la previa saliera de otro código, podría mentir sobre lo que acabas
    // descargando — y entonces no serviría para revisar nada.
    for (const formato of ["estrategia", "anexo1", "anexo2"] as const) {
      const previa = await previewHoja(formato, { hitos, proceso });
      const { buffer } = await generarExcelF1(formato, { hitos, proceso });
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);
      const ws = wb.worksheets[0];
      const leer = (a: string) => {
        const c = ws.getCell(a);
        const t = c.isMerged ? c.master : c;
        const v = t.value;
        if (v == null) return "";
        if (typeof v === "object" && "richText" in v && Array.isArray(v.richText)) {
          return v.richText.map((x: { text?: string }) => x.text ?? "").join("");
        }
        return String(v);
      };
      for (const fila of previa.filas) {
        for (const c of fila) expect(c.texto, `${formato} ${c.celda}`).toBe(leer(c.celda));
      }
    }
  });

  it("conserva los rótulos del formato, no solo lo que se rellena", async () => {
    const { filas } = await previewHoja("anexo1", { hitos, proceso });
    const todo = filas.flat().map((c) => c.texto).join(" ");
    expect(todo).toContain("ANEXO N° 1");
    expect(todo).toContain("INDAGACIÓN");
    expect(todo).toContain("CONSULTA AL MERCADO");
    expect(todo).toContain("Señalar el objeto contractual:");
  });

  it("marca las (X) y distingue lo que rellena ACE del rótulo impreso", async () => {
    const { filas } = await previewHoja("anexo1", { hitos, proceso });
    const celdas = filas.flat();
    const marcas = celdas.filter((c) => c.marca);
    expect(marcas.length).toBeGreaterThan(0);
    for (const m of marcas) expect(m.texto.trim()).toBe("X");
    // Las (X) las pone ACE: son relleno, no plantilla.
    for (const m of marcas) expect(m.relleno, m.celda).toBe(true);
    // Y un rótulo de la plantilla NO es relleno.
    const rotulo = celdas.find((c) => c.texto.includes("Señalar el objeto contractual"));
    expect(rotulo?.relleno).toBe(false);
  });

  it("respeta las celdas combinadas: solo pinta el ancla, con su colspan", async () => {
    const { filas } = await previewHoja("anexo1", { hitos, proceso });
    const titulo = filas.flat().find((c) => c.texto.includes("ANEXO N° 1"));
    // B1:J1 → 9 columnas.
    expect(titulo?.celda).toBe("B1");
    expect(titulo?.colspan).toBe(9);
  });
});

// Las combinaciones (merges) del formato deben renderizarse como UNA celda con
// su colspan, no como celdas duplicadas: si no, la fila suma más de 9 columnas
// y la grilla se descuadra frente al Excel.
describe("la grilla de la vista previa cuadra con el formato", () => {
  it("ninguna fila supera las 9 columnas (B..J)", async () => {
    const hoja = await previewHoja("estrategia", {
      proceso,
      hitos: {
        A4: {
          data: {
            var_a_sustento_cambio: "S",
            var_e_perfil_evaluador: "Perfil",
            var_e_tipo_evaluador: "comite",
            cronograma_items: [{ fase: "seleccion", actividad: "Convocatoria", inicio: "2026-08-10", fin: "2026-08-10" }],
            factores_items: [{ nombre: "Precio", sustento: "Menor precio" }],
          },
          status: "hecho",
        },
      },
    });
    for (const [i, fila] of hoja.filas.entries()) {
      const suma = fila.reduce((n, c) => n + c.colspan, 0);
      expect(suma, `fila ${i + 1} suma ${suma} columnas`).toBeLessThanOrEqual(9);
    }
  });

  it("la fila del título es una sola celda que ocupa todo el ancho", async () => {
    const hoja = await previewHoja("estrategia", { proceso, hitos: { A4: { data: {}, status: "hecho" } } });
    expect(hoja.filas[0]).toHaveLength(1);
    expect(hoja.filas[0][0].colspan).toBe(9);
    expect(hoja.filas[0][0].texto).toContain("FORMATO DE ESTRATEGIA");
  });

  it("devuelve los anchos de columna del Excel (B..J)", async () => {
    const hoja = await previewHoja("estrategia", { proceso, hitos: { A4: { data: {}, status: "hecho" } } });
    expect(hoja.anchos).toHaveLength(9);
    expect(hoja.anchos.every((w) => w > 0)).toBe(true);
  });
});

// El cronograma se EXPANDE (más actividades que filas de plantilla). Las filas
// insertadas por duplicateRow no deben repetir el rótulo de fase ni arrastrar
// el placeholder "[...]" de la plantilla, ni descuadrar la grilla.
describe("cronograma expandido en la vista previa", () => {
  it("no repite el rótulo de fase, no deja [...] y cuadra a 9 columnas", async () => {
    const { actividadesSeleccionDe } = await import("@/lib/estrategia-formato");
    const acts = actividadesSeleccionDe("licitacion_publica");
    const crono = [
      ...acts.map((a, i) => ({ fase: "seleccion" as const, actividad: a, inicio: `2026-08-1${i % 9}`, fin: `2026-08-2${i % 9}` })),
      { fase: "ejecucion" as const, actividad: "Suscripción del contrato", inicio: "2026-09-01", fin: "2026-09-03" },
      { fase: "ejecucion" as const, actividad: "Ejecución contractual", inicio: "2026-09-04", fin: "2026-10-04" },
    ];
    const hoja = await previewHoja("estrategia", {
      proceso,
      hitos: { A4: { data: { cronograma_items: crono }, status: "hecho" } },
    });
    for (const [i, fila] of hoja.filas.entries()) {
      const suma = fila.reduce((n, c) => n + c.colspan, 0);
      expect(suma, `fila ${i + 1} suma ${suma}`).toBeLessThanOrEqual(9);
    }
    const cronoTxt = hoja.filas
      .map((f) => f.map((c) => c.texto).join("|"))
      .filter((t) => /Convocatoria|Absoluci|Suscripci/.test(t))
      .join("\n");
    // El rótulo "Fase de selección:" aparece una sola vez en todo el formato.
    const veces = hoja.filas.flatMap((f) => f).filter((c) => /Fase de selección:/.test(c.texto)).length;
    expect(veces).toBe(1);
    // Las actividades del cronograma no arrastran el placeholder de la plantilla.
    expect(cronoTxt).not.toContain("[...]");
    expect(cronoTxt).not.toContain("[Insertar actividad");
    // Todas las actividades de selección están presentes.
    for (const a of acts) expect(hoja.filas.some((f) => f.some((c) => c.texto.includes(a))), a).toBe(true);
  });
});

describe("ejecución contractual en el cronograma", () => {
  it("SEGÚN BASES solo en 'Ejecución contractual'; el resto de la fase lleva fecha", async () => {
    const c = await (async () => {
      const { generarExcelF1 } = await import("@/lib/fase1-export");
      const { buffer } = await generarExcelF1("estrategia", {
        proceso,
        hitos: {
          A4: {
            data: {
              cronograma_items: [
                { fase: "seleccion", actividad: "Convocatoria", inicio: "2026-08-10", fin: "2026-08-10" },
                { fase: "ejecucion", actividad: "Suscripción del contrato", inicio: "2026-09-01", fin: "2026-09-03" },
                { fase: "ejecucion", actividad: "Ejecución contractual", inicio: "2026-09-04", fin: "2026-10-04" },
              ],
            },
            status: "hecho",
          },
        },
      });
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);
      const ws = wb.worksheets[0];
      return (addr: string) => String(ws.getCell(addr).value ?? "").trim();
    })();
    // Ejecución: fila 138 = Suscripción (con fecha), fila 139 = Ejecución
    // contractual (SEGÚN BASES).
    expect(c("C138")).toBe("Suscripción del contrato");
    expect(c("G138")).toBe("01/09/2026");
    expect(c("I138")).toBe("03/09/2026");
    expect(c("C139")).toBe("Ejecución contractual");
    expect(c("G139")).toBe("SEGÚN BASES");
    expect(c("I139")).toBe("SEGÚN BASES");
  });
});

// o) y p) son tablas que se EXPANDEN. duplicateRow no copia las combinaciones y
// deja el modelo de merges desincronizado (rangos fantasma), así que las filas
// insertadas salían como 9 celdas sueltas y descuadradas respecto a la cabecera.
describe("o) y p) mantienen la estructura del formato al expandirse", () => {
  it("cada fila del cronograma es Fase | Actividad | Inicio | Fin", async () => {
    const { actividadesSeleccionDe, ACTIVIDADES_EJECUCION_SUGERIDAS } = await import("@/lib/estrategia-formato");
    const crono = [
      ...actividadesSeleccionDe("licitacion_publica").map((a, i) => ({ fase: "seleccion" as const, actividad: a, inicio: `2026-08-1${i % 9}`, fin: `2026-08-2${i % 9}` })),
      ...ACTIVIDADES_EJECUCION_SUGERIDAS.map((a, i) => ({ fase: "ejecucion" as const, actividad: a, inicio: `2026-09-0${i + 1}`, fin: `2026-09-1${i + 1}` })),
    ];
    const hoja = await previewHoja("estrategia", { proceso, hitos: { A4: { data: { cronograma_items: crono }, status: "hecho" } } });
    const filasActividad = hoja.filas.filter((f) =>
      f.some((c) => /Convocatoria|Registro de participantes|Consultas y observaciones|Otorgamiento de la buena pro|Suscripción del contrato/.test(c.texto)),
    );
    expect(filasActividad.length).toBeGreaterThan(3);
    for (const fila of filasActividad) {
      // La actividad ocupa 4 columnas (C:F) y cada fecha 2 (G:H, I:J).
      expect(fila.some((c) => c.colspan === 4), "actividad C:F").toBe(true);
      expect(fila.filter((c) => c.colspan === 2).length, "fechas G:H e I:J").toBe(2);
    }
  });

  it("cada fila de roles es Rol (B:E) | Etapa (F:J)", async () => {
    const { ROLES_HABITUALES, textoRolHabitual } = await import("@/lib/estrategia-formato");
    const roles = ROLES_HABITUALES.map((r) => ({ rol: textoRolHabitual(r), etapa: r.etapa }));
    const hoja = await previewHoja("estrategia", { proceso, hitos: { A4: { data: { roles_items: roles }, status: "hecho" } } });
    const filasRol = hoja.filas.filter((f) => f.some((c) => ROLES_HABITUALES.some((r) => c.texto.startsWith(r.involucrado))));
    expect(filasRol).toHaveLength(ROLES_HABITUALES.length);
    for (const fila of filasRol) {
      expect(fila.map((c) => c.colspan)).toEqual([4, 5]);
    }
  });
});

describe("o) la previa oculta el bloque de obras si el objeto no es obra (igual que el .xls)", () => {
  const textosDe = async (objectType: string) => {
    const hoja = await previewHoja("estrategia", {
      hitos: { A4: { data: {}, status: "hecho" } },
      proceso: { ...proceso, object_type: objectType },
    });
    return hoja.filas.flat().map((c) => c.texto).join("  |  ");
  };

  it("un BIEN no muestra 'II. SOLO PARA OBRAS' en la previa, pero sí lo que va después", async () => {
    const t = await textosDe("bienes");
    expect(t).not.toContain("SOLO PARA OBRAS");
    expect(t).toContain("OTRAS CONSIDERACIONES");
  });

  it("una OBRA sí muestra el bloque", async () => {
    expect(await textosDe("obra")).toContain("SOLO PARA OBRAS");
  });
})
