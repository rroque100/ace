import { describe, expect, it } from "vitest";
import {
  BORRADOR_SUBIR_TTL_MS,
  EMPTY_SUBIR_FORM,
  parsearBorradorSubir,
  tieneContenidoBorrador,
} from "../app/components/expedientes-archivo/borrador-subir";
import { firmaDuplicados } from "../app/components/expedientes-archivo/duplicados";
import type {
  ExpedienteLegajoItem,
  SubirForm,
} from "../app/components/expedientes-archivo/types";

// Reloj fijo: el parseo depende de `ahora - savedAt` y con Date.now() real el
// test sería una carrera contra el TTL.
const AHORA = 1_800_000_000_000;

function formCon(extra: Partial<SubirForm> = {}): SubirForm {
  return { ...EMPTY_SUBIR_FORM, ...extra };
}

function borradorValido(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    form: formCon({ sgdExpediente: "SGD-123", serieDocumento: "Resolución 004-2024" }),
    wizardStep: 1,
    legajo: null,
    fileName: "expediente.pdf",
    fileSize: 2048,
    savedAt: AHORA - 1000,
    ...overrides,
  });
}

const LEGAJO = { id: "legajo-1", documentos_count: 2 } as unknown as ExpedienteLegajoItem;

describe("parsearBorradorSubir", () => {
  it("devuelve null sin raw, con vacío o con JSON corrupto", () => {
    expect(parsearBorradorSubir(null, AHORA)).toBeNull();
    expect(parsearBorradorSubir("", AHORA)).toBeNull();
    expect(parsearBorradorSubir("{no-es-json", AHORA)).toBeNull();
  });

  it("caduca a las 24 h justas", () => {
    const venceEn = AHORA - 1000 + BORRADOR_SUBIR_TTL_MS;
    expect(parsearBorradorSubir(borradorValido(), venceEn + 1)).toBeNull();
    expect(parsearBorradorSubir(borradorValido(), venceEn)).not.toBeNull();
  });

  it("recupera un borrador vigente con todos sus campos", () => {
    const b = parsearBorradorSubir(borradorValido({ legajo: LEGAJO }), AHORA);
    expect(b?.form.sgdExpediente).toBe("SGD-123");
    expect(b?.wizardStep).toBe(1);
    expect(b?.legajo?.id).toBe("legajo-1");
    expect(b?.fileName).toBe("expediente.pdf");
    expect(b?.fileSize).toBe(2048);
  });

  it("rechaza shapes inválidos: form incompleto, paso fuera de rango, legajo sin id", () => {
    const sinCampo = formCon();
    delete (sinCampo as Record<string, unknown>).title;
    expect(
      parsearBorradorSubir(
        JSON.stringify({ savedAt: AHORA, wizardStep: 0, form: sinCampo }),
        AHORA,
      ),
    ).toBeNull();
    expect(parsearBorradorSubir(borradorValido({ wizardStep: 4 }), AHORA)).toBeNull();
    expect(parsearBorradorSubir(borradorValido({ wizardStep: "2" }), AHORA)).toBeNull();
    expect(parsearBorradorSubir(borradorValido({ legajo: 5 }), AHORA)).toBeNull();
  });
});

describe("tieneContenidoBorrador", () => {
  it("el formulario intacto no es un borrador, aunque la oficina venga precargada", () => {
    expect(tieneContenidoBorrador(formCon({ oficina: "Abastecimiento" }), null, 0)).toBe(false);
  });

  it("cualquier dato manual, un legajo o un paso avanzado sí lo son", () => {
    expect(tieneContenidoBorrador(formCon({ sgdExpediente: "SGD-1" }), null, 0)).toBe(true);
    expect(tieneContenidoBorrador(formCon({ resumen: "algo" }), null, 0)).toBe(true);
    expect(tieneContenidoBorrador(formCon(), LEGAJO, 0)).toBe(true);
    expect(tieneContenidoBorrador(formCon(), null, 2)).toBe(true);
  });
});

describe("firmaDuplicados", () => {
  it("usa la clave k:SGD|serie cuando existe y recorta espacios", () => {
    expect(firmaDuplicados({ sgd: " 123 ", serie: "" })).toBe("k:123|");
    expect(firmaDuplicados({ serie: "Resolución 1" })).toBe("k:|Resolución 1");
  });

  it("cae al título solo cuando no hay SGD ni serie", () => {
    expect(firmaDuplicados({ title: " Expediente X " })).toBe("t:Expediente X");
    expect(firmaDuplicados({})).toBe("t:");
  });
});
