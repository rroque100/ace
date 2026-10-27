import { describe, expect, it } from "vitest";
import {
  compareByQualityThenRecency,
  qualityBucket,
  recencyKey,
  yearFromDocumentNumber,
} from "../lib/chat-recency";

type F = { titulo: string; evidenceQuality: number; documentType: string; documentNumber: string | null; year: number | null };
const fuente = (titulo: string, evidenceQuality: number, over: Partial<F> = {}): F => ({
  titulo, evidenceQuality, documentType: "directiva", documentNumber: null, year: null, ...over,
});
const orden = (fuentes: F[]) => [...fuentes].sort(compareByQualityThenRecency).map((f) => f.titulo);

describe("año dentro del número del documento (caso real: el campo year decía 2026 para casi todo)", () => {
  const CASOS: Array<[string, number | null]> = [
    ["013-2025-OECE-CD", 2025],
    ["001-2026-OECE-CD", 2026],
    ["D000112-2026-OECE-DTN", 2026],
    ["002-2025/TCP", 2025],
    ["001-2024/TCE", 2024],
    ["3852-2025-TCP-S1", 2025],
    ["009-2025-EF", 2025],
    ["0001-2026-EF/54.01", 2026],
    ["000027-2025-dtn", 2025],
    ["32069", null],
    ["", null],
  ];
  it("lo extrae de cada formato real y no confunde correlativos con años", () => {
    for (const [numero, esperado] of CASOS) expect(yearFromDocumentNumber(numero), numero).toBe(esperado);
    expect(yearFromDocumentNumber(null)).toBeNull();
    expect(yearFromDocumentNumber("12025-X")).toBeNull();
  });

  it("manda sobre el campo year, que estaba mal (Reglamento 009-2025-EF figuraba como 2026)", () => {
    expect(recencyKey({ documentType: "reglamento", documentNumber: "009-2025-EF", year: 2026 })).toBe(2025);
  });

  it("sin año en el número usa el del metadato; sin ninguno, null", () => {
    expect(recencyKey({ documentType: "guia_instructivo", documentNumber: null, year: 2026 })).toBe(2026);
    expect(recencyKey({ documentType: "guia_instructivo", documentNumber: null, year: null })).toBeNull();
  });
});

describe("las leyes se ordenan por su número, no por el año de carga", () => {
  it("32187 > 32103 > 32069 > 30225 > 27444, aunque year diga 2026 para la LPAG y la 32069", () => {
    const leyes = [
      fuente("LPAG 27444", 1, { documentType: "ley", documentNumber: "27444", year: 2026 }),
      fuente("Ley 30225", 1, { documentType: "ley", documentNumber: "30225", year: 2014 }),
      fuente("Ley 32069", 1, { documentType: "ley", documentNumber: "32069", year: 2026 }),
      fuente("Ley 32187", 1, { documentType: "ley", documentNumber: "32187", year: 2024 }),
      fuente("Ley 32103", 1, { documentType: "ley", documentNumber: "32103", year: 2024 }),
    ];
    expect(orden(leyes)).toEqual(["Ley 32187", "Ley 32103", "Ley 32069", "Ley 30225", "LPAG 27444"]);
  });

  it("dos copias de la misma ley empatan (decide el desempate del llamador)", () => {
    const a = fuente("copia A", 1, { documentType: "ley", documentNumber: "32069" });
    const b = fuente("copia B", 1, { documentType: "ley", documentNumber: "32069" });
    expect(compareByQualityThenRecency(a, b)).toBe(0);
  });
});

describe("orden por recencia dentro de un mismo rango", () => {
  it("a igual calidad, de la más reciente a la más antigua", () => {
    const entrada = [
      fuente("2014", 1, { documentNumber: "004-2014-OSCE-CD" }),
      fuente("2026", 1, { documentNumber: "001-2026-OECE-CD" }),
      fuente("2023", 1, { documentNumber: "010-2023-OSCE-CD" }),
      fuente("2025", 1, { documentNumber: "013-2025-OECE-CD" }),
    ];
    expect(orden(entrada)).toEqual(["2026", "2025", "2023", "2014"]);
  });

  it("la recencia no compra relevancia: un fragmento reciente pero flojo no desplaza al antiguo que responde", () => {
    expect(orden([
      fuente("reciente-flojo", 0.45, { documentNumber: "001-2026-OECE-CD" }),
      fuente("antiguo-exacto", 0.95, { documentNumber: "004-2014-OSCE-CD" }),
    ])).toEqual(["antiguo-exacto", "reciente-flojo"]);
  });

  it("diferencias menores a ~0,1 de calidad cuentan como empate y decide la recencia", () => {
    expect(qualityBucket(0.96)).toBe(qualityBucket(1));
    expect(orden([
      fuente("a-2024", 0.96, { documentNumber: "001-2024-X" }),
      fuente("b-2026", 1, { documentNumber: "001-2026-X" }),
    ])).toEqual(["b-2026", "a-2024"]);
  });

  it("es transitivo: cualquier orden de entrada da el mismo resultado", () => {
    const base = [
      fuente("p", 1, { documentNumber: "1-2024-X" }), fuente("q", 0.97, { documentNumber: "1-2026-X" }),
      fuente("r", 0.93, { documentNumber: "1-2025-X" }), fuente("s", 0.8, { documentNumber: "1-2026-X" }),
      fuente("t", 0.5, { documentNumber: "1-2026-X" }), fuente("u", 0.52, { documentNumber: "1-2014-X" }),
    ];
    const esperado = orden(base);
    for (const rotacion of [1, 2, 3, 4, 5]) {
      expect(orden([...base.slice(rotacion), ...base.slice(0, rotacion)]), `rotación ${rotacion}`).toEqual(esperado);
    }
  });

  it("sin dato de recencia queda al final de su tramo, sin penalizar fuera de él", () => {
    expect(orden([fuente("sin-dato", 1), fuente("2014", 1, { documentNumber: "4-2014-X" })])).toEqual(["2014", "sin-dato"]);
    expect(orden([fuente("sin-dato-bueno", 1), fuente("2026-flojo", 0.5, { documentNumber: "1-2026-X" })])).toEqual([
      "sin-dato-bueno", "2026-flojo",
    ]);
  });

  it("tolera calidades fuera de rango", () => {
    expect(qualityBucket(-1)).toBe(0);
    expect(qualityBucket(7)).toBe(10);
  });
});
