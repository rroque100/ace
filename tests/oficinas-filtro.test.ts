import { describe, expect, it } from "vitest";

// Replicamos la logica del endpoint /api/expedientes-archivo/respuesta/oficinas

function normalizeEntity(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPreview(
  tipo: string,
  siguiente: number,
  ancho: number,
  sufijo: string | null,
  year: number = new Date().getFullYear(),
): string {
  const num = String(siguiente).padStart(ancho, "0");
  const parts: string[] = [num, String(year)];
  if (sufijo) {
    const segs = sufijo
      .split(/[\/\-]/)
      .map((s) => s.trim())
      .filter(Boolean);
    parts.push(...segs);
  }
  return `${tipo} N° ${parts.join("-")}`;
}

function officesMatch(
  oficina: { entidad: string | null },
  userEntity: string,
): boolean {
  if (!userEntity) return false;
  return normalizeEntity(oficina.entidad) === normalizeEntity(userEntity);
}

describe("normalizeEntity", () => {
  it("minusculas y trim", () => {
    expect(normalizeEntity("  MUNICIPALIDAD  ")).toBe("municipalidad");
  });

  it("sin tildes", () => {
    expect(normalizeEntity("Municipalidad Distrital de Acomayo")).toBe(
      "municipalidad distrital de acomayo",
    );
  });

  it("colapsa espacios multiples", () => {
    expect(normalizeEntity("Muni   Distrital   X")).toBe("muni distrital x");
  });

  it("vacio o null", () => {
    expect(normalizeEntity("")).toBe("");
    expect(normalizeEntity(null)).toBe("");
    expect(normalizeEntity(undefined)).toBe("");
  });
});

describe("officesMatch (matching por entidad normalizada)", () => {
  it("match exacto sin tildes", () => {
    expect(
      officesMatch(
        { entidad: "Municipalidad Distrital de Acomayo" },
        "MUNICIPALIDAD DISTRITAL DE ACOMAYO",
      ),
    ).toBe(true);
  });

  it("no match si difieren", () => {
    expect(
      officesMatch(
        { entidad: "Municipalidad de Lima" },
        "Municipalidad de Cusco",
      ),
    ).toBe(false);
  });

  it("userEntity vacio: nunca matchea", () => {
    expect(officesMatch({ entidad: "Muni X" }, "")).toBe(false);
  });

  it("oficina sin entidad: no matchea", () => {
    expect(officesMatch({ entidad: null }, "Muni X")).toBe(false);
  });
});

describe("buildPreview (formato nuevo con año)", () => {
  it("formato basico", () => {
    expect(buildPreview("OFICIO", 1, 3, "MDCH", 2026)).toBe(
      "OFICIO N° 001-2026-MDCH",
    );
  });

  it("sufijo con segmentos por guion", () => {
    expect(buildPreview("OFICIO", 1, 3, "MDCH-GM", 2026)).toBe(
      "OFICIO N° 001-2026-MDCH-GM",
    );
  });

  it("ancho 4: numero con padding", () => {
    expect(buildPreview("INFORME", 42, 4, "MDCH", 2026)).toBe(
      "INFORME N° 0042-2026-MDCH",
    );
  });
});
