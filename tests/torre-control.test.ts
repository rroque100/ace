import { describe, expect, it } from "vitest";
import type { HitosMap } from "@/lib/procurement-fases";
import { cuantasBloquean, tarjetasDeControl, type EntradaTorre } from "@/lib/torre-control";

/**
 * Los datos reales de REQ-2026-0004. Cada paso, por separado, estaba "correcto";
 * el expediente entero no. La torre existe para ver lo que ninguna fase ve sola.
 */
const PAC_BIENES_SERVICIOS = 1_226_465.7;

const HITOS: HitosMap = {
  A1: { data: { en_pac: false, programada: false, en_cmn: true }, status: "hecho" },
  A2: {
    data: {
      objeto: "bienes_servicios",
      cuantiaAlta: false,
      condicionesRiesgo: ["disponibilidad_limitada", "no_contratado_antes"],
    },
    status: "hecho",
  },
  A3: { data: { plazo_dias: 6 }, status: "hecho" },
  A4: {
    data: {
      cronograma_items: [
        { fase: "seleccion", actividad: "Convocatoria", inicio: "2026-07-30", fin: "2026-07-30" },
        { fase: "ejecucion", actividad: "Suscripción del contrato", inicio: "2026-09-11", fin: "2026-09-15" },
        { fase: "ejecucion", actividad: "Ejecución contractual", inicio: "SEGÚN BASES", fin: "SEGÚN BASES" },
      ],
    },
    status: "en_curso",
  },
  A7: { data: { monto: 90_000 }, status: "en_curso" },
};

const BASE: EntradaTorre = {
  hitos: HITOS,
  valorEstimado: 285_924,
  montoNecesidad: 90_000,
  fechaRequerida: "2026-04-22",
  pacBienesServicios: PAC_BIENES_SERVICIOS,
  necesidad: { codigo: "REQ-2026-0004", status: "conforme" },
  divergencias: [],
};

const de = (e: EntradaTorre, clave: string) => tarjetasDeControl(e).find((t) => t.clave === clave)!;

describe("torre de control · el expediente real", () => {
  it("devuelve las cuatro parejas, siempre en el mismo orden", () => {
    expect(tarjetasDeControl(BASE).map((t) => t.clave)).toEqual([
      "origen",
      "cuantia",
      "presupuesto",
      "entrega",
    ]);
  });

  it("dos cosas bloquean la aprobación", () => {
    expect(cuantasBloquean(tarjetasDeControl(BASE))).toBe(2);
  });
});

describe("tarjeta de cuantía (Art. 47.1)", () => {
  it("enseña la brecha con lo que estimó el área usuaria", () => {
    const t = de(BASE, "cuantia");
    expect(t.valor).toBe("S/ 285,924.00");
    expect(t.nota).toContain("S/ 90,000.00");
    expect(t.nota).toContain("3.2×");
  });

  it("avisa de que la segmentación de A2 se queda corta, con su línea de corte", () => {
    const t = de(BASE, "cuantia");
    expect(t.nivel).toBe("stop");
    expect(t.nota).toContain("S/ 151,238.97"); // línea de corte con el valor real
    expect(t.nota).toContain("Crítico");
    expect(t.nota).toContain("Estratégico");
    expect(t.nota).toContain("consulta al mercado avanzada");
  });

  it("si la cuantía confirma la segmentación registrada, no reprocha nada", () => {
    // Con los S/ 90,000 del área usuaria, A2 clasificó bien: Crítico.
    const t = de({ ...BASE, valorEstimado: 90_000 }, "cuantia");
    expect(t.nivel).toBe("ok");
    expect(t.nota).not.toContain("pasa de");
  });

  it("sin valor estimado dice lo que se cae con ello", () => {
    const t = de({ ...BASE, valorEstimado: null }, "cuantia");
    expect(t.nivel).toBe("warn");
    expect(t.valor).toBe("Sin fijar");
    expect(t.nota).toContain("A2");
    expect(t.paso).toBe("A5");
  });

  it("sin PAC registrado no inventa una línea de corte", () => {
    const t = de({ ...BASE, pacBienesServicios: null }, "cuantia");
    expect(t.nota).not.toContain("línea de corte");
    expect(t.nivel).toBe("warn"); // la brecha con el área usuaria sí se ve
  });
});

describe("tarjeta de presupuesto (Arts. 53 / 54.2.f)", () => {
  it("la certificación no cubre el valor estimado", () => {
    const t = de(BASE, "presupuesto");
    expect(t.nivel).toBe("stop");
    expect(t.valor).toBe("S/ 90,000.00");
    expect(t.nota).toContain("S/ 285,924.00");
    expect(t.nota).toContain("amplía la certificación");
  });

  it("cubriéndolo, conforme", () => {
    const hitos = { ...HITOS, A7: { data: { monto: 300_000 }, status: "en_curso" as const } };
    expect(de({ ...BASE, hitos }, "presupuesto").nivel).toBe("ok");
  });

  it("sin certificación registrada no acusa: aún no toca", () => {
    const hitos = { ...HITOS, A7: { data: {}, status: "pendiente" as const } };
    const t = de({ ...BASE, hitos }, "presupuesto");
    expect(t.nivel).toBe("mute");
    expect(t.nota).toContain("A8");
  });
});

describe("tarjeta de entrega", () => {
  it("cuenta los días de retraso sobre la fecha requerida", () => {
    const t = de(BASE, "entrega");
    expect(t.nivel).toBe("warn");
    expect(t.valor).toBe("2026-09-21"); // firma + 6 días calendario
    expect(t.nota).toContain("152 días");
    expect(t.nota).toContain("2026-04-22");
  });

  it("llegando a tiempo, conforme", () => {
    expect(de({ ...BASE, fechaRequerida: "2026-12-31" }, "entrega").nivel).toBe("ok");
  });

  it("sin cronograma no se puede saber", () => {
    const hitos = { ...HITOS, A4: { data: {}, status: "en_curso" as const } };
    expect(de({ ...BASE, hitos }, "entrega").nivel).toBe("mute");
  });

  it("sin fecha requerida lo dice en vez de dar por bueno el cronograma", () => {
    const t = de({ ...BASE, fechaRequerida: null }, "entrega");
    expect(t.nivel).toBe("mute");
    expect(t.nota).toContain("no registra");
  });
});

describe("tarjeta de origen", () => {
  it("sin divergencias, la estrategia respeta lo propuesto", () => {
    expect(de(BASE, "origen").nivel).toBe("ok");
    expect(de(BASE, "origen").valor).toBe("REQ-2026-0004");
  });

  it("con divergencias cita el Art. 44.7 y las nombra", () => {
    const t = de({ ...BASE, divergencias: ["modalidad de pago"] }, "origen");
    expect(t.nivel).toBe("warn");
    expect(t.nota).toContain("modalidad de pago");
    expect(t.nota).toContain("44.7");
    expect(t.nota).toContain("un punto");
  });

  it("un expediente sin necesidad vinculada no puede heredar nada", () => {
    const t = de({ ...BASE, necesidad: null }, "origen");
    expect(t.nivel).toBe("warn");
    expect(t.nota).toContain("44.2");
  });
});

describe("un expediente sano no inventa problemas", () => {
  it("todas las tarjetas conformes", () => {
    const sano: EntradaTorre = {
      ...BASE,
      valorEstimado: 90_000,
      hitos: { ...HITOS, A7: { data: { monto: 90_000 }, status: "hecho" } },
      fechaRequerida: "2026-12-31",
    };
    const t = tarjetasDeControl(sano);
    expect(t.every((x) => x.nivel === "ok")).toBe(true);
    expect(cuantasBloquean(t)).toBe(0);
  });
});
