import { describe, expect, it } from "vitest";
import { cuantiaDeA5 } from "@/lib/anexo1-interaccion";
import { calcularParametrosSegmentacion } from "@/lib/segmentacion-parametros";
import {
  clasificarSegmentacion,
  esProgramada,
  programadaPresumida,
  valorEstimadoDeA1,
} from "@/lib/actuaciones-preparatorias";

/**
 * El Art. 47.1 pone "actualizar la cuantía de la contratación considerada en el
 * PAC del CMN" entre los fines de la interacción con el mercado: la cuantía que
 * sale de A5 ES el valor estimado del expediente. Durante un tiempo se calculó
 * solo para imprimirla en el Anexo N° 1 y se tiraba, así que `valor_estimado`
 * quedaba en null y con él se caía la línea de corte de A2, la cuantía del
 * Formato 1 y el control de la certificación de A7.
 */
describe("cuantiaDeA5 · la cuantía que fija el valor estimado", () => {
  it("sale de las propuestas de la tabla con el criterio elegido", () => {
    const a5 = {
      criterio_cuantia: "menor",
      proveedores: [{ monto: 285_924 }, { monto: 310_000 }],
    };
    expect(cuantiaDeA5(a5)).toBe(285_924);
    expect(cuantiaDeA5({ ...a5, criterio_cuantia: "promedio" })).toBe(297_962);
  });

  it("la cuantía actualizada a mano manda sobre la tabla", () => {
    const a5 = { cuantia_actualizada: 250_000, criterio_cuantia: "menor", proveedores: [{ monto: 285_924 }] };
    expect(cuantiaDeA5(a5)).toBe(250_000);
  });

  it("sin propuestas con monto no hay cuantía (no se inventa un 0)", () => {
    expect(cuantiaDeA5({ proveedores: [] })).toBeNull();
    expect(cuantiaDeA5({ proveedores: [{ razonSocial: "SIN MONTO" }] })).toBeNull();
    expect(cuantiaDeA5({})).toBeNull();
    expect(cuantiaDeA5(null)).toBeNull();
  });

  it("una cuantía actualizada inválida no pisa la de la tabla", () => {
    expect(cuantiaDeA5({ cuantia_actualizada: 0, criterio_cuantia: "menor", proveedores: [{ monto: 90_000 }] })).toBe(90_000);
    expect(cuantiaDeA5({ cuantia_actualizada: "", criterio_cuantia: "menor", proveedores: [{ monto: 90_000 }] })).toBe(90_000);
  });
});

/**
 * El caso real de REQ-2026-0004: el área usuaria estimó S/ 90,000 y el mercado
 * devolvió S/ 285,924. La cifra no es un detalle contable — decide la categoría
 * de la segmentación y, con ella, cuánta interacción con el mercado exige la
 * norma. Por eso el valor estimado no puede quedarse sin escribir.
 */
describe("la cuantía decide la categoría de A2 (Art. 125.2)", () => {
  const PAC_BIENES_SERVICIOS = 1_226_465.7;
  const RIESGO = ["disponibilidad_limitada", "no_contratado_antes"];

  const categoriaCon = (valorEstimado: number) => {
    const p = calcularParametrosSegmentacion({
      pacBienesServicios: PAC_BIENES_SERVICIOS,
      programada: false, // no está en el PAC: su monto suma a la base
      valorEstimado,
    })!;
    return {
      ...clasificarSegmentacion({
        objeto: "bienes_servicios",
        cuantiaAlta: p.cuantiaAlta,
        condicionesRiesgo: RIESGO,
      }),
      lineaCorte: p.lineaCorte,
    };
  };

  it("con el monto del área usuaria: cuantía baja → Crítico → consulta básica", () => {
    const r = categoriaCon(90_000);
    expect(r.lineaCorte).toBe(131_646.57);
    expect(r.cuantiaAlta).toBe(false);
    expect(r.categoria).toBe("critico");
    expect(r.nivel).toBe("consulta_mercado_basica");
  });

  it("con el monto del mercado: cuantía alta → Estratégico → consulta avanzada", () => {
    const r = categoriaCon(285_924);
    expect(r.lineaCorte).toBe(151_238.97);
    expect(r.cuantiaAlta).toBe(true);
    expect(r.categoria).toBe("estrategico");
    expect(r.nivel).toBe("consulta_mercado_avanzada");
  });

  it("sin valor estimado no se puede calcular: la cuantía queda a criterio de nadie", () => {
    expect(
      calcularParametrosSegmentacion({
        pacBienesServicios: PAC_BIENES_SERVICIOS,
        programada: false,
        valorEstimado: null,
      }),
    ).toBeNull();
  });
});

describe("programadaPresumida · A2 distingue programada CONFIRMADA de PRESUNTA", () => {
  it("presume programada cuando A1 no respondió ni «programada» ni «en_pac»", () => {
    // Es el caso del expediente sin A1 terminado: esProgramada devuelve true, pero
    // por presunción (Art. 42.3), no porque A1 lo confirmara. A2 lo advierte en el copy.
    expect(programadaPresumida({})).toBe(true);
    expect(programadaPresumida(undefined)).toBe(true);
    expect(esProgramada({})).toBe(true); // la presunción es hacia "programada"
  });

  it("NO es presunción cuando A1 respondió (cualquiera de los dos campos)", () => {
    expect(programadaPresumida({ programada: true })).toBe(false);
    expect(programadaPresumida({ programada: false })).toBe(false);
    expect(programadaPresumida({ en_pac: true })).toBe(false);
    expect(programadaPresumida({ en_pac: false })).toBe(false);
  });
});

// El valor estimado que A1 declara en las no programadas manda sobre el del
// expediente: es el número que se ve en "+ Esta contratación" (A2) y el que se
// imprime en el informe. Este helper es el único punto que decide si A1 lo trae,
// para que pantalla y .docx coincidan.
describe("valorEstimadoDeA1 · A1 gobierna la fila «+ Esta contratación»", () => {
  it("devuelve la cifra declarada cuando es un monto válido", () => {
    expect(valorEstimadoDeA1({ valor_estimado: 94_183.37 })).toBe(94_183.37);
  });

  it("devuelve null cuando A1 no lo trae, para caer al respaldo del expediente", () => {
    expect(valorEstimadoDeA1({})).toBeNull();
    expect(valorEstimadoDeA1(undefined)).toBeNull();
    expect(valorEstimadoDeA1({ valor_estimado: 0 })).toBeNull();
    expect(valorEstimadoDeA1({ valor_estimado: -5 })).toBeNull();
    expect(valorEstimadoDeA1({ valor_estimado: Number.NaN })).toBeNull();
    expect(valorEstimadoDeA1({ valor_estimado: "94183" })).toBeNull();
  });

  it("alimenta la base de la segmentación: «+ Esta contratación» = lo declarado en A1", () => {
    // Cuando A1 declara el valor, ese es el sumando de la no programada.
    const v = valorEstimadoDeA1({ valor_estimado: 94_183.37 })!;
    const p = calcularParametrosSegmentacion({
      pacBienesServicios: 1_226_465.7,
      programada: false,
      valorEstimado: v,
    })!;
    expect(p.nuevaContratacion).toBe(94_183.37);
  });
});
