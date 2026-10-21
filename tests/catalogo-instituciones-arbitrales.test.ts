import { describe, expect, it } from "vitest";
import {
  parseCatalogoInstituciones,
  rucCatalogoValido,
  siguienteIdCatalogo,
} from "@/lib/catalogo-instituciones-arbitrales";

describe("parseCatalogoInstituciones", () => {
  it("normaliza: recorta, descarta sin nombre y ordena por id", () => {
    const r = parseCatalogoInstituciones([
      { id: 2, nombre: "  Centro B  ", ruc: " 20123456789 " },
      { id: 1, nombre: "Centro A", ruc: "" },
      { nombre: "   " }, // sin nombre → se descarta
      "basura", // no objeto → se descarta
    ]);
    expect(r).toEqual([
      { id: 1, nombre: "Centro A", ruc: "" },
      { id: 2, nombre: "Centro B", ruc: "20123456789" },
    ]);
  });

  it("reasigna id correlativo cuando falta o choca", () => {
    const r = parseCatalogoInstituciones([
      { nombre: "Sin id" },
      { id: 1, nombre: "Con id 1" },
      { id: 1, nombre: "Choca con 1" },
    ]);
    expect(r.map((i) => i.id).sort((a, b) => a - b)).toEqual([1, 2, 3]);
    // Ningún id repetido.
    expect(new Set(r.map((i) => i.id)).size).toBe(3);
  });

  it("valor no-array o vacío → lista vacía", () => {
    expect(parseCatalogoInstituciones(null)).toEqual([]);
    expect(parseCatalogoInstituciones(undefined)).toEqual([]);
    expect(parseCatalogoInstituciones("x")).toEqual([]);
  });
});

describe("rucCatalogoValido", () => {
  it("acepta 11 dígitos o vacío; rechaza el resto", () => {
    expect(rucCatalogoValido("20123456789")).toBe(true);
    expect(rucCatalogoValido("")).toBe(true);
    expect(rucCatalogoValido("  ")).toBe(true);
    expect(rucCatalogoValido("2012345678")).toBe(false); // 10 dígitos
    expect(rucCatalogoValido("2012345678X")).toBe(false);
  });
});

describe("siguienteIdCatalogo", () => {
  it("es max(id)+1, o 1 en lista vacía", () => {
    expect(siguienteIdCatalogo([])).toBe(1);
    expect(
      siguienteIdCatalogo([
        { id: 1, nombre: "A", ruc: "" },
        { id: 5, nombre: "B", ruc: "" },
      ]),
    ).toBe(6);
  });
});
