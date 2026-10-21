import { describe, expect, it } from "vitest";
import {
  contenidoExpediente,
  faltaParaAprobar,
  puedeAprobarExpediente,
} from "@/lib/expediente-contenido";
import type { HitosMap } from "@/lib/procurement-fases";

/**
 * El Art. 54.2 enumera literal por literal lo que el expediente contiene, y cada
 * literal es el producto de un paso: la norma escribe el grafo de dependencias
 * de la Fase 1. Estos tests fijan esa transcripción.
 */

// Un expediente completo, para ir quitándole piezas.
const COMPLETO: HitosMap = {
  A1: { data: { en_cmn: true }, status: "hecho" },
  A3: { data: { estandarizado: false }, status: "hecho" },
  A4: { data: {}, status: "hecho" },
  A5: { data: {}, status: "hecho" },
  A6: { data: {}, status: "hecho" },
  A7: { data: { monto: 285_924 }, status: "hecho" },
};
const VALOR = 285_924;

const lit = (hitos: HitosMap, literal: string, valor: number | null = VALOR) =>
  contenidoExpediente(hitos, valor).filter((i) => i.literal === literal);

describe("Art. 54.2 · qué contiene el expediente", () => {
  it("un expediente completo se puede aprobar", () => {
    expect(puedeAprobarExpediente(COMPLETO, VALOR)).toBe(true);
    expect(faltaParaAprobar(COMPLETO, VALOR)).toEqual([]);
  });

  it("cada literal se enseña con su número, para poder verificarlo", () => {
    expect(contenidoExpediente(COMPLETO, VALOR).map((i) => i.literal)).toEqual([
      "54.3",
      "54.2.a",
      "44.3",
      "54.2.c",
      "54.2.c",
      "46.1.n",
      "54.2.d",
      "54.2.e",
      "54.2.f",
      "125.2",
    ]);
  });
});

describe("Art. 54.3 · previsto en el CMN", () => {
  it("sin CMN no se aprueba", () => {
    const hitos = { ...COMPLETO, A1: { data: { en_cmn: false }, status: "hecho" as const } };
    const i = lit(hitos, "54.3")[0];
    expect(i.cumple).toBe(false);
    expect(i.detalle).toContain("CMN");
    expect(puedeAprobarExpediente(hitos, VALOR)).toBe(false);
  });
});

describe("Art. 54.2.a · requerimiento final, indicando si está estandarizado", () => {
  it("pide las dos cosas: el requerimiento cerrado Y la declaración", () => {
    const sinDeclarar = { ...COMPLETO, A3: { data: {}, status: "hecho" as const } };
    const i = lit(sinDeclarar, "54.2.a")[0];
    expect(i.cumple).toBe(false);
    expect(i.detalle).toContain("estandarizado");
  });

  it("declarar que NO está estandarizado también cumple", () => {
    expect(lit(COMPLETO, "54.2.a")[0].cumple).toBe(true);
  });

  it("el select Sí/NO ('si'/'no') satisface el criterio", () => {
    for (const v of ["si", "no"]) {
      const hitos = { ...COMPLETO, A3: { data: { estandarizado: v }, status: "hecho" as const } };
      expect(lit(hitos, "54.2.a")[0].cumple, `estandarizado='${v}'`).toBe(true);
    }
  });

  it("el booleano de datos antiguos sigue valiendo (retrocompatible)", () => {
    for (const v of [true, false]) {
      const hitos = { ...COMPLETO, A3: { data: { estandarizado: v }, status: "hecho" as const } };
      expect(lit(hitos, "54.2.a")[0].cumple, `estandarizado=${v}`).toBe(true);
    }
  });

  it("con A3 sin cerrar, falta", () => {
    const hitos = { ...COMPLETO, A3: { data: { estandarizado: "si" }, status: "en_curso" as const } };
    expect(lit(hitos, "54.2.a")[0].cumple).toBe(false);
  });
});

describe("Art. 54.2.c · la interacción va DENTRO de la estrategia", () => {
  it("son dos piezas del mismo literal", () => {
    expect(lit(COMPLETO, "54.2.c").map((i) => i.etiqueta)).toEqual([
      "Estrategia de contratación",
      "Interacción con el mercado realizada",
    ]);
  });

  it("«según corresponda»: una interacción marcada como no aplicable no bloquea", () => {
    // Art. 101.1: los no competitivos no interactúan con el mercado.
    const hitos = { ...COMPLETO, A5: { data: {}, status: "na" as const } };
    const i = lit(hitos, "54.2.c")[1];
    expect(i.cumple).toBe(true);
    expect(i.noAplica).toBe(true);
    expect(puedeAprobarExpediente(hitos, VALOR)).toBe(true);
  });

  it("pero la estrategia en sí no tiene «según corresponda»", () => {
    const hitos = { ...COMPLETO, A4: { data: {}, status: "en_curso" as const } };
    expect(lit(hitos, "54.2.c")[0].cumple).toBe(false);
  });
});

describe("Art. 54.2.d · la cuantía", () => {
  it("sin cuantía no se aprueba, y dice de dónde sale", () => {
    const i = lit(COMPLETO, "54.2.d", null)[0];
    expect(i.cumple).toBe(false);
    expect(i.detalle).toContain("47.1");
    expect(i.paso).toBe("A5");
  });
});

describe("Art. 54.2.e y f · evaluadores y presupuesto", () => {
  it("sin designar evaluadores no se aprueba, y explica por qué importa", () => {
    const hitos = { ...COMPLETO, A6: { data: {}, status: "pendiente" as const } };
    const i = lit(hitos, "54.2.e")[0];
    expect(i.cumple).toBe(false);
    expect(i.detalle).toContain("55.1"); // sin evaluador nadie elabora las bases
  });

  it("sin certificación no se aprueba", () => {
    const hitos = { ...COMPLETO, A7: { data: {}, status: "en_curso" as const } };
    expect(lit(hitos, "54.2.f")[0].cumple).toBe(false);
  });

  it("un monto de cero no es una certificación", () => {
    const hitos = { ...COMPLETO, A7: { data: { monto: 0 }, status: "hecho" as const } };
    expect(lit(hitos, "54.2.f")[0].cumple).toBe(false);
  });

  it("con 'ambas' la cobertura es la suma de la CCP y la previsión", () => {
    // La ejecución cruza años fiscales (Art. 53.1 y 54.2.f, según la normativa
    // presupuestal vigente): ni la CCP ni la previsión cubren solas, pero juntas
    // sí. El literal 54.2.f debe cumplirse.
    const hitos = {
      ...COMPLETO,
      A7: {
        data: { tipo: "ambas", monto_ccp: 120_000, monto_prevision: 165_924 },
        status: "hecho" as const,
      },
    };
    expect(lit(hitos, "54.2.f")[0].cumple).toBe(true);
  });

  it("con 'ambas' sin ninguno de los dos montos no se aprueba", () => {
    const hitos = { ...COMPLETO, A7: { data: { tipo: "ambas" }, status: "hecho" as const } };
    expect(lit(hitos, "54.2.f")[0].cumple).toBe(false);
  });

  // GAP 1: la certificación no basta con que exista; debe CUBRIR la cuantía.
  it("una certificación que no cubre el valor estimado bloquea (Art. 53)", () => {
    const hitos = { ...COMPLETO, A7: { data: { monto: 50_000 }, status: "hecho" as const } };
    const i = lit(hitos, "54.2.f")[0];
    expect(i.cumple).toBe(false);
    expect(i.detalle).toContain("no cubre");
    expect(i.detalle).toContain("Art. 53");
    expect(puedeAprobarExpediente(hitos, VALOR)).toBe(false);
  });

  it("una certificación que iguala el valor estimado cubre", () => {
    const hitos = { ...COMPLETO, A7: { data: { monto: VALOR }, status: "hecho" as const } };
    expect(lit(hitos, "54.2.f")[0].cumple).toBe(true);
  });

  it("sin cuantía aún (A5 abierto) el 54.2.f solo exige que exista, no cobertura", () => {
    // Con valorEstimado null lo bloquea el 54.2.d, no el 54.2.f.
    const hitos = { ...COMPLETO, A7: { data: { monto: 10 }, status: "hecho" as const } };
    expect(lit(hitos, "54.2.f", null)[0].cumple).toBe(true);
  });
});

describe("Art. 125.2 · la cuantía real no puede reclasificar la segmentación (A2↔A5)", () => {
  const conA2 = (a2: Record<string, unknown>): HitosMap => ({
    ...COMPLETO,
    A2: { data: a2, status: "hecho" },
  });
  const RUTINARIA = { objeto: "bienes_servicios", cuantiaAlta: false, condicionesRiesgo: [] };

  it("sin PAC no se puede comprobar: no aplica y no bloquea", () => {
    const i = lit(conA2(RUTINARIA), "125.2")[0];
    expect(i.noAplica).toBe(true);
    expect(i.cumple).toBe(true);
  });

  it("si la cuantía real mantiene la categoría, cumple", () => {
    // PAC 1,000,000 → línea de corte ~105,000; cuantía 50,000 sigue siendo baja.
    const falta = faltaParaAprobar(conA2(RUTINARIA), 50_000, 1_000_000);
    expect(falta.find((x) => x.literal === "125.2")).toBeUndefined();
  });

  it("si la cuantía real sube la categoría, falla y bloquea la aprobación", () => {
    // PAC 100,000 → línea 15,000; cuantía 50,000 la supera → deja de ser Rutinaria.
    const hitos = conA2(RUTINARIA);
    const i = contenidoExpediente(hitos, 50_000, 100_000).find((x) => x.literal === "125.2")!;
    expect(i.cumple).toBe(false);
    expect(i.detalle).toContain("Rutinaria");
    expect(i.detalle).toContain("Operacional");
    expect(puedeAprobarExpediente(hitos, 50_000, 100_000)).toBe(false);
  });

  it("las obras no tienen línea de corte por cuantía: no aplica aunque haya PAC", () => {
    const hitos = conA2({ objeto: "obras_consultoria_obras", criteriosBasica: [] });
    const i = contenidoExpediente(hitos, 500_000, 100_000).find((x) => x.literal === "125.2")!;
    expect(i.noAplica).toBe(true);
    expect(i.cumple).toBe(true);
  });
});

describe("Art. 44.3 · matriz de riesgos obligatoria según la segmentación", () => {
  // A2 (segmentación) + A3 completo, sobre un expediente por lo demás aprobable.
  // El A5 lleva una consulta al mercado avanzada (2 herramientas): satisface el
  // nivel mínimo de CUALQUIER categoría (46.1.n), de modo que aquí el único
  // literal en juego sea la matriz del 44.3 y no lo enmascare el de nivel.
  const A5_SUFICIENTE = {
    nivel: "consulta_mercado_avanzada",
    herr_difusion: true,
    herr_reuniones_individuales: true,
  };
  const conSeg = (a2: Record<string, unknown>, a3Extra: Record<string, unknown> = {}): HitosMap => ({
    ...COMPLETO,
    A2: { data: a2, status: "hecho" },
    A3: { data: { estandarizado: false, ...a3Extra }, status: "hecho" },
    A5: { data: A5_SUFICIENTE, status: "hecho" },
  });

  // Inputs de A2 que producen cada categoría (ver clasificarSegmentacion).
  const OBLIGA = {
    "Estratégico": { objeto: "bienes_servicios", cuantiaAlta: true, condicionesRiesgo: ["x"] },
    "Contratación avanzada": { objeto: "obras_consultoria_obras", criteriosBasica: [] },
  } as const;
  const NO_OBLIGA = {
    "Rutinaria": { objeto: "bienes_servicios", cuantiaAlta: false, condicionesRiesgo: [] },
    "Operacional": { objeto: "bienes_servicios", cuantiaAlta: true, condicionesRiesgo: [] },
    "Crítico": { objeto: "bienes_servicios", cuantiaAlta: false, condicionesRiesgo: ["x"] },
    "Contratación básica": { objeto: "obras_consultoria_obras", esIoarr: true },
  } as const;

  it("en Estratégico y Contratación avanzada, sin matriz en A3, falta y bloquea", () => {
    for (const [label, a2] of Object.entries(OBLIGA)) {
      const hitos = conSeg(a2);
      const i = lit(hitos, "44.3")[0];
      expect(i.cumple, label).toBe(false);
      expect(i.noAplica, label).toBeFalsy();
      expect(i.detalle, label).toContain("44.3");
      expect(i.detalle, label).toContain(label);
      expect(puedeAprobarExpediente(hitos, VALOR), label).toBe(false);
    }
  });

  it("cumple si A3 trae la asignación de riesgos (Art. 44.3)", () => {
    const hitos = conSeg(OBLIGA["Estratégico"], {
      riesgos_asignacion: "La entidad asume el riesgo regulatorio; el contratista, el de ejecución.",
    });
    expect(lit(hitos, "44.3")[0].cumple).toBe(true);
    expect(puedeAprobarExpediente(hitos, VALOR)).toBe(true);
  });

  it("respaldo: la matriz heredada en condiciones_obra también cumple", () => {
    const hitos = conSeg(OBLIGA["Contratación avanzada"], {
      condiciones_obra: "Gestión de riesgos: MATRIZ DE GESTIÓN DE RIESGOS\n| Riesgo | ... |",
    });
    expect(lit(hitos, "44.3")[0].cumple).toBe(true);
  });

  it("en los demás cuadrantes no es exigible (no aplica, no bloquea)", () => {
    for (const [label, a2] of Object.entries(NO_OBLIGA)) {
      const hitos = conSeg(a2); // A3 sin matriz
      const i = lit(hitos, "44.3")[0];
      expect(i.cumple, label).toBe(true);
      expect(i.noAplica, label).toBe(true);
      expect(puedeAprobarExpediente(hitos, VALOR), label).toBe(true);
    }
  });

  it("sin A2 segmentado no se exige lo que aún no se ha clasificado", () => {
    // COMPLETO no tiene A2.
    const i = lit(COMPLETO, "44.3")[0];
    expect(i.cumple).toBe(true);
    expect(i.noAplica).toBe(true);
  });
});

describe("Art. 46.1.n · el nivel de interacción de A5 alcanza el mínimo de A2", () => {
  // A2 segmentado + A5 cerrado con las casillas del Anexo N° 1 marcadas
  // (fuente_*/herr_* son las keys de FUENTES_ANEXO1/HERRAMIENTAS_ANEXO1).
  const conNivel = (a2: Record<string, unknown>, a5: Record<string, unknown>): HitosMap => ({
    ...COMPLETO,
    A2: { data: a2, status: "hecho" },
    A5: { data: a5, status: "hecho" },
  });
  // Inputs de A2 y el nivel de interacción que exige cada uno.
  const OPERACIONAL = { objeto: "bienes_servicios", cuantiaAlta: true, condicionesRiesgo: [] }; // indagación avanzada: 2+ fuentes
  const ESTRATEGICO = { objeto: "bienes_servicios", cuantiaAlta: true, condicionesRiesgo: ["x"] }; // consulta avanzada: 2+ herramientas
  const RUTINARIA = { objeto: "bienes_servicios", cuantiaAlta: false, condicionesRiesgo: [] }; // indagación básica: 1 fuente
  // A3 con matriz de riesgos, para que en las categorías que la obligan (44.3)
  // el fallo quede aislado al nivel de interacción y no lo enmascare el 44.3.
  const conMatriz = { estandarizado: false, riesgos_asignacion: "La entidad asume el riesgo regulatorio." };

  it("indagación avanzada con una sola fuente no alcanza: falta y bloquea", () => {
    const hitos = conNivel(OPERACIONAL, { nivel: "indagacion_avanzada", fuente_historica: true });
    const i = lit(hitos, "46.1.n")[0];
    expect(i.cumple).toBe(false);
    expect(i.noAplica).toBeFalsy();
    expect(i.detalle).toContain("Indagación avanzada");
    expect(puedeAprobarExpediente(hitos, VALOR)).toBe(false);
  });

  it("con las dos fuentes marcadas, cumple y se puede aprobar", () => {
    const hitos = conNivel(OPERACIONAL, {
      nivel: "indagacion_avanzada",
      fuente_historica: true,
      fuente_pladicop: true,
    });
    expect(lit(hitos, "46.1.n")[0].cumple).toBe(true);
    expect(puedeAprobarExpediente(hitos, VALOR)).toBe(true);
  });

  it("consulta avanzada con una sola herramienta no alcanza (el hueco que faltaba)", () => {
    // Estratégico exige consulta al mercado avanzada: 2+ herramientas. Una sola
    // deja la interacción en «básica» aunque el radio diga «avanzada».
    const hitos = conNivel(ESTRATEGICO, { nivel: "consulta_mercado_avanzada", herr_difusion: true });
    hitos.A3 = { data: conMatriz, status: "hecho" };
    const i = lit(hitos, "46.1.n")[0];
    expect(i.cumple).toBe(false);
    expect(i.detalle).toContain("49.2");
    expect(puedeAprobarExpediente(hitos, VALOR)).toBe(false);
  });

  it("con dos herramientas, la consulta avanzada cumple", () => {
    const hitos = conNivel(ESTRATEGICO, {
      nivel: "consulta_mercado_avanzada",
      herr_difusion: true,
      herr_reuniones_individuales: true,
    });
    hitos.A3 = { data: conMatriz, status: "hecho" };
    expect(lit(hitos, "46.1.n")[0].cumple).toBe(true);
    expect(puedeAprobarExpediente(hitos, VALOR)).toBe(true);
  });

  it("una fuente basta para la indagación básica de una rutinaria", () => {
    const hitos = conNivel(RUTINARIA, { nivel: "indagacion_basica", fuente_historica: true });
    expect(lit(hitos, "46.1.n")[0].cumple).toBe(true);
  });

  it("hacer MÁS de lo exigido cumple: una consulta cuando bastaba indagación", () => {
    // Rutinaria solo pide indagación básica; una consulta la supera en jerarquía.
    const hitos = conNivel(RUTINARIA, { nivel: "consulta_mercado_basica", herr_difusion: true });
    expect(lit(hitos, "46.1.n")[0].cumple).toBe(true);
  });

  it("elegir el nivel pero no marcar ninguna casilla no alcanza", () => {
    const hitos = conNivel(ESTRATEGICO, { nivel: "consulta_mercado_avanzada" });
    hitos.A3 = { data: conMatriz, status: "hecho" };
    const i = lit(hitos, "46.1.n")[0];
    expect(i.cumple).toBe(false);
    expect(i.detalle).toContain("sin fuentes ni herramientas");
  });

  it("«según corresponda»: una interacción no aplicable (no competitivo) no exige nivel", () => {
    const hitos = { ...conNivel(ESTRATEGICO, {}), A5: { data: {}, status: "na" as const } };
    const i = lit(hitos, "46.1.n")[0];
    expect(i.cumple).toBe(true);
    expect(i.noAplica).toBe(true);
  });

  it("sin A2 segmentado no se exige lo que aún no se ha clasificado", () => {
    const i = lit(COMPLETO, "46.1.n")[0];
    expect(i.cumple).toBe(true);
    expect(i.noAplica).toBe(true);
  });
});

describe("el expediente real (REQ-2026-0004) no se puede aprobar todavía", () => {
  const REAL: HitosMap = {
    A1: { data: { en_cmn: true, en_pac: false }, status: "hecho" },
    A2: { data: {}, status: "hecho" },
    A3: { data: { estandarizado: false }, status: "hecho" },
    A4: { data: {}, status: "en_curso" },
    A5: { data: {}, status: "hecho" },
    A7: { data: { monto: 90_000 }, status: "en_curso" },
  };

  it("le faltan la estrategia, la cuantía y los evaluadores", () => {
    // valor_estimado sigue en null en la base hasta que se guarde A5.
    const falta = faltaParaAprobar(REAL, null);
    expect(falta.map((i) => i.literal)).toEqual(["54.2.c", "54.2.d", "54.2.e"]);
    expect(puedeAprobarExpediente(REAL, null)).toBe(false);
  });

  it("el CMN y el requerimiento sí están", () => {
    expect(lit(REAL, "54.3", null)[0].cumple).toBe(true);
    expect(lit(REAL, "54.2.a", null)[0].cumple).toBe(true);
  });
});
