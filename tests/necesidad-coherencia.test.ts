import { describe, expect, it } from "vitest";
import type { Necesidad } from "@/lib/necesidades";
import { bandaProceso, tarjetasCoherencia } from "@/lib/necesidad-coherencia";

const HOY = "2026-07-17";
// PAC de la entidad de prueba → línea de corte 2,200,000.
const PAC = 22_000_000;

const base = (extra: Partial<Record<string, unknown>>): Necesidad =>
  ({ tipo_objeto: "bienes", ...extra }) as unknown as Necesidad;

const claves = (n: Necesidad) =>
  tarjetasCoherencia(n, { pacBienesServicios: PAC, hoy: HOY }).map((t) => t.clave);

describe("bandaProceso · clasifica por palabras clave, conservador", () => {
  it("procedimientos de mayor cuantía → alta", () => {
    expect(bandaProceso("Licitación Pública para Bienes")).toBe("alta");
    expect(bandaProceso("Concurso Público de Servicios")).toBe("alta");
  });
  it("procedimientos de menor cuantía → menor", () => {
    expect(bandaProceso("Comparación de Precios")).toBe("menor");
    expect(bandaProceso("Subasta Inversa Electrónica")).toBe("menor");
    expect(bandaProceso("Procedimiento de Selección No Competitivo")).toBe("menor");
  });
  it("las abreviadas (cuantía intermedia) y lo demás → null, para no dar falsos positivos", () => {
    expect(bandaProceso("Concurso Público Abreviado de Servicios")).toBeNull();
    expect(bandaProceso("Licitación Pública Abreviada para Bienes")).toBeNull();
    expect(bandaProceso("")).toBeNull();
  });
});

describe("tarjetasCoherencia · cuantía ↔ procedimiento", () => {
  it("baja cuantía con un procedimiento de mayor cuantía → lo señala", () => {
    const n = base({ monto_estimado: 90_000, tipo_proceso_seleccion: "Licitación Pública para Bienes" });
    expect(claves(n)).toContain("cuantia_proceso");
  });

  it("alta cuantía con un procedimiento de menor cuantía → lo señala", () => {
    const n = base({ monto_estimado: 3_000_000, tipo_proceso_seleccion: "Comparación de Precios" });
    expect(claves(n)).toContain("cuantia_proceso");
  });

  it("cuando la banda coincide con la cuantía, no señala nada", () => {
    const n = base({ monto_estimado: 90_000, tipo_proceso_seleccion: "Comparación de Precios" });
    expect(claves(n)).not.toContain("cuantia_proceso");
  });

  it("obras se rigen por el Art. 153 (sin línea de corte): no evalúa cuantía↔proceso", () => {
    const n = base({ tipo_objeto: "obras", monto_estimado: 90_000, tipo_proceso_seleccion: "Licitación Pública de Obras" });
    expect(claves(n)).not.toContain("cuantia_proceso");
  });

  it("sin proceso definido no hay contradicción que señalar (lo cubre la orientación de P2)", () => {
    const n = base({ monto_estimado: 90_000, tipo_proceso_seleccion: "" });
    expect(claves(n)).not.toContain("cuantia_proceso");
  });
});

describe("tarjetasCoherencia · fecha requerida ↔ plazo de ejecución", () => {
  it("si ni empezando hoy la ejecución llega a la fecha pedida → lo señala", () => {
    const n = base({ fecha_requerida: "2026-07-27", plazo_ejecucion: 30 }); // 10 días de margen, 30 de ejecución
    expect(claves(n)).toContain("fecha_plazo");
  });

  it("si el plazo cabe antes de la fecha pedida, no señala", () => {
    const n = base({ fecha_requerida: "2026-09-15", plazo_ejecucion: 30 }); // 60 días de margen
    expect(claves(n)).not.toContain("fecha_plazo");
  });

  it("una fecha ya pasada la avisa la verificación, no esta torre", () => {
    const n = base({ fecha_requerida: "2026-07-01", plazo_ejecucion: 30 });
    expect(claves(n)).not.toContain("fecha_plazo");
  });
});
