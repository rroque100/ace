import { describe, expect, it } from "vitest";
import {
  CITAS_ART_48,
  CITAS_ART_49_50,
  citasDeNivel,
  citasSonDeOtroTipo,
} from "@/lib/anexo1-interaccion";
import { avisoFechaRequerida, fechaEntregaEstimada } from "@/lib/cronograma-fechas";
import {
  nomenclaturaDeA4,
  nomenclaturaDelFormato,
  type ActividadCronograma,
} from "@/lib/estrategia-formato";

/**
 * A5 precargaba siempre el Art. 48 (indagación) fuera cual fuera el nivel, así
 * que un Anexo N° 1 de consulta al mercado salía sustentado con el artículo de
 * otra cosa — y con el criterio equivocado: el 48.3 cuenta FUENTES de
 * información y el 49.2 cuenta HERRAMIENTAS.
 */
describe("el sustento legal de A5 sigue al nivel elegido", () => {
  it("la indagación se sustenta en el Art. 48", () => {
    expect(citasDeNivel("indagacion_basica")).toBe(CITAS_ART_48);
    expect(citasDeNivel("indagacion_avanzada")).toBe(CITAS_ART_48);
  });

  it("la consulta al mercado se sustenta en los Arts. 49-50", () => {
    expect(citasDeNivel("consulta_mercado_basica")).toBe(CITAS_ART_49_50);
    expect(citasDeNivel("consulta_mercado_avanzada")).toBe(CITAS_ART_49_50);
  });

  it("cada texto cita su propio criterio de básica/avanzada", () => {
    expect(CITAS_ART_48).toContain("fuente de información");
    expect(CITAS_ART_49_50).toContain("una sola herramienta de interacción");
    expect(CITAS_ART_49_50).not.toContain("48.");
  });

  it("sin nivel elegido no se cita nada", () => {
    expect(citasDeNivel("")).toBeNull();
    expect(citasDeNivel("otra_cosa")).toBeNull();
  });

  it("detecta el sustento que quedó del otro tipo (el caso real)", () => {
    expect(citasSonDeOtroTipo(CITAS_ART_48, "consulta_mercado_basica")).toBe(true);
    expect(citasSonDeOtroTipo(CITAS_ART_49_50, "indagacion_basica")).toBe(true);
  });

  it("no reprocha el sustento correcto ni el redactado a mano", () => {
    expect(citasSonDeOtroTipo(CITAS_ART_49_50, "consulta_mercado_basica")).toBe(false);
    expect(citasSonDeOtroTipo("Lo redacté yo con mis palabras.", "consulta_mercado_basica")).toBe(false);
    expect(citasSonDeOtroTipo("", "consulta_mercado_basica")).toBe(false);
  });
});

/**
 * a) fue un único campo antes de separarse en tipo + nomenclatura. Al
 * renombrarlo, lo que la gente había escrito —nomenclaturas— se quedó huérfano
 * en el jsonb: invisible para el formulario y para el exportador.
 */
describe("nomenclaturaDeA4 · rescate de la clave heredada", () => {
  it("usa el campo nuevo cuando existe", () => {
    expect(nomenclaturaDeA4({ var_a_nomenclatura: "N° 42-2026" })).toBe("N° 42-2026");
  });

  it("recupera el valor que quedó en la clave antigua (el caso real)", () => {
    expect(nomenclaturaDeA4({ var_a_tipo_procedimiento: "04-2026-DEC-MDCH-1" })).toBe("04-2026-DEC-MDCH-1");
  });

  it("el campo nuevo manda sobre el heredado", () => {
    expect(
      nomenclaturaDeA4({ var_a_nomenclatura: "N° 42-2026", var_a_tipo_procedimiento: "viejo" }),
    ).toBe("N° 42-2026");
  });

  it("sin ninguno de los dos devuelve null", () => {
    expect(nomenclaturaDeA4({})).toBeNull();
    expect(nomenclaturaDeA4({ var_a_nomenclatura: "   " })).toBeNull();
    expect(nomenclaturaDeA4(null)).toBeNull();
  });
});

describe("nomenclaturaDelFormato · el respaldo del expediente", () => {
  it("la de A4 manda sobre la del expediente", () => {
    expect(nomenclaturaDelFormato({ var_a_nomenclatura: "N° 7-2026" }, "CP N° 001-2026", null)).toBe(
      "N° 7-2026",
    );
  });

  it("sin A4 usa la del expediente cuando es una nomenclatura de verdad", () => {
    expect(nomenclaturaDelFormato({}, "N° 42-2026-DEC-MDCH", null)).toBe("N° 42-2026-DEC-MDCH");
  });

  it("NO imprime el título de la necesidad como si fuera el número (el caso real)", () => {
    const titulo = "ADQUISICION DE SERVIDOR PARA EL SISTEMA DE GESTION ADMINISTRATIVA (SIGA-MEF)";
    expect(nomenclaturaDelFormato({}, `REQ-2026-0004 — ${titulo}`, titulo)).toBeNull();
  });

  it("sin nada que imprimir, null", () => {
    expect(nomenclaturaDelFormato({}, "", null)).toBeNull();
    expect(nomenclaturaDelFormato(null, null, null)).toBeNull();
  });
});

describe("¿llega el cronograma a la fecha que pidió el área usuaria?", () => {
  // El cronograma real de REQ-2026-0004, recortado a lo que importa.
  const filas: ActividadCronograma[] = [
    { fase: "seleccion", actividad: "Convocatoria", inicio: "2026-07-30", fin: "2026-07-30" },
    { fase: "ejecucion", actividad: "Suscripción del contrato", inicio: "2026-09-11", fin: "2026-09-15" },
    { fase: "ejecucion", actividad: "Ejecución contractual", inicio: "SEGÚN BASES", fin: "SEGÚN BASES" },
  ];

  it("la entrega es la última fecha cierta más el plazo de ejecución", () => {
    // 2026-09-15 + 6 días calendario (Art. 126.2).
    expect(fechaEntregaEstimada(filas, 6)).toBe("2026-09-21");
  });

  it("SEGÚN BASES no cuenta como fecha", () => {
    expect(fechaEntregaEstimada(filas, 0)).toBe("2026-09-15");
  });

  it("avisa de los días de retraso sobre la fecha requerida (el caso real)", () => {
    const aviso = avisoFechaRequerida(filas, "2026-04-22", 6)!;
    expect(aviso.entrega).toBe("2026-09-21");
    expect(aviso.diasTarde).toBe(152);
  });

  it("no avisa si el cronograma llega a tiempo", () => {
    expect(avisoFechaRequerida(filas, "2026-12-31", 6)).toBeNull();
    // Justo el mismo día también llega.
    expect(avisoFechaRequerida(filas, "2026-09-21", 6)).toBeNull();
  });

  it("calla cuando falta el dato en vez de suponerlo", () => {
    expect(avisoFechaRequerida(filas, null, 6)).toBeNull();
    expect(avisoFechaRequerida([], "2026-04-22", 6)).toBeNull();
    expect(fechaEntregaEstimada([], 6)).toBeNull();
  });
});
