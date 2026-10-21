import { describe, expect, it } from "vitest";
import { pasoF1, type CampoFormulario } from "@/lib/actuaciones-preparatorias";

// A3 · Requerimiento, contrastado contra el texto indexado del Reglamento
// (D.S. 009-2025-EF):
//
//   44.2  el requerimiento contiene las condiciones de contratación, "como
//         mínimo lo siguiente, de corresponder": SOLO CINCO literales —
//         a) alcance y condiciones de ejecución · b) propuesta de requisitos de
//         calificación · c) propuesta de modalidad de pago y sistema de entrega ·
//         d) equipamiento, permisos y otros recursos · e) fórmula de reajuste.
//   44.3  "se inicia la identificación y evaluación de riesgos […] así como su
//         ASIGNACIÓN A ALGUNA DE LAS PARTES, lo cual sirve de insumo para la
//         elaboración de la estrategia".
//   44.4  en bienes y obras se evalúa la necesidad de prestaciones accesorias
//         "considerando el ciclo de vida del activo".
//   44.5  incluye las normas de cumplimiento obligatorio; las voluntarias solo
//         con sustento en la estrategia.

const campo = (name: string): CampoFormulario => {
  const c = pasoF1("A3")?.campos.find((x) => x.name === name);
  if (!c) throw new Error(`Campo inexistente en A3: ${name}`);
  return c;
};
const existe = (name: string) => pasoF1("A3")?.campos.some((x) => x.name === name) ?? false;

describe("A3 · los cinco literales del Art. 44.2", () => {
  it("cada literal tiene su campo, con la cita exacta", () => {
    expect(campo("descripcion").baseLegal).toContain("44.2.a");
    expect(campo("propuesta_requisitos_calificacion").baseLegal).toContain("44.2.b");
    expect(campo("propuesta_modalidad_pago").baseLegal).toContain("44.2.c");
    expect(campo("propuesta_sistema_entrega").baseLegal).toContain("44.2.c");
    expect(campo("recursos_contratista").baseLegal).toContain("44.2.d");
    expect(campo("formula_reajuste").baseLegal).toContain("44.2.e");
  });

  it("lo que NO está en el 44.2 no se le atribuye", () => {
    // Se citaban como "Art. 44.2" y el artículo no los enumera. Una cita falsa
    // se muestra bajo el campo y acaba copiada en un documento firmado.
    for (const name of ["lugar_entrega", "subcontratacion"]) {
      const base = campo(name).baseLegal ?? "";
      expect(base, name).toContain("Bases estándar");
      expect(base, name).toContain("no figura entre los literales");
    }
    expect(campo("recepcion_conformidad").baseLegal).toContain("144");
  });

  it("la penalidad por mora cita el artículo que sí la regula (120, no el 161 de obras)", () => {
    // El Art. 161 es "modalidades de pago en ejecución para obras"; la penalidad
    // por mora es el Art. 120. Debe coincidir con la ficha, que ya cita el 120.
    const base = campo("penalidad_mora").baseLegal ?? "";
    expect(base).toContain("120");
    expect(base).not.toContain("161");
  });
});

describe("A3 · contenido que el Art. 44 exige y faltaba", () => {
  it("44.3 · riesgos CON su asignación a las partes", () => {
    // La matriz de la ficha identifica y valora; lo que faltaba es el reparto,
    // que es justo el insumo que la estrategia necesita.
    expect(existe("riesgos_asignacion")).toBe(true);
    expect(campo("riesgos_asignacion").baseLegal).toContain("44.3");
  });

  it("44.4 · prestaciones accesorias y ciclo de vida", () => {
    expect(existe("prestaciones_accesorias")).toBe(true);
    expect(campo("prestaciones_accesorias").baseLegal).toContain("ciclo de vida");
  });

  it("44.5 · normas técnicas, distinguiendo obligatorias de voluntarias", () => {
    expect(existe("normas_tecnicas")).toBe(true);
    const base = campo("normas_tecnicas").baseLegal ?? "";
    expect(base).toContain("44.5");
    expect(base).toContain("OBLIGATORIO");
  });

  it("los tres se recomiendan, no bloquean: el 44.2 dice «de corresponder»", () => {
    for (const name of ["riesgos_asignacion", "prestaciones_accesorias", "normas_tecnicas"]) {
      expect(campo(name).required, name).toBeFalsy();
      expect(campo(name).recomendado, name).toBe(true);
    }
  });
});

describe("A3 · solo bloquea lo que la norma exige", () => {
  it("finalidad, objeto y descripción siguen siendo obligatorios", () => {
    // 44.1 finalidad pública · 44.10 objeto · 44.2.a alcance y condiciones.
    expect(campo("finalidad_publica").required).toBe(true);
    expect(campo("objeto_contractual").required).toBe(true);
    expect(campo("descripcion").required).toBe(true);
  });

  it("lo que no sale del Art. 44 ya no bloquea el paso", () => {
    // Ninguno de los tres se lee aguas abajo ni lo exige el articulado.
    for (const name of ["estructura_bases", "verificado_formal", "fecha_recepcion_dec"]) {
      expect(campo(name).required, name).toBeFalsy();
      expect(campo(name).recomendado, name).toBe(true);
    }
  });

  it("el CMN no se pregunta dos veces: se retiró de A3", () => {
    // Duplicaba `en_cmn` de A1, que es el paso del Art. 42 y el que comprueba
    // el Art. 54.3 para aprobar el expediente.
    expect(existe("verificado_cmn")).toBe(false);
    expect(pasoF1("A1")?.campos.some((c) => c.name === "en_cmn")).toBe(true);
  });

  it("el estandarizado sigue bloqueando: sin él no se aprueba el expediente", () => {
    // Art. 54.2.a: el expediente contiene el requerimiento "indicando si se
    // encuentra estandarizado".
    expect(campo("estandarizado").required).toBe(true);
    expect(campo("estandarizado").baseLegal).toContain("54.2.a");
  });
});
