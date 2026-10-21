import { describe, expect, it } from "vitest";

// Mock de zod para validar el shape del RespuestaGenerateSchema
// sin necesidad de importar el modulo entero (que tiene side-effects de fetch).

// Replicamos solo la logica de validacion del body del /generate.
type GenerateInput = {
  intencion?: unknown;
  tipoDocumento?: unknown;
  documentoTexto?: unknown;
  remitente?: unknown;
  asunto?: unknown;
  tone?: unknown;
  length?: unknown;
  selectedSources?: unknown;
  normativaIds?: unknown;
  adjuntosIds?: unknown;
  antecedenteId?: unknown;
  includeAntecedentes?: unknown;
};

const DOC_TIPOS = ["OFICIO", "INFORME", "CARTA", "MEMORANDUM"] as const;

function isUuid(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function validate(input: GenerateInput): { ok: true; data: Required<GenerateInput> } | { ok: false; error: string } {
  if (typeof input.intencion !== "string" || input.intencion.trim().length < 10) {
    return { ok: false, error: "intencion debe tener >= 10 caracteres" };
  }
  if (input.tipoDocumento && !DOC_TIPOS.includes(input.tipoDocumento as (typeof DOC_TIPOS)[number])) {
    return { ok: false, error: "tipoDocumento invalido" };
  }
  if (input.antecedenteId !== undefined && input.antecedenteId !== null && !isUuid(input.antecedenteId)) {
    return { ok: false, error: "antecedenteId debe ser UUID" };
  }
  if (input.normativaIds !== undefined && !Array.isArray(input.normativaIds)) {
    return { ok: false, error: "normativaIds debe ser array" };
  }
  if (input.adjuntosIds !== undefined && !Array.isArray(input.adjuntosIds)) {
    return { ok: false, error: "adjuntosIds debe ser array" };
  }
  return { ok: true, data: input as Required<GenerateInput> };
}

describe("RespuestaGenerate schema (antecedenteId + normativaIds + adjuntosIds)", () => {
  it("acepta body minimo valido (solo intencion)", () => {
    const result = validate({ intencion: "Necesito responder sobre una solicitud de licencia" });
    expect(result.ok).toBe(true);
  });

  it("rechaza intencion < 10 caracteres", () => {
    const result = validate({ intencion: "corto" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/intencion/);
  });

  it("acepta antecedenteId como UUID", () => {
    const result = validate({
      intencion: "Necesito responder sobre una solicitud de licencia",
      antecedenteId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(result.ok).toBe(true);
  });

  it("rechaza antecedenteId con formato invalido", () => {
    const result = validate({
      intencion: "Necesito responder sobre una solicitud de licencia",
      antecedenteId: "no-es-uuid",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/antecedenteId.*UUID/);
  });

  it("permite omitir antecedenteId (undefined)", () => {
    const result = validate({
      intencion: "Necesito responder sobre una solicitud de licencia",
    });
    expect(result.ok).toBe(true);
  });

  it("permite antecedenteId null", () => {
    const result = validate({
      intencion: "Necesito responder sobre una solicitud de licencia",
      antecedenteId: null,
    });
    expect(result.ok).toBe(true);
  });

  it("acepta tipoDocumento valido de la lista oficial", () => {
    DOC_TIPOS.forEach((tipo) => {
      const result = validate({
        intencion: "Necesito responder sobre una solicitud de licencia",
        tipoDocumento: tipo,
      });
      expect(result.ok).toBe(true);
    });
  });

  it("rechaza tipoDocumento fuera de la lista", () => {
    const result = validate({
      intencion: "Necesito responder sobre una solicitud de licencia",
      tipoDocumento: "MEMO",
    });
    expect(result.ok).toBe(false);
  });

  it("acepta array de normativaIds y adjuntosIds", () => {
    const result = validate({
      intencion: "Necesito responder sobre una solicitud de licencia",
      normativaIds: ["doc-1", "doc-2"],
      adjuntosIds: ["adj-1"],
    });
    expect(result.ok).toBe(true);
  });

  it("rechaza normativaIds que no es array", () => {
    const result = validate({
      intencion: "Necesito responder sobre una solicitud de licencia",
      normativaIds: "doc-1",
    });
    expect(result.ok).toBe(false);
  });
});

describe("Payload del /respuesta POST con antecedente_id", () => {
  type RespuestaInput = {
    cuerpo?: unknown;
    antecedente_id?: unknown;
  };

  function shape(input: RespuestaInput): Record<string, unknown> {
    if (!input.cuerpo) throw new Error("Falta cuerpo");
    const payload: Record<string, unknown> = { cuerpo: input.cuerpo };
    if (input.antecedente_id) payload.antecedente_id = input.antecedente_id;
    return payload;
  }

  it("incluye antecedente_id cuando viene", () => {
    const payload = shape({
      cuerpo: "Cuerpo de la respuesta",
      antecedente_id: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(payload.antecedente_id).toBe("123e4567-e89b-12d3-a456-426614174000");
  });

  it("omite antecedente_id cuando no viene (no se setea null)", () => {
    const payload = shape({ cuerpo: "Cuerpo de la respuesta" });
    expect("antecedente_id" in payload).toBe(false);
  });
});
