import { describe, expect, it } from "vitest";
import { PROCEDIMIENTOS_COMPETITIVOS } from "@/lib/estrategia-formato";
import {
  ACTIVIDADES_SELECCION_POR_PROCEDIMIENTO,
  actividadesSeleccionDe,
  cronogramaCoincideConProcedimiento,
  DIAS_HABILES_APELACION,
  MIN_HABILES_CONSULTAS,
  type ActividadCronograma,
} from "@/lib/estrategia-formato";

/**
 * a) determina o) (Art. 46.1.o). El acoplamiento es por CLAVE, así que si a)
 * gana un procedimiento y nadie lo añade a los mapas de o), el botón "Listar
 * actividades" cae en la lista genérica y los plazos en el valor por defecto,
 * en silencio. Estos tests lo convierten en un fallo de tests.
 */
describe("a) Tipo de procedimiento ↔ o) Cronograma", () => {
  const procedimientos = PROCEDIMIENTOS_COMPETITIVOS.map((p) => p.value);

  it("cada procedimiento de a) tiene sus actividades de selección en o)", () => {
    for (const p of procedimientos) {
      expect(ACTIVIDADES_SELECCION_POR_PROCEDIMIENTO[p], `falta el procedimiento ${p}`).toBeDefined();
    }
  });

  it("cada procedimiento de a) tiene sus plazos (Arts. 66.1 y 304)", () => {
    for (const p of procedimientos) {
      expect(MIN_HABILES_CONSULTAS[p], `falta el plazo de consultas de ${p}`).toBeDefined();
      expect(DIAS_HABILES_APELACION[p], `falta el plazo de apelación de ${p}`).toBeDefined();
    }
  });

  it("los mapas de o) no inventan procedimientos que a) no ofrece", () => {
    for (const p of Object.keys(ACTIVIDADES_SELECCION_POR_PROCEDIMIENTO)) {
      expect(procedimientos, `${p} no existe en a)`).toContain(p);
    }
  });

  it("la licitación pública abreviada lista sus actividades, no la genérica", () => {
    const abreviada = actividadesSeleccionDe("licitacion_publica_abreviada");
    expect(abreviada).toBe(ACTIVIDADES_SELECCION_POR_PROCEDIMIENTO.licitacion_publica_abreviada);
    // Etapas del Reglamento (Art. 93/94): registro de participantes + consultas y
    // observaciones y la absolución e integración por separado.
    expect(abreviada).toContain("Registro de participantes");
    expect(abreviada).toContain("Consultas y observaciones");
    expect(abreviada).toContain("Absolución e integración");
  });

  it("sin procedimiento elegido cae en la lista genérica editable", () => {
    expect(actividadesSeleccionDe(undefined).length).toBeGreaterThan(0);
    expect(actividadesSeleccionDe("no_existe").length).toBeGreaterThan(0);
  });
});

describe("cronogramaCoincideConProcedimiento", () => {
  const deProcedimiento = (p: string): ActividadCronograma[] =>
    actividadesSeleccionDe(p).map((actividad) => ({ actividad, fase: "seleccion" }));

  it("confirma cuando o) lista las actividades del procedimiento de a)", () => {
    expect(
      cronogramaCoincideConProcedimiento(deProcedimiento("subasta_inversa_electronica"), "subasta_inversa_electronica"),
    ).toBe(true);
  });

  it("detecta que se sembró con un procedimiento y luego se cambió a)", () => {
    const sembradoComoSubasta = deProcedimiento("subasta_inversa_electronica");
    expect(cronogramaCoincideConProcedimiento(sembradoComoSubasta, "comparacion_precios")).toBe(false);
  });

  it("las abreviadas comparten lista con su matriz: no es un desajuste", () => {
    const sembradoComoLicitacion = deProcedimiento("licitacion_publica");
    expect(
      cronogramaCoincideConProcedimiento(sembradoComoLicitacion, "licitacion_publica_abreviada"),
    ).toBe(true);
  });

  it("no reprocha nada cuando las actividades se editaron a mano", () => {
    const aMano: ActividadCronograma[] = [
      { fase: "seleccion", actividad: "Convocatoria" },
      { fase: "seleccion", actividad: "Mi actividad propia" },
    ];
    expect(cronogramaCoincideConProcedimiento(aMano, "licitacion_publica")).toBeNull();
  });

  it("calla si no hay procedimiento o no hay filas de selección", () => {
    expect(cronogramaCoincideConProcedimiento(deProcedimiento("licitacion_publica"), undefined)).toBeNull();
    expect(cronogramaCoincideConProcedimiento([], "licitacion_publica")).toBeNull();
    expect(
      cronogramaCoincideConProcedimiento(
        [{ fase: "preparatorias", actividad: "Aprobación del expediente" }],
        "licitacion_publica",
      ),
    ).toBeNull();
  });
});
