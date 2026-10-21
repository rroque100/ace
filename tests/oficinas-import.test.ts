import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

// Replicamos las funciones del parser del endpoint para test puro
// (sin Supabase ni fetch). Si la logica cambia, este test debe actualizarse.

type Row = Record<string, unknown> & { _row: number };

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const SIMPLE_ALIASES: Record<string, string[]> = {
  nombre: ["nombre", "oficina", "area", "area_usuario", "área", "usuario"],
  entidad: ["entidad", "institucion", "institución", "municipalidad"],
  ruc: ["ruc", "ruc_entidad"],
  responsable_nombre: ["responsable", "responsable_nombre", "firma", "firma_nombre"],
  responsable_cargo: ["cargo", "responsable_cargo", "cargo_responsable"],
  sufijo: ["sufijo", "siglas"],
  ancho: ["ancho", "ancho_numeracion", "padding"],
  activo: ["activo", "estado"],
};

const SIAF_ALIASES: Record<string, string[]> = {
  nombre: ["nombre_depend", "dependencia", "area", "oficina"],
  entidad: ["nombre_sede", "entidad"],
  ruc: [],
  responsable_nombre: [],
  responsable_cargo: [],
  sufijo: ["abreviado_depend", "siglas", "abreviatura"],
  ancho: [],
  activo: ["estado"],
};

const SIAF_EXTRA_HEADERS: Record<string, string[]> = {
  paterno: ["paterno", "apellido_paterno"],
  materno: ["materno", "apellido_materno"],
  nombres: ["nombres", "nombre"],
  cargo: ["cargo_depend", "cargo", "denominacion_cargo"],
  centro_costo: ["centro_costo", "ccosto"],
  tipo_depend: ["tipo_depend", "tipo"],
  estado: ["estado"],
  nombre_entidad: ["nombre_entidad", "razon_social"],
  ruc_entidad: ["ruc_entidad", "ruc"],
};

function buildHeaderMap(headerRow: string[], aliases: Record<string, string[]>): Map<string, number> {
  const map = new Map<string, number>();
  const normalized = headerRow.map(normalizeHeader);
  Object.keys(aliases).forEach((key) => {
    const list = aliases[key].map(normalizeHeader);
    const idx = normalized.findIndex((n) => list.includes(n));
    if (idx !== -1) map.set(key, idx);
  });
  return map;
}

function buildExtraHeaderMap(headerRow: string[], extras: Record<string, string[]>): Map<string, number> {
  const map = new Map<string, number>();
  const normalized = headerRow.map(normalizeHeader);
  Object.keys(extras).forEach((key) => {
    const list = extras[key].map(normalizeHeader);
    const idx = normalized.findIndex((n) => list.includes(n));
    if (idx !== -1) map.set(key, idx);
  });
  return map;
}

function asText(value: unknown, max = 200): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

type ParsedResult = {
  preview: Row[];
  headers: string[];
  detectedFormat: "siaf" | "simple";
  cachedEntidad: string | null;
  cachedRuc: string | null;
};

function parseRows(buffer: Buffer): ParsedResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: "",
  });
  if (rows.length < 2) {
    return { preview: [], headers: [], detectedFormat: "simple", cachedEntidad: null, cachedRuc: null };
  }
  const headers = (rows[0] as unknown[]).map((c) => String(c ?? ""));
  const normalized = headers.map(normalizeHeader);

  const isSiaf =
    normalized.includes("nombre_depend") &&
    (normalized.includes("centro_costo") ||
      normalized.includes("sec_ejec") ||
      normalized.includes("tipo_depend"));

  const headerMap = isSiaf ? buildHeaderMap(headers, SIAF_ALIASES) : buildHeaderMap(headers, SIMPLE_ALIASES);
  const extraMap = isSiaf ? buildExtraHeaderMap(headers, SIAF_EXTRA_HEADERS) : null;

  const preview: Row[] = [];
  let cachedEntidad: string | null = null;
  let cachedRuc: string | null = null;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    if (!r || r.every((c) => c === "" || c == null)) continue;

    if (isSiaf && extraMap) {
      const tIdx = extraMap.get("tipo_depend");
      const eIdx = extraMap.get("estado");
      const tipo = tIdx !== undefined ? Number(r[tIdx]) || null : null;
      const estado = eIdx !== undefined ? String(r[eIdx] ?? "").trim().toUpperCase() : null;
      if (estado && estado !== "A") continue;
      if (tipo === 1) {
        const nombreEntidadIdx = extraMap.get("nombre_entidad");
        const rucEntidadIdx = extraMap.get("ruc_entidad");
        if (nombreEntidadIdx !== undefined && !cachedEntidad) {
          cachedEntidad = asText(r[nombreEntidadIdx], 200);
        } else if (!cachedEntidad) {
          const nIdx = headerMap.get("nombre");
          if (nIdx !== undefined) cachedEntidad = asText(r[nIdx], 200);
        }
        if (rucEntidadIdx !== undefined && !cachedRuc) {
          cachedRuc = asText(r[rucEntidadIdx], 20);
        }
        continue;
      }
    }

    const raw: Record<string, unknown> = {};
    headerMap.forEach((colIdx, key) => {
      raw[key] = r[colIdx];
    });

    if (isSiaf && extraMap) {
      const pIdx = extraMap.get("paterno");
      const mIdx = extraMap.get("materno");
      const nIdx = extraMap.get("nombres");
      const cIdx = extraMap.get("cargo");
      const ccIdx = extraMap.get("centro_costo");
      const paterno = pIdx !== undefined ? asText(r[pIdx]) : null;
      const materno = mIdx !== undefined ? asText(r[mIdx]) : null;
      const nombres = nIdx !== undefined ? asText(r[nIdx]) : null;
      const composed = [paterno, materno, nombres].filter(Boolean).join(" ").trim() || null;
      if (composed) raw.responsable_nombre = composed;
      if (cIdx !== undefined) {
        const cargo = asText(r[cIdx]);
        if (cargo) raw.responsable_cargo = cargo;
      }
      if (!raw.sufijo && ccIdx !== undefined) {
        const cc = asText(r[ccIdx], 60);
        if (cc) raw.sufijo = cc;
      }
      if (!raw.entidad && cachedEntidad) raw.entidad = cachedEntidad;
      if (!raw.ruc && cachedRuc) raw.ruc = cachedRuc;
      if (raw.ruc === "" || raw.ruc === undefined) delete raw.ruc;
    }

    preview.push({ ...raw, _row: i + 1 } as Row);
  }
  return { preview, headers, detectedFormat: isSiaf ? "siaf" : "simple", cachedEntidad, cachedRuc };
}

function buildWorkbook(header: string[], data: unknown[][]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  XLSX.utils.book_append_sheet(wb, ws, "Oficinas");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("parseRows: header detection (formato simple)", () => {
  it("detecta la columna nombre aunque venga como 'area' o 'oficina'", () => {
    const buf = buildWorkbook(
      ["area", "entidad", "ruc", "responsable"],
      [
        ["Gerencia Municipal", "Muni Lima", "20123456789", "Juan Pérez"],
        ["Subgerencia RR.HH.", "Muni Lima", "20123456789", "Ana López"],
      ],
    );
    const { preview, headers } = parseRows(buf);
    expect(headers).toEqual(["area", "entidad", "ruc", "responsable"]);
    expect(preview).toHaveLength(2);
    expect(preview[0].nombre).toBe("Gerencia Municipal");
    expect(preview[0].entidad).toBe("Muni Lima");
    expect(preview[0].ruc).toBe("20123456789");
    expect(preview[0].responsable_nombre).toBe("Juan Pérez");
  });

  it("detecta la columna nombre como 'area_usuario'", () => {
    const buf = buildWorkbook(
      ["area_usuario", "sufijo"],
      [["Oficina de Tesorería", "2026-MDCH/TES"]],
    );
    const { preview } = parseRows(buf);
    expect(preview[0].nombre).toBe("Oficina de Tesorería");
    expect(preview[0].sufijo).toBe("2026-MDCH/TES");
  });

  it("ignora tildes y mayusculas en headers", () => {
    const buf = buildWorkbook(
      ["NOMBRE", "Entidad", "RUC"],
      [["Gerencia", "Muni", "20123456789"]],
    );
    const { preview } = parseRows(buf);
    expect(preview[0].nombre).toBe("Gerencia");
    expect(preview[0].entidad).toBe("Muni");
    expect(preview[0].ruc).toBe("20123456789");
  });
});

describe("parseRows: row filtering", () => {
  it("omite filas completamente vacias", () => {
    const buf = buildWorkbook(
      ["nombre", "entidad"],
      [
        ["Gerencia 1", "Muni 1"],
        ["", ""],
        ["", null],
        ["Gerencia 2", "Muni 2"],
      ],
    );
    const { preview } = parseRows(buf);
    expect(preview).toHaveLength(2);
    expect(preview[0].nombre).toBe("Gerencia 1");
    expect(preview[1].nombre).toBe("Gerencia 2");
  });

  it("reporta el numero de fila (1-based, saltando el header)", () => {
    const buf = buildWorkbook(
      ["nombre"],
      [["Fila A"], ["Fila B"], ["Fila C"]],
    );
    const { preview } = parseRows(buf);
    expect(preview[0]._row).toBe(2);
    expect(preview[1]._row).toBe(3);
    expect(preview[2]._row).toBe(4);
  });
});

describe("parseRows: formato SIAF/MEF (area.XLS)", () => {
  it("detecta automaticamente el formato SIAF por sus headers caracteristicos", () => {
    const buf = buildWorkbook(
      [
        "sec_ejec",
        "centro_costo",
        "nombre_depend",
        "abreviado_depend",
        "tipo_depend",
        "estado",
        "paterno",
        "materno",
        "nombres",
      ],
      [[300308, "0105", "GERENCIA MUNICIPAL", "GM", 2, "A", "CALDERON", "JARA", "LUIS A."]],
    );
    const { detectedFormat } = parseRows(buf);
    expect(detectedFormat).toBe("siaf");
  });

  it("mapea nombre_depend → nombre, abreviado_depend → sufijo", () => {
    const buf = buildWorkbook(
      [
        "sec_ejec",
        "centro_costo",
        "nombre_depend",
        "abreviado_depend",
        "tipo_depend",
        "estado",
        "paterno",
        "materno",
        "nombres",
      ],
      [
        [
          300308,
          "01",
          "MUNICIPALIDAD DISTRITAL DE CHALLHUAHUACHO",
          "MDCH",
          1,
          "A",
          "CRUZ",
          "PUMA",
          "LUIS",
        ],
        [300308, "0105", "GERENCIA MUNICIPAL", "GM", 2, "A", "CALDERON", "JARA", "LUIS A."],
      ],
    );
    const { preview, detectedFormat, cachedEntidad } = parseRows(buf);
    expect(detectedFormat).toBe("siaf");
    expect(cachedEntidad).toBe("MUNICIPALIDAD DISTRITAL DE CHALLHUAHUACHO");
    // Solo la fila 2 (GERENCIA MUNICIPAL) queda; la tipo 1 se filtra como entidad.
    expect(preview).toHaveLength(1);
    expect(preview[0].nombre).toBe("GERENCIA MUNICIPAL");
    expect(preview[0].sufijo).toBe("GM");
    expect(preview[0].entidad).toBe("MUNICIPALIDAD DISTRITAL DE CHALLHUAHUACHO");
    expect(preview[0].responsable_nombre).toBe("CALDERON JARA LUIS A.");
  });

  it("compone responsable_nombre a partir de paterno + materno + nombres", () => {
    const buf = buildWorkbook(
      [
        "sec_ejec",
        "centro_costo",
        "nombre_depend",
        "abreviado_depend",
        "tipo_depend",
        "estado",
        "paterno",
        "materno",
        "nombres",
      ],
      [
        [300308, "01", "MUNI X", "MDX", 1, "A", "X", "Y", "Z"],
        [300308, "010514", "AREA TECNICA MUNICIPAL", "ATM", 4, "A", "RAMOS", "ORDOÑEZ", "ADEMIR REI"],
      ],
    );
    const { preview } = parseRows(buf);
    expect(preview).toHaveLength(1);
    expect(preview[0].responsable_nombre).toBe("RAMOS ORDOÑEZ ADEMIR REI");
  });

  it("omite filas inactivas (estado != A)", () => {
    const buf = buildWorkbook(
      ["sec_ejec", "centro_costo", "nombre_depend", "abreviado_depend", "tipo_depend", "estado"],
      [
        [300308, "01", "MUNI X", "MDX", 1, "A"],
        [300308, "0105", "OFICINA INACTIVA", "OI", 2, "I"],
        [300308, "0106", "OFICINA ACTIVA", "OA", 2, "A"],
      ],
    );
    const { preview } = parseRows(buf);
    expect(preview).toHaveLength(1);
    expect(preview[0].nombre).toBe("OFICINA ACTIVA");
  });

  it("usa centro_costo como sufijo si falta abreviado_depend", () => {
    const buf = buildWorkbook(
      ["sec_ejec", "centro_costo", "nombre_depend", "tipo_depend", "estado"],
      [
        [300308, "01", "MUNI X", 1, "A"],
        [300308, "01051408", "UNIDAD X", 4, "A"],
      ],
    );
    const { preview } = parseRows(buf);
    expect(preview).toHaveLength(1);
    expect(preview[0].sufijo).toBe("01051408");
  });
});

describe("parseRows: edge cases", () => {
  it("devuelve la fila cruda aunque no detecte 'nombre' (el endpoint rechaza despues con Zod)", () => {
    const buf = buildWorkbook(["entidad", "ruc"], [["Muni", "20123456789"]]);
    const { preview, headers } = parseRows(buf);
    expect(headers).toEqual(["entidad", "ruc"]);
    expect(preview).toHaveLength(1);
    expect(preview[0].nombre).toBeUndefined();
  });

  it("maneja archivo con solo headers (sin datos)", () => {
    const buf = buildWorkbook(["nombre"], []);
    const { preview } = parseRows(buf);
    expect(preview).toHaveLength(0);
  });
});
