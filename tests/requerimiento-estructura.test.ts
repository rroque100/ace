import { describe, expect, it } from "vitest";
import { TEXTO_NO_CORRESPONDE } from "@/lib/adelanto-directo";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";
import { TEXTO_NO_CORRESPONDE as SUBCON_NO_CORRESPONDE } from "@/lib/subcontratacion";
import { apisExigidos, estructuraDelRequerimiento, etiquetaDeDocumento } from "@/lib/requerimiento-estructura";

/**
 * Qué lleva el Word del requerimiento.
 *
 * Se dejaba información: salía solo con los apartados que el modelo del
 * procedimiento declara —diecinueve campos— mientras la ficha tiene setenta y
 * cuatro. Medido sobre datos reales, en REQ-2026-0020 se habían registrado 29 y
 * salían 5: meta presupuestal, CUI, cadena funcional, monto, plazo, alcance y
 * garantías se quedaban fuera sin que nadie lo notara.
 *
 * Ahora manda la ficha, y el modelo decide qué es exigible aunque esté vacío.
 */
const FICHA = {
  alcance: "Suministro e instalación",
  cui: "2456789",
  finalidadPublica: "Garantizar la operatividad",
  metaPresupuestal: "0034",
  modalidadPago: "Suma alzada",
  montoEstimado: "125000",
};

describe("todo lo registrado va al documento", () => {
  it("un campo con dato sale aunque el modelo no lo pida", () => {
    // Es el fallo que se corrige: el modelo no declara «CUI» ni «meta
    // presupuestal», y eran datos que el area usuaria SI habia registrado.
    const apis = estructuraDelRequerimiento([], FICHA).flatMap((s) => s.campos.map((c) => c.api));
    expect(apis).toContain("cui");
    expect(apis).toContain("metaPresupuestal");
    expect(apis).toContain("montoEstimado");
    expect(apis).toContain("alcance");
  });

  it("un campo vacío que el modelo NO exige no ensucia el documento", () => {
    const apis = estructuraDelRequerimiento([], FICHA).flatMap((s) => s.campos.map((c) => c.api));
    expect(apis).not.toContain("formulaReajuste");
  });

  it("un campo vacío que el modelo SÍ exige sale, para que se vea lo que falta", () => {
    const secciones = estructuraDelRequerimiento(["Fórmula de reajuste"], FICHA);
    const campo = secciones.flatMap((s) => s.campos).find((c) => c.api === "formulaReajuste");
    expect(campo).toBeDefined();
    expect(campo!.valor).toBe("");
    expect(campo!.exigido).toBe(true);
  });
});

describe("el orden es el de la pantalla", () => {
  it("las secciones salen en el orden de la ficha", () => {
    const conTodo: Record<string, string> = {};
    for (const s of FICHA_SECCIONES) for (const f of s.fields) if (!f.oculto) conTodo[f.api] = "x";
    const titulos = estructuraDelRequerimiento([], conTodo).map((s) => s.titulo);
    const esperados = FICHA_SECCIONES
      .filter((s) => !["Verificaciones DEC (Art. 14 Reglamento)", "Resumen"].includes(s.title))
      .map((s) => s.title.toUpperCase());
    expect(titulos).toEqual(esperados);
  });

  it("dentro de una sección, los campos van en el orden de la ficha", () => {
    const conTodo: Record<string, string> = {};
    for (const s of FICHA_SECCIONES) for (const f of s.fields) if (!f.oculto) conTodo[f.api] = "x";
    const [primera] = estructuraDelRequerimiento([], conTodo);
    const seccionFicha = FICHA_SECCIONES.find((s) => s.title.toUpperCase() === primera.titulo)!;
    const esperados = seccionFicha.fields.filter((f) => !f.oculto).map((f) => f.api);
    expect(primera.campos.map((c) => c.api)).toEqual(esperados.filter((a) => a !== "plazoEjecucionUnidad"));
  });

  it("el control interno de la DEC y el resumen no van al documento", () => {
    const conTodo: Record<string, string> = {};
    for (const s of FICHA_SECCIONES) for (const f of s.fields) if (!f.oculto) conTodo[f.api] = "x";
    const titulos = estructuraDelRequerimiento([], conTodo).map((s) => s.titulo);
    expect(titulos).not.toContain("VERIFICACIONES DEC (ART. 14 REGLAMENTO)");
    expect(titulos).not.toContain("RESUMEN");
  });
});

describe("lo que no aplica a esta contratación no entra", () => {
  it("un campo solo de obras no sale en un requerimiento de bienes", () => {
    // Aunque quede un valor de cuando el objeto era otro: el documento describe
    // ESTA contratacion.
    const soloObras = FICHA_SECCIONES.flatMap((s) => s.fields).find(
      (f) => f.mostrarPara?.length === 1 && f.mostrarPara[0] === "obras",
    );
    if (!soloObras) return; // si el catalogo cambia y no hay ninguno, no falla
    const apis = estructuraDelRequerimiento([], { [soloObras.api]: "algo" }, { objeto: "bienes" })
      .flatMap((s) => s.campos.map((c) => c.api));
    expect(apis).not.toContain(soloObras.api);
  });

  it("pero si el MODELO lo exige, sale igual", () => {
    // Discrepancia real, encontrada con datos: el PDF-modelo de Licitación
    // Pública abreviada PARA BIENES trae los apartados de sistema de entrega y
    // subcontratación, y el catálogo de la ficha los limita a servicios y obras.
    // Manda el modelo: es el formato que la entidad presenta.
    const apis = estructuraDelRequerimiento(["Sistema de entrega", "Subcontratación"], {}, {
      objeto: "bienes",
    }).flatMap((s) => s.campos.map((c) => c.api));
    expect(apis).toContain("sistemaEntrega");
    expect(apis).toContain("subcontratacion");
  });
});

describe("cada campo sabe cómo se pinta", () => {
  it("los requisitos van en viñetas y las otras penalidades en tabla", () => {
    const secciones = estructuraDelRequerimiento([], {
      otrasPenalidades: "1. Supuesto: X · Cálculo: Y · Verificación: Z",
      requisitosCalificacion: "OBLIGATORIOS:\n- Capacidad legal",
    });
    const campos = secciones.flatMap((s) => s.campos);
    expect(campos.find((c) => c.api === "requisitosCalificacion")?.formato).toBe("vinetas");
    expect(campos.find((c) => c.api === "otrasPenalidades")?.formato).toBe("tabla");
  });

  it("la unidad del plazo no va suelta: viaja dentro del plazo", () => {
    const apis = estructuraDelRequerimiento([], { plazoEjecucion: "52", plazoEjecucionUnidad: "calendario" })
      .flatMap((s) => s.campos.map((c) => c.api));
    expect(apis).toContain("plazoEjecucion");
    expect(apis).not.toContain("plazoEjecucionUnidad");
  });

  it("una casilla sin marcar no es un dato", () => {
    const apis = estructuraDelRequerimiento([], { cmnVerificado: "false" }).flatMap((s) =>
      s.campos.map((c) => c.api),
    );
    expect(apis).not.toContain("cmnVerificado");
  });
});

describe("adelanto directo · «No corresponde» elimina el numeral (modelo OECE)", () => {
  it("cuando se otorga, el apartado va al documento", () => {
    const apis = estructuraDelRequerimiento([], {
      adelantoDirecto: "La entidad otorgará 1 adelanto directo por el 30% del monto del contrato original.",
    }).flatMap((s) => s.campos.map((c) => c.api));
    expect(apis).toContain("adelantoDirecto");
  });

  it("cuando es «No corresponde», el apartado se omite", () => {
    const apis = estructuraDelRequerimiento([], { adelantoDirecto: TEXTO_NO_CORRESPONDE })
      .flatMap((s) => s.campos.map((c) => c.api));
    expect(apis).not.toContain("adelantoDirecto");
  });

  it("se omite aunque el modelo declare el apartado exigible", () => {
    // El propio modelo indica «eliminar el numeral» cuando no hay adelanto, así
    // que su exigibilidad no debe forzar un apartado con «No corresponde».
    const apis = estructuraDelRequerimiento(["Adelanto directo"], { adelantoDirecto: TEXTO_NO_CORRESPONDE })
      .flatMap((s) => s.campos.map((c) => c.api));
    expect(apis).not.toContain("adelantoDirecto");
  });

  it("la subcontratación «No corresponde» también omite su numeral", () => {
    const conValor = estructuraDelRequerimiento([], {
      subcontratacion: "Se encuentra prohibida la subcontratación de las prestaciones objeto del contrato.",
    }).flatMap((s) => s.campos.map((c) => c.api));
    expect(conValor).toContain("subcontratacion");

    const noCorresponde = estructuraDelRequerimiento([], { subcontratacion: SUBCON_NO_CORRESPONDE })
      .flatMap((s) => s.campos.map((c) => c.api));
    expect(noCorresponde).not.toContain("subcontratacion");
  });

  it("la fórmula de reajuste «No corresponde» también omite su numeral", () => {
    const conValor = estructuraDelRequerimiento([], { formulaReajuste: "K = 0.3·IPC + 0.7" })
      .flatMap((s) => s.campos.map((c) => c.api));
    expect(conValor).toContain("formulaReajuste");

    const noCorresponde = estructuraDelRequerimiento([], { formulaReajuste: TEXTO_NO_CORRESPONDE })
      .flatMap((s) => s.campos.map((c) => c.api));
    expect(noCorresponde).not.toContain("formulaReajuste");
  });
});

describe("la etiqueta del documento no es la de la pantalla", () => {
  it("quita la coletilla de propuesta y la ayuda de tecleo", () => {
    expect(etiquetaDeDocumento("Propuesta de modalidad de pago")).toBe("Modalidad de pago");
    expect(etiquetaDeDocumento("Plazo de ejecución o prestación (días)")).toBe("Plazo de ejecución o prestación");
  });
});

describe("qué exige el modelo", () => {
  it("traduce sus apartados a campos de la ficha", () => {
    const apis = apisExigidos(["Penalidades"]);
    expect(apis.has("penalidadMora")).toBe(true);
    expect(apis.has("otrasPenalidades")).toBe(true);
  });

  it("un apartado que no está en la tabla se ignora sin romper", () => {
    expect(apisExigidos(["Apartado inventado"]).size).toBe(0);
  });
});
