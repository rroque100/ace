import { describe, expect, it } from "vitest";
import {
  CATEGORIA_SEGMENTACION_META,
  interaccionAlcanzaNivel,
  nivelAlcanzadoA5,
  PASOS_F1,
  clasificarSegmentacion,
} from "@/lib/actuaciones-preparatorias";
import { ACCIONES_F1, accionesDeF1, hitosDeFase, type HitosMap } from "@/lib/procurement-fases";

describe("actuaciones-preparatorias · catálogo FASE 1", () => {
  it("la FASE 1 tiene 10 pasos (A1..A10) y cada uno tiene detalle", () => {
    const pasos = hitosDeFase("F1");
    expect(pasos).toHaveLength(10);
    expect(pasos.map((p) => p.code)).toEqual([
      "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10",
    ]);
    for (const paso of pasos) {
      const detalle = PASOS_F1[paso.code];
      expect(detalle, `falta detalle de ${paso.code}`).toBeDefined();
      expect(detalle.objetivo.length).toBeGreaterThan(10);
      expect(detalle.baseLegal.length).toBeGreaterThan(3);
    }
  });

  it("el orden de los pasos es estrictamente creciente", () => {
    const ordenes = hitosDeFase("F1").map((p) => p.order);
    expect(ordenes).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe("actuaciones-preparatorias · agrupación en 7 acciones", () => {
  it("expone 7 grupos: precondición + acciones I..VII", () => {
    expect(ACCIONES_F1).toHaveLength(7);
    expect(ACCIONES_F1.map((a) => a.numeral)).toEqual(["0", "I", "II", "III–IV", "V", "VI", "VII"]);
    expect(ACCIONES_F1[0].precondicion).toBe(true);
    expect(ACCIONES_F1.at(-1)?.opcional).toBe(true);
  });

  it("cada sub-paso A1..A10 pertenece exactamente a una acción", () => {
    const pasos = hitosDeFase("F1");
    const grupos = accionesDeF1({});
    const asignados = grupos.flatMap((g) => g.hitos.map((h) => h.code));
    expect(asignados.sort()).toEqual([...pasos.map((p) => p.code)].sort());
    // Ningún sub-paso queda huérfano ni duplicado.
    expect(new Set(asignados).size).toBe(pasos.length);
  });

  it("agrupa el par iterativo Estrategia+Interacción (A4, A5) bajo III–IV", () => {
    const grupo = accionesDeF1({}).find((g) => g.id === "III-IV");
    expect(grupo?.hitos.map((h) => h.code)).toEqual(["A4", "A5"]);
  });

  it("agrupa CCP+Evaluadores+Aprobación (A6, A7, A8) bajo V", () => {
    const grupo = accionesDeF1({}).find((g) => g.id === "V");
    expect(grupo?.hitos.map((h) => h.code)).toEqual(["A6", "A7", "A8"]);
  });

  it("calcula el sub-progreso por grupo", () => {
    const hitos: HitosMap = {
      A6: { status: "hecho" },
      A7: { status: "na" },
      A8: { status: "pendiente" },
    };
    const grupoV = accionesDeF1(hitos).find((g) => g.id === "V");
    expect(grupoV?.total).toBe(3);
    // "hecho" y "na" cuentan como completados.
    expect(grupoV?.completados).toBe(2);
    expect(grupoV?.porcentaje).toBe(67);
  });
});

describe("actuaciones-preparatorias · ATENCIÓN de A6 y A8 son el MISMO campo", () => {
  // El AGA/gerente son ROLES de la entidad, no oficinas. Ambos pasos deben ofrecer
  // el mismo desplegable (aga/gerente), obligatorio, para no diverger: A8 lo tenía
  // como texto libre y quedaba tecleado a mano, desalineado con A6.
  const atencion = (code: "A6" | "A8") => PASOS_F1[code].campos.find((c) => c.name === "atencion");

  it("A6 y A8 exponen ATENCIÓN como select obligatorio con las opciones aga/gerente", () => {
    for (const code of ["A6", "A8"] as const) {
      const campo = atencion(code);
      expect(campo, `falta ATENCIÓN en ${code}`).toBeDefined();
      expect(campo?.tipo, `${code}·ATENCIÓN debe ser select`).toBe("select");
      expect(campo?.required, `${code}·ATENCIÓN debe ser obligatorio`).toBe(true);
      expect(campo?.opciones?.map((o) => o.value)).toEqual(["aga", "gerente"]);
    }
  });
});

describe("actuaciones-preparatorias · segmentación bienes y servicios", () => {
  const bs = (cuantiaAlta: boolean, condicionesRiesgo: string[] = []) =>
    clasificarSegmentacion({ objeto: "bienes_servicios", cuantiaAlta, condicionesRiesgo });

  it("cuantía baja + riesgo bajo → Rutinaria (indagación básica)", () => {
    const r = bs(false, []);
    expect(r.categoria).toBe("rutinaria");
    expect(r.nivel).toBe("indagacion_basica");
    expect(r.riesgoAlto).toBe(false);
  });

  it("cuantía alta + riesgo bajo → Operacional (indagación avanzada)", () => {
    const r = bs(true, []);
    expect(r.categoria).toBe("operacional");
    expect(r.nivel).toBe("indagacion_avanzada");
  });

  it("cuantía baja + riesgo alto → Crítico (consulta al mercado básica)", () => {
    const r = bs(false, ["desierto_2anios"]);
    expect(r.categoria).toBe("critico");
    expect(r.nivel).toBe("consulta_mercado_basica");
    expect(r.riesgoAlto).toBe(true);
  });

  it("cuantía alta + riesgo alto → Estratégico (consulta al mercado avanzada)", () => {
    const r = bs(true, ["postores_bajos", "disponibilidad_limitada"]);
    expect(r.categoria).toBe("estrategico");
    expect(r.nivel).toBe("consulta_mercado_avanzada");
  });
});

describe("actuaciones-preparatorias · segmentación obras y consultoría de obras", () => {
  const todos = ["baja_innovacion_complejidad", "experiencia_previa", "postores_suficientes", "no_saldo_obra"];

  it("cumple TODOS los criterios concurrentes → Contratación básica", () => {
    const r = clasificarSegmentacion({ objeto: "obras_consultoria_obras", criteriosBasica: todos });
    expect(r.categoria).toBe("contratacion_basica");
    expect(r.nivel).toBe("consulta_mercado_basica");
  });

  it("falta un criterio → Contratación avanzada", () => {
    const r = clasificarSegmentacion({
      objeto: "obras_consultoria_obras",
      criteriosBasica: todos.slice(0, 3),
    });
    expect(r.categoria).toBe("contratacion_avanzada");
    expect(r.nivel).toBe("consulta_mercado_avanzada");
  });

  it("sin criterios → Contratación avanzada", () => {
    const r = clasificarSegmentacion({ objeto: "obras_consultoria_obras", criteriosBasica: [] });
    expect(r.categoria).toBe("contratacion_avanzada");
  });
});

describe("actuaciones-preparatorias · metadatos de categoría", () => {
  it("cada categoría mapea a un nivel de interacción coherente con su objeto", () => {
    for (const [, meta] of Object.entries(CATEGORIA_SEGMENTACION_META)) {
      expect(meta.nivel).toBeTruthy();
      expect(meta.label.length).toBeGreaterThan(3);
    }
  });
});

describe("actuaciones-preparatorias · nivel de interacción ejecutado (A5)", () => {
  // El nivel sale del CONTEO de casillas, no del radio elegido: el 48.3 cuenta
  // fuentes (básica ≥1, avanzada ≥2) y el 49.2 herramientas (ídem).
  it("la indagación cuenta fuentes: 0 → nada, 1 → básica, 2 → avanzada", () => {
    expect(nivelAlcanzadoA5({ nivel: "indagacion_avanzada" })).toBeNull();
    expect(nivelAlcanzadoA5({ nivel: "indagacion_basica", fuente_historica: true })).toBe(
      "indagacion_basica",
    );
    expect(
      nivelAlcanzadoA5({ nivel: "indagacion_avanzada", fuente_historica: true, fuente_pladicop: true }),
    ).toBe("indagacion_avanzada");
  });

  it("la consulta cuenta herramientas: 1 → básica, 2 → avanzada", () => {
    expect(nivelAlcanzadoA5({ nivel: "consulta_mercado_avanzada", herr_difusion: true })).toBe(
      "consulta_mercado_basica",
    );
    expect(
      nivelAlcanzadoA5({ nivel: "consulta_mercado_avanzada", herr_difusion: true, herr_talleres: true }),
    ).toBe("consulta_mercado_avanzada");
  });

  it("el radio manda sobre las casillas del OTRO tipo: elegir indagación no cuenta herramientas", () => {
    // Marcó herramientas pero declaró indagación: no hay fuentes → nada.
    expect(nivelAlcanzadoA5({ nivel: "indagacion_basica", herr_difusion: true })).toBeNull();
  });

  it("sin declarar el tipo (radio vacío) no hay nivel", () => {
    expect(nivelAlcanzadoA5({ fuente_historica: true })).toBeNull();
    expect(nivelAlcanzadoA5({})).toBeNull();
  });

  it("alcanza por jerarquía: una consulta satisface un requisito de indagación, no al revés", () => {
    const consultaAvanzada = { nivel: "consulta_mercado_avanzada", herr_difusion: true, herr_talleres: true };
    // Supera cualquier requisito de indagación.
    expect(interaccionAlcanzaNivel(consultaAvanzada, "indagacion_basica")).toBe(true);
    expect(interaccionAlcanzaNivel(consultaAvanzada, "indagacion_avanzada")).toBe(true);
    // Una indagación avanzada NO cubre un requisito de consulta.
    const indagAvanzada = { nivel: "indagacion_avanzada", fuente_historica: true, fuente_pladicop: true };
    expect(interaccionAlcanzaNivel(indagAvanzada, "consulta_mercado_basica")).toBe(false);
    // El hueco: consulta declarada avanzada pero con una sola herramienta.
    const consultaCoja = { nivel: "consulta_mercado_avanzada", herr_difusion: true };
    expect(interaccionAlcanzaNivel(consultaCoja, "consulta_mercado_avanzada")).toBe(false);
    expect(interaccionAlcanzaNivel(consultaCoja, "consulta_mercado_basica")).toBe(true);
  });
});

describe("actuaciones-preparatorias · A9 enlace a las bases estándar vigentes", () => {
  it("el campo de versión de bases estándar lleva el enlace del MEF", () => {
    const campo = PASOS_F1.A9.campos.find((c) => c.name === "version_bases_estandar");
    expect(campo).toBeDefined();
    expect(campo?.enlace?.url).toBe(
      "https://www.gob.pe/institucion/mef/normas-legales/7614342-001-2026-ef-54-01",
    );
    expect(campo?.enlace?.texto).toContain("MEF");
  });

  it("ningún otro campo inventa un enlace que no existe", () => {
    // Si en el futuro un campo necesita enlace, que sea deliberado: aquí se
    // lista solo el del R.D. 001-2026-EF/54.01.
    const conEnlace = Object.values(PASOS_F1)
      .flatMap((p) => p.campos)
      .filter((c) => c.enlace);
    expect(conEnlace.map((c) => c.name)).toEqual(["version_bases_estandar"]);
  });
});
