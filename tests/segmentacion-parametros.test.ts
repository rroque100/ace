import { describe, expect, it } from "vitest";
import {
  calcularParametrosSegmentacion,
  cuantiaSegmentacionSinDeterminar,
  soles,
} from "@/lib/segmentacion-parametros";

// Caso real tomado del informe "Segmentación de Bienes No Programados" de la
// Municipalidad Distrital de Paracas (adquisición de leche evaporada, 2026).
// Los montos y el resultado son los que figuran en ese documento.
const PARACAS = {
  pacBienesServicios: 1226465.7,
  valorEstimado: 61174,
  programada: false,
};

describe("calcularParametrosSegmentacion", () => {
  it("reproduce el informe de Paracas (no programada → baja cuantía)", () => {
    const r = calcularParametrosSegmentacion(PARACAS);
    expect(r).not.toBeNull();
    expect(r!.montoInicialPac).toBe(1226465.7);
    expect(r!.nuevaContratacion).toBe(61174);
    expect(r!.montoActualizado).toBe(1287639.7);
    expect(r!.lineaCorte).toBe(128763.97);
    expect(r!.porcentaje).toBe(4.75);
    expect(r!.cuantiaAlta).toBe(false);
  });

  it("programada: no vuelve a sumar el monto al PAC", () => {
    const r = calcularParametrosSegmentacion({ ...PARACAS, programada: true });
    expect(r!.nuevaContratacion).toBe(0);
    expect(r!.montoActualizado).toBe(1226465.7);
    expect(r!.lineaCorte).toBe(122646.57);
    expect(r!.cuantiaAlta).toBe(false);
  });

  it("contratacionEnOtras: su monto va en «otras», no se suma aparte (una sola vez)", () => {
    // La entidad registra la propia contratación DENTRO de "otras no programadas
    // a segmentar", así que NO debe sumarse otra vez como "Esta contratación".
    // Base = PAC + otras(61174), no PAC + otras + nuevaContratación.
    const r = calcularParametrosSegmentacion({
      ...PARACAS,
      otrasNoProgramadasASegmentar: 61174,
      contratacionEnOtras: true,
    });
    expect(r!.nuevaContratacion).toBe(0);
    expect(r!.otrasNoProgramadasASegmentar).toBe(61174);
    expect(r!.montoActualizado).toBe(1287639.7); // = PAC + 61174, contado una vez
    // El valor estimado sigue siendo el numerador de la cuantía.
    expect(r!.valorEstimado).toBe(61174);
    expect(r!.porcentaje).toBe(4.75);
    expect(r!.cuantiaAlta).toBe(false);
  });

  it("supera la línea de corte → alta cuantía", () => {
    const r = calcularParametrosSegmentacion({
      pacBienesServicios: 1226465.7,
      valorEstimado: 400000,
      programada: false,
    });
    // Línea: 10% de 1,626,465.70 = 162,646.57 < 400,000
    expect(r!.lineaCorte).toBe(162646.57);
    expect(r!.cuantiaAlta).toBe(true);
  });

  it("igualar la línea de corte NO la supera (baja cuantía)", () => {
    // PAC 900,000 programada → línea = 90,000. Valor exactamente 90,000.
    const r = calcularParametrosSegmentacion({
      pacBienesServicios: 900000,
      valorEstimado: 90000,
      programada: true,
    });
    expect(r!.lineaCorte).toBe(90000);
    expect(r!.cuantiaAlta).toBe(false);
  });

  // La Guía de Actuaciones Preparatorias exige sumar a la base, además del PAC
  // programado, las no programadas ya CONVOCADAS y las otras no programadas que
  // se segmentan en el mismo acto.
  it("suma las no programadas convocadas y las otras a segmentar (Guía)", () => {
    const r = calcularParametrosSegmentacion({
      pacBienesServicios: 1900000,
      noProgramadasConvocadas: 100000,
      otrasNoProgramadasASegmentar: 38000,
      valorEstimado: 60000,
      programada: false,
    });
    // 1,900,000 + 100,000 + 38,000 + 60,000 = 2,098,000  ⇒  10% = 209,800
    expect(r!.montoActualizado).toBe(2098000);
    expect(r!.lineaCorte).toBe(209800);
    expect(r!.cuantiaAlta).toBe(false);
  });

  it("omitir los sumandos de la Guía puede clasificar ALTA lo que es BAJA", () => {
    const comun = { pacBienesServicios: 500000, valorEstimado: 90000, programada: false };
    // Base incompleta: 500,000 + 90,000 = 590,000 ⇒ línea 59,000 < 90,000 ⇒ ALTA
    const incompleto = calcularParametrosSegmentacion(comun);
    expect(incompleto!.cuantiaAlta).toBe(true);
    // Base completa: + 400,000 convocadas ⇒ 990,000 ⇒ línea 99,000 > 90,000 ⇒ BAJA
    const completo = calcularParametrosSegmentacion({ ...comun, noProgramadasConvocadas: 400000 });
    expect(completo!.lineaCorte).toBe(99000);
    expect(completo!.cuantiaAlta).toBe(false);
  });

  it("los sumandos ausentes o inválidos cuentan como 0", () => {
    const r = calcularParametrosSegmentacion({
      ...PARACAS,
      noProgramadasConvocadas: null,
      otrasNoProgramadasASegmentar: -5,
    });
    expect(r!.noProgramadasConvocadas).toBe(0);
    expect(r!.otrasNoProgramadasASegmentar).toBe(0);
    // Sin sumandos extra el resultado es el del informe de Paracas.
    expect(r!.montoActualizado).toBe(1287639.7);
  });

  it("programada: los demás sumandos siguen contando", () => {
    const r = calcularParametrosSegmentacion({
      pacBienesServicios: 1000000,
      noProgramadasConvocadas: 200000,
      valorEstimado: 50000,
      programada: true,
    });
    // No se suma la evaluada (ya está en el PAC), sí las convocadas.
    expect(r!.nuevaContratacion).toBe(0);
    expect(r!.montoActualizado).toBe(1200000);
    expect(r!.lineaCorte).toBe(120000);
  });

  it("sin PAC registrado o sin valor estimado → null (se determina a mano)", () => {
    expect(calcularParametrosSegmentacion({ ...PARACAS, pacBienesServicios: null })).toBeNull();
    expect(calcularParametrosSegmentacion({ ...PARACAS, pacBienesServicios: 0 })).toBeNull();
    expect(calcularParametrosSegmentacion({ ...PARACAS, valorEstimado: null })).toBeNull();
    expect(calcularParametrosSegmentacion({ ...PARACAS, valorEstimado: undefined })).toBeNull();
  });

  it("soles() formatea con separador de miles y 2 decimales", () => {
    expect(soles(1287639.7)).toBe("S/ 1,287,639.70");
    expect(soles(61174)).toBe("S/ 61,174.00");
  });
});

// Gobierna a la vez el aviso del formulario y el bloqueo de cierre de A2.
describe("cuantiaSegmentacionSinDeterminar", () => {
  it("bienes/servicios sin PAC/valor y sin elección → SIN DETERMINAR (bloquea)", () => {
    expect(
      cuantiaSegmentacionSinDeterminar({ objeto: "bienes_servicios", cuantiaAlta: undefined }),
    ).toBe(true);
    // Falta uno de los dos para el cálculo automático: sigue sin determinar.
    expect(
      cuantiaSegmentacionSinDeterminar({ objeto: "bienes_servicios", valorEstimado: 90000 }),
    ).toBe(true);
    expect(
      cuantiaSegmentacionSinDeterminar({ objeto: "bienes_servicios", pacBienesServicios: 1_000_000 }),
    ).toBe(true);
  });

  it("NO bloquea si el usuario ya eligió alta/baja a mano", () => {
    expect(cuantiaSegmentacionSinDeterminar({ objeto: "bienes_servicios", cuantiaAlta: false })).toBe(false);
    expect(cuantiaSegmentacionSinDeterminar({ objeto: "bienes_servicios", cuantiaAlta: true })).toBe(false);
  });

  it("NO bloquea si hay cálculo automático (PAC y valor)", () => {
    expect(
      cuantiaSegmentacionSinDeterminar({
        objeto: "bienes_servicios",
        pacBienesServicios: 1_226_465.7,
        valorEstimado: 61174,
      }),
    ).toBe(false);
  });

  it("obras: la cuantía no aplica, nunca bloquea por esto", () => {
    expect(cuantiaSegmentacionSinDeterminar({ objeto: "obras_consultoria_obras" })).toBe(false);
  });
});
