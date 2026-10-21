import { describe, expect, it } from "vitest";
import {
  analizarRequisitos,
  facultativosExcluidos,
  requisitosDeProcedimiento,
  textoRequisitoObligatorio,
} from "@/lib/requisitos-por-procedimiento";
import { PROCESOS_SELECCION, PROCESO_NO_COMPETITIVO } from "@/lib/procesos-seleccion";
import { parseRequisitos, repartirRequisitos } from "@/lib/requisitos-calificacion";

const porTipoDe = (raw: string) => repartirRequisitos(parseRequisitos(raw)).porTipo;
const LICITACION = requisitosDeProcedimiento("Licitación Pública para bienes", "", false);

describe("matriz de requisitos por procedimiento (Art. 72.4 / bases estándar)", () => {
  it("licitación: capacidad legal y experiencia del postor obligatorias; capacidad técnica facultativa", () => {
    const m = requisitosDeProcedimiento("Licitación Pública para bienes", "", false);
    expect(m.capacidad_legal).toBe("obligatorio");
    expect(m.experiencia_postor).toBe("obligatorio");
    expect(m.capacidad_tecnica).toBe("facultativo");
  });

  it("concurso: capacidad técnica y experiencia del postor obligatorias; capacidad legal facultativa", () => {
    const m = requisitosDeProcedimiento("Concurso Público de servicios", "", false);
    expect(m.capacidad_tecnica).toBe("obligatorio");
    expect(m.experiencia_postor).toBe("obligatorio");
    expect(m.capacidad_legal).toBe("facultativo");
  });

  it("comparación de precios: capacidad legal y experiencia obligatorias (corregido)", () => {
    const m = requisitosDeProcedimiento("Comparación de Precios", "", false);
    expect(m.capacidad_legal).toBe("obligatorio");
    expect(m.experiencia_postor).toBe("obligatorio");
  });

  it("subasta inversa electrónica: solo capacidad legal obligatoria", () => {
    const m = requisitosDeProcedimiento("Subasta Inversa Electrónica", "", false);
    expect(m.capacidad_legal).toBe("obligatorio");
    expect(m.experiencia_postor).toBe("facultativo");
    expect(m.capacidad_tecnica).toBe("facultativo");
  });

  it("no competitivo (causal): ningún obligatorio, la DEC decide", () => {
    const m = requisitosDeProcedimiento("Procedimiento de Selección No Competitivo", "b) Situación de emergencia", false);
    expect(Object.values(m).some((e) => e === "obligatorio")).toBe(false);
    expect(m.experiencia_postor).toBe("facultativo");
    expect(m.capacidad_legal).toBe("facultativo");
  });

  it("expertos y gerentes (concurso abreviado) sigue la regla de concurso", () => {
    const m = requisitosDeProcedimiento(
      "Concurso Público abreviado para la contratación de expertos y gerentes de proyectos",
      "",
      false,
    );
    expect(m.capacidad_tecnica).toBe("obligatorio");
    expect(m.experiencia_postor).toBe("obligatorio");
  });

  it("capacidad económica: 'no' sin precalificación, 'facultativo' con precalificación", () => {
    expect(requisitosDeProcedimiento("Licitación Pública para bienes", "", false).capacidad_economica).toBe("no");
    expect(requisitosDeProcedimiento("Licitación Pública para bienes", "", true).capacidad_economica).toBe(
      "facultativo",
    );
  });

  // El catálogo entero: la experiencia del postor es obligatoria en todos los
  // competitivos SALVO subasta inversa, precomercial y asociación para la
  // innovación (que la spec no fija como obligatoria) y el no competitivo.
  it("recorre el catálogo: experiencia obligatoria salvo SIE, innovación y no competitivo", () => {
    const sinExperiencia = /subasta inversa|precomercial|asociaci[óo]n para la innovaci/i;
    for (const p of PROCESOS_SELECCION) {
      if (!p.value || p.value === PROCESO_NO_COMPETITIVO) continue;
      const m = requisitosDeProcedimiento(p.value, "", false);
      const esperado = sinExperiencia.test(p.value) ? "facultativo" : "obligatorio";
      expect(m.experiencia_postor, p.value).toBe(esperado);
    }
  });
});

describe("textoRequisitoObligatorio", () => {
  it("sin detalle: nombre del tipo + nota de obligatoriedad", () => {
    const t = textoRequisitoObligatorio("experiencia_postor");
    expect(t).toContain("Experiencia del postor en la especialidad");
    expect(t).toContain("Obligatorio por bases estándar (R.D. N° 0001-2026-EF/54.01)");
  });

  it("con detalle: incluye lo que registró la DEC, para coincidir con el frontend", () => {
    const t = textoRequisitoObligatorio("experiencia_postor", "Monto facturado S/ 180,000 en similares");
    expect(t).toContain("Monto facturado S/ 180,000");
    expect(t).toContain("Obligatorio por bases estándar");
  });

  it("la capacidad legal conserva su condición cuando no hay detalle", () => {
    expect(textoRequisitoObligatorio("capacidad_legal")).toContain("si la normativa del objeto exige habilitación");
  });
});

describe("analizarRequisitos", () => {
  it("cuenta los obligatorios de la matriz aunque el usuario no marque nada", () => {
    const a = analizarRequisitos(porTipoDe(""), LICITACION, false);
    // Licitación: capacidad legal + experiencia del postor obligatorios.
    expect(a.obligatorios).toBe(2);
    expect(a.facultativos).toBe(0);
    expect(a.faltaSustento).toEqual([]);
  });

  it("marca el facultativo activo sin sustento", () => {
    const conSustento = analizarRequisitos(
      porTipoDe("FACULTATIVOS:\n- Capacidad técnica y profesional — Sustento: personal clave especializado"),
      LICITACION,
      false,
    );
    expect(conSustento.facultativos).toBe(1);
    expect(conSustento.faltaSustento).toEqual([]);

    const sinSustento = analizarRequisitos(
      porTipoDe("FACULTATIVOS:\n- Capacidad técnica y profesional"),
      LICITACION,
      false,
    );
    expect(sinSustento.faltaSustento).toEqual(["capacidad_tecnica"]);
  });

  it("detecta la capacidad económica marcada sin precalificación", () => {
    const raw = "FACULTATIVOS:\n- Capacidad económica — Sustento: ratio de liquidez";
    expect(analizarRequisitos(porTipoDe(raw), LICITACION, false).economicaSinPrecalificacion).toBe(true);
    expect(analizarRequisitos(porTipoDe(raw), LICITACION, true).economicaSinPrecalificacion).toBe(false);
  });
});

describe("facultativosExcluidos · no objeción (Art. 44.8)", () => {
  it("un facultativo propuesto que la decisión pone en 'no' se marca", () => {
    const propuesta = porTipoDe("FACULTATIVOS:\n- Capacidad técnica y profesional — Sustento: personal clave");
    const decision = porTipoDe(""); // la DEC no lo incluye
    expect(facultativosExcluidos(propuesta, decision, LICITACION)).toEqual(["capacidad_tecnica"]);
  });

  it("no marca lo que la matriz vuelve obligatorio (no se puede excluir)", () => {
    // El área usuaria propuso experiencia como facultativo, pero en licitación es
    // obligatoria por la matriz: la DEC no la excluye.
    const propuesta = porTipoDe("FACULTATIVOS:\n- Experiencia del postor en la especialidad");
    expect(facultativosExcluidos(propuesta, porTipoDe(""), LICITACION)).toEqual([]);
  });

  it("sin propuesta no hay nada que contrastar", () => {
    expect(facultativosExcluidos(null, porTipoDe(""), LICITACION)).toEqual([]);
  });
});
