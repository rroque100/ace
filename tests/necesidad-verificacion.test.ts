import { describe, expect, it } from "vitest";
import type { Necesidad } from "@/lib/necesidades";
import { resumenNecesidad, verificarNecesidad } from "@/lib/necesidad-verificacion";

// REQ-2026-0004 tal y como está en Supabase, recortado a lo que se verifica.
const REAL = {
  finalidad_publica: "Garantizar el adecuado funcionamiento del SIGA-MEF…",
  tipo_objeto: "bienes",
  descripcion_general: "Adquisición de un servidor para el SIGA-MEF, según el detalle del cuadro de ítems.",
  descripcion_detallada: "Servidor para el SIGA-MEF, 64 GB RAM…",
  cantidad: 1,
  unidad_medida: "UNIDAD",
  alcance: "Los bienes se entregan en el almacén central…",
  requisitos_calificacion:
    "OBLIGATORIOS:\n- Experiencia del postor en la especialidad: monto facturado acumulado equivalente S/. 200,000.00 (Doscientos Mil con 00/100 Soles)…",
  modalidad_pago: "SUMA ALZADA",
  sistema_entrega: null,
  fecha_requerida: "2026-04-22",
  monto_estimado: 90_000,
  cmn_verificado: true,
} as unknown as Necesidad;

const HOY = "2026-07-17";

const item = (n: Necesidad, etiqueta: string, hoy = HOY) =>
  verificarNecesidad(n, [], hoy)
    .flatMap((g) => g.items)
    .find((i) => i.etiqueta.includes(etiqueta));

describe("verificarNecesidad · agrupa por artículo", () => {
  it("los grupos siguen el orden del Art. 44: por qué → qué → en qué condiciones", () => {
    expect(verificarNecesidad(REAL, [], HOY).map((g) => g.articulo)).toEqual([
      "Art. 44.1 · Finalidad pública",
      "Art. 44.10 · Objeto y descripción",
      "Art. 44.2 · Condiciones de contratación (de corresponder)",
      "Arts. 54.2 y 54.3 · Lo que exigirá el expediente",
      "Coherencia de la ficha",
    ]);
  });
});

// Lo que bloquea APROBAR el expediente (Arts. 54.2.a y 54.3) se comprueba ya en
// la ficha, para que el impedimento no aparezca dos fases más tarde y ante otra
// persona. Avisa, no bloquea: el 42.3 permite la contratación no programada y el
// 54.2.a pide declarar si está estandarizado, no que lo esté.
describe("Arts. 54.2 y 54.3 · el impedimento del expediente, avisado a tiempo", () => {
  it("avisa si la necesidad no consta en el CMN, sin impedir remitir", () => {
    const sinCmn = { ...REAL, cmn_verificado: false } as Necesidad;
    const i = item(sinCmn, "no consta en el CMN");
    expect(i?.nivel).toBe("warn");
    expect(i?.porque).toContain("54.3");
    expect(resumenNecesidad(sinCmn, [], HOY).lista).toBe(true);
  });

  it("avisa si no se declaró si el requerimiento está estandarizado", () => {
    const i = item({ ...REAL, verificacion_ficha_tecnica: false } as Necesidad, "está estandarizado");
    expect(i?.nivel).toBe("warn");
    expect(i?.porque).toContain("54.2.a");
    expect(i?.campo).toBe("verificacionFichaTecnica");
  });

  it("con ambos resueltos, el grupo queda conforme", () => {
    const ok = { ...REAL, cmn_verificado: true, verificacion_ficha_tecnica: true } as Necesidad;
    const grupo = verificarNecesidad(ok, [], HOY).find((g) => g.articulo.startsWith("Arts. 54"));
    expect(grupo?.items.every((i) => i.nivel === "ok")).toBe(true);
  });

  it("ninguno de los dos bloquea nunca: son exigencias del expediente, no de remitir", () => {
    const peor = { ...REAL, cmn_verificado: false, verificacion_ficha_tecnica: false } as Necesidad;
    const grupo = verificarNecesidad(peor, [], HOY).find((g) => g.articulo.startsWith("Arts. 54"));
    expect(grupo?.items.some((i) => i.nivel === "stop")).toBe(false);
  });
});

describe("Art. 44.1 · lo que de verdad bloquea", () => {
  it("sin finalidad pública no hay nada que contratar", () => {
    const i = item({ ...REAL, finalidad_publica: null } as Necesidad, "Finalidad pública")!;
    expect(i.nivel).toBe("stop");
    expect(i.porque).toContain("44.1");
    expect(i.campo).toBe("finalidadPublica");
  });
});

describe("Art. 44.2 · «de corresponder» no es «obligatorio»", () => {
  it("el sistema de entrega sin proponer avisa, no bloquea", () => {
    const i = item(REAL, "sistema de entrega")!;
    expect(i.nivel).toBe("warn");
    expect(i.porque).toContain("no se distingue");
  });

  it("ninguna condición del 44.2 bloquea nunca: la norma dice «de corresponder»", () => {
    const vacia = {
      ...REAL,
      alcance: null,
      requisitos_calificacion: null,
      modalidad_pago: null,
      sistema_entrega: null,
    } as Necesidad;
    const grupo = verificarNecesidad(vacia, [], HOY).find((g) => g.articulo.startsWith("Art. 44.2"))!;
    expect(grupo.items.every((i) => i.nivel === "warn")).toBe(true);
  });
});

describe("Art. 44.6 · exigencias desproporcionadas", () => {
  it("enseña la pareja de números en vez de juzgar (el caso real)", () => {
    const i = item(REAL, "Requisitos proporcionados")!;
    expect(i.nivel).toBe("warn");
    expect(i.porque).toContain("S/ 200,000");
    expect(i.porque).toContain("S/ 90,000");
    expect(i.porque).toContain("2.2×");
    expect(i.porque).toContain("44.6");
  });

  it("con el valor real del mercado la exigencia deja de ser desproporcionada", () => {
    expect(item({ ...REAL, monto_estimado: 285_924 } as Necesidad, "Requisitos proporcionados")).toBeUndefined();
  });

  it("no acusa cuando no hay importes en los requisitos ni monto que comparar", () => {
    expect(item({ ...REAL, requisitos_calificacion: "Capacidad legal: RNP vigente." } as Necesidad, "Requisitos proporcionados")).toBeUndefined();
    expect(item({ ...REAL, monto_estimado: null } as Necesidad, "Requisitos proporcionados")).toBeUndefined();
  });
});

describe("coherencia · la fecha requerida", () => {
  it("una fecha ya pasada avisa pero NO bloquea", () => {
    // El Art. 44.2 no exige una "fecha requerida"; el cronograma (Art. 46.1.o)
    // es un estimado que la DEC elabora después. Una fecha pasada no impide
    // remitir el requerimiento.
    const i = item(REAL, "ya pasó")!;
    expect(i.nivel).toBe("warn");
    expect(i.porque).toContain("2026-04-22");
    expect(i.porque).toContain("46.1.o");
  });

  it("una fecha futura es conforme", () => {
    expect(item({ ...REAL, fecha_requerida: "2026-12-31" } as Necesidad, "Fecha para la que")!.nivel).toBe("ok");
  });

  it("sin fecha avisa de lo que se pierde", () => {
    const i = item({ ...REAL, fecha_requerida: null } as Necesidad, "Fecha para la que")!;
    expect(i.nivel).toBe("warn");
  });
});

describe("resumenNecesidad · ¿puede remitirse?", () => {
  it("el expediente real SÍ puede remitirse aunque la fecha ya pasó (solo avisa)", () => {
    const r = resumenNecesidad(REAL, [], HOY);
    expect(r.lista).toBe(true);
    expect(r.bloquean).toBe(0);
    // Sigue habiendo avisos (fecha vencida, sistema de entrega…): listo no es perfecto.
    expect(r.conformes).toBeLessThan(r.total);
  });

  it("una necesidad sana está lista", () => {
    const sana = {
      ...REAL,
      sistema_entrega: "No aplica",
      fecha_requerida: "2026-12-31",
      monto_estimado: 285_924,
      // Sana también para lo que exigirá el expediente (Arts. 54.2.a y 54.3).
      verificacion_ficha_tecnica: true,
    } as Necesidad;
    const r = resumenNecesidad(sana, [], HOY);
    expect(r.lista).toBe(true);
    expect(r.bloquean).toBe(0);
    expect(r.conformes).toBe(r.total);
  });

  it("una ficha vacía bloquea por lo esencial, no por todo", () => {
    const r = resumenNecesidad({} as Necesidad, [], HOY);
    // Los tres que no se pueden suplir: finalidad (44.1), objeto (44.10) y
    // descripción general del requerimiento (44.2). El detalle técnico / TDR
    // (126.1) NO bloquea —es «de corresponder» y puede adjuntarse como PDF—.
    expect(r.bloquean).toBe(3);
    expect(r.lista).toBe(false);
  });
});
