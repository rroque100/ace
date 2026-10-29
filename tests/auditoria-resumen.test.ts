import { describe, expect, it } from "vitest";
import { aCsv, celdaCsv, resumirConsumo, type FilaUsoIA } from "@/lib/auditoria-resumen";

const fila = (usuario: string | null, modulo: string | null, entrada: number, salida: number, costo: number | string | null = 0, estimado = false): FilaUsoIA => ({
  usuario_id: usuario, modulo, operacion: "llm", tokens_entrada: entrada, tokens_salida: salida, costo_estimado: costo, estimado,
});

describe("consumo de IA por cuenta y por módulo", () => {
  const resumen = resumirConsumo([
    fila("ana", "centro_juridico", 1000, 200, 0.0015),
    fila("ana", "centro_juridico", 500, 100, "0.0008"),
    fila("ana", "simulacro", 300, 50, 0.0003, true),
    fila("beto", "centro_juridico", 90, 10, 0.0001),
  ]);

  it("suma tokens, llamadas y costo por módulo dentro de cada cuenta", () => {
    const ana = resumen.usuarios.find((u) => u.usuarioId === "ana")!;
    expect(ana.llamadas).toBe(3);
    expect(ana.tokens).toBe(2150);
    expect(ana.modulos.find((m) => m.modulo === "centro_juridico")).toMatchObject({ llamadas: 2, tokens: 1800, tokensEntrada: 1500, tokensSalida: 300, costo: 0.0023 });
    expect(ana.modulos.find((m) => m.modulo === "simulacro")).toMatchObject({ llamadas: 1, tokens: 350 });
  });
  it("las cuentas y los módulos van del que más consume al que menos", () => {
    expect(resumen.usuarios.map((u) => u.usuarioId)).toEqual(["ana", "beto"]);
    expect(resumen.usuarios[0].modulos.map((m) => m.modulo)).toEqual(["centro_juridico", "simulacro"]);
  });
  it("marca el módulo cuyo consumo incluye estimaciones (el proveedor no informó los tokens)", () => {
    const ana = resumen.usuarios[0];
    expect(ana.modulos.find((m) => m.modulo === "simulacro")!.conEstimados).toBe(true);
    expect(ana.modulos.find((m) => m.modulo === "centro_juridico")!.conEstimados).toBe(false);
  });
  it("el total cuadra con la suma de las cuentas", () => {
    expect(resumen.total).toEqual({ llamadas: 4, tokens: 2250, costo: 0.0027 });
  });
  it("ignora lo ilegible en vez de contaminar el total, y no pierde lo sin módulo", () => {
    const r = resumirConsumo([fila(null, "x", 100, 100), fila("c", null, 10, 5, "no es número"), fila("c", "x", -50, Number.NaN, null), fila("c", "x", 1.6, 2.4, 0.5)]);
    expect(r.usuarios).toHaveLength(1);
    expect(r.usuarios[0].modulos.map((m) => m.modulo).sort()).toEqual(["otros", "x"]);
    expect(r.total.tokens).toBe(15 + 2 + 2);
    expect(r.total.costo).toBe(0.5);
  });
  it("sin filas devuelve un resumen vacío", () => {
    expect(resumirConsumo([])).toEqual({ usuarios: [], total: { llamadas: 0, tokens: 0, costo: 0 } });
  });
});

describe("CSV: lo que controla quien navega no puede ejecutarse como fórmula en Excel", () => {
  it("neutraliza las celdas que empiezan por un operador de fórmula", () => {
    for (const peligrosa of ["=HYPERLINK(\"http://x\")", "+cmd|' /C calc'!A0", "-2+3", "@SUM(A1)", "\tTAB", "\rCR"]) {
      expect(celdaCsv(peligrosa).replace(/^"/, "").startsWith("'"), peligrosa).toBe(true);
    }
    expect(celdaCsv("190.12.5.7")).toBe("190.12.5.7");
    expect(celdaCsv("ver /chat")).toBe("ver /chat");
  });
  it("escapa comillas, comas, saltos de línea y puntos y coma", () => {
    expect(celdaCsv('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(celdaCsv("a,b")).toBe('"a,b"');
    expect(celdaCsv("línea1\nlínea2")).toBe('"línea1\nlínea2"');
    expect(celdaCsv("a;b")).toBe('"a;b"');
  });
  it("nulos y números salen como texto limpio", () => {
    expect(celdaCsv(null)).toBe("");
    expect(celdaCsv(undefined)).toBe("");
    expect(celdaCsv(42)).toBe("42");
    expect(celdaCsv(0)).toBe("0");
  });
  it("el documento lleva cabecera, BOM y saltos CRLF, y respeta el orden de columnas", () => {
    const csv = aCsv(["usuario", "ip", "accion"], [{ usuario: "12345678", ip: "1.2.3.4", accion: "=cmd" }, { usuario: "87654321", ip: "2800:1::7", accion: "ver /chat" }]);
    expect(csv.startsWith("﻿usuario,ip,accion\r\n")).toBe(true);
    expect(csv).toContain("12345678,1.2.3.4,'=cmd\r\n");
    expect(csv.endsWith("ver /chat\r\n")).toBe(true);
    expect(aCsv(["a"], [])).toBe("﻿a\r\n");
  });
});
