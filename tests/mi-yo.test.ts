import { describe, expect, it } from "vitest";
import { formatearResumenActividad } from "@/lib/mi-yo";

describe("formatearResumenActividad", () => {
  it("traduce acciones conocidas a una frase legible", () => {
    const lineas = formatearResumenActividad([
      { action: "necesidad.create", details: null, created_at: "2026-08-29T10:00:00.000Z" },
      { action: "expedientes.upload", details: null, created_at: "2026-08-28T09:30:00.000Z" },
    ]);
    expect(lineas).toHaveLength(2);
    expect(lineas[0]).toContain("creaste una necesidad");
    expect(lineas[1]).toContain("subiste un documento al archivo");
  });

  it("no inventa una etiqueta para una acción desconocida: la muestra literal", () => {
    const lineas = formatearResumenActividad([
      { action: "modulo.accion_nueva", details: null, created_at: "2026-08-29T10:00:00.000Z" },
    ]);
    expect(lineas[0]).toContain('hiciste "modulo › accion_nueva"');
  });

  it("conserva el orden de entrada (ya viene ordenado por fecha desde la consulta)", () => {
    const lineas = formatearResumenActividad([
      { action: "necesidad.create", details: null, created_at: "2026-08-29T10:00:00.000Z" },
      { action: "necesidad.update", details: null, created_at: "2026-08-28T10:00:00.000Z" },
    ]);
    expect(lineas[0]).toContain("creaste");
    expect(lineas[1]).toContain("actualizaste");
  });
});
