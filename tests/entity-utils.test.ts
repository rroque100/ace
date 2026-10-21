import { describe, expect, it } from "vitest";
import { entitiesMatch, esOficinaAbastecimiento, normalizeEntity } from "@/lib/entity-utils";

describe("esOficinaAbastecimiento", () => {
  it("reconoce variantes del nombre de la oficina (Abastecimiento/Logística/Adquisiciones)", () => {
    expect(esOficinaAbastecimiento("Oficina de Abastecimiento")).toBe(true);
    expect(esOficinaAbastecimiento("UNIDAD DE LOGÍSTICA")).toBe(true);
    expect(esOficinaAbastecimiento("Sub Gerencia de Adquisiciones")).toBe(true);
    // Con tildes o sin ellas, cualquier caja: normalizeEntity ya lo cubre.
    expect(esOficinaAbastecimiento("logistica")).toBe(true);
  });

  it("rechaza otras oficinas", () => {
    expect(esOficinaAbastecimiento("Gerencia de Desarrollo Social")).toBe(false);
    expect(esOficinaAbastecimiento("Recursos Humanos")).toBe(false);
    expect(esOficinaAbastecimiento(null)).toBe(false);
    expect(esOficinaAbastecimiento(undefined)).toBe(false);
    expect(esOficinaAbastecimiento("")).toBe(false);
  });
});

// Cobertura preexistente que faltaba para las funciones ya existentes del módulo.
describe("normalizeEntity / entitiesMatch", () => {
  it("normaliza espacios, tildes y mayúsculas", () => {
    expect(normalizeEntity("  Oficina   de Logística  ")).toBe("oficina de logistica");
  });

  it("compara dos entidades ignorando esas diferencias", () => {
    expect(entitiesMatch("Oficina de Abastecimiento", "OFICINA DE ABASTECIMIENTO")).toBe(true);
    expect(entitiesMatch("Abastecimiento", "Logística")).toBe(false);
    expect(entitiesMatch(null, "Abastecimiento")).toBe(false);
  });
});
