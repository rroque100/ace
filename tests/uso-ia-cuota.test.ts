import { beforeEach, describe, expect, it, vi } from "vitest";
import { CuotaIAAgotadaError, conContextoUso, consumoMensualTokens, exigirCuotaIA, inicioDeMes, moduloDeUso, olvidarConsumo, type ContextoUso } from "@/lib/uso-ia";

const AHORA = Date.UTC(2026, 9, 29, 12);
const externo = (cuota: number | null): ContextoUso => ({ usuarioId: "u-1", tipoUsuario: "externo", modulo: "centro_juridico", ip: "190.1.1.1", cuotaIAMensual: cuota });

beforeEach(() => { olvidarConsumo(); vi.spyOn(console, "error").mockImplementation(() => {}); });

describe("a qué módulo se atribuye un consumo", () => {
  it("por la ruta que lo originó", () => {
    expect(moduloDeUso("/chat")).toBe("centro_juridico");
    expect(moduloDeUso("/api/chat")).toBe("centro_juridico");
    expect(moduloDeUso("/api/search/voice")).toBe("centro_juridico");
    expect(moduloDeUso("/normas")).toBe("centro_juridico");
    expect(moduloDeUso("/api/simulacro/intentos")).toBe("simulacro");
    expect(moduloDeUso("/necesidades")).toBe("necesidades");
    expect(moduloDeUso("/api/expedientes-archivo/respuesta/save")).toBe("archivo");
    expect(moduloDeUso("/expedientes/123")).toBe("expedientes");
    expect(moduloDeUso("/api/asistente")).toBe("asistente");
    expect(moduloDeUso("/analizar")).toBe("revisar");
    expect(moduloDeUso("/api/documents/reindex")).toBe("biblioteca");
  });
  it("lo no reconocido va a «otros», nunca se pierde; y un prefijo parecido no cuenta", () => {
    expect(moduloDeUso("/algo/raro")).toBe("otros");
    expect(moduloDeUso(null)).toBe("otros");
    expect(moduloDeUso(undefined)).toBe("otros");
    expect(moduloDeUso("/chatroom")).toBe("otros");
  });
});

describe("el mes de la cuota", () => {
  it("empieza el día 1 a las 00:00 UTC", () => {
    expect(inicioDeMes(AHORA)).toBe("2026-10-01T00:00:00.000Z");
    expect(inicioDeMes(Date.UTC(2026, 10, 1, 0, 0, 0))).toBe("2026-11-01T00:00:00.000Z");
    expect(inicioDeMes(Date.UTC(2026, 9, 31, 23, 59, 59))).toBe("2026-10-01T00:00:00.000Z");
    expect(inicioDeMes(Date.UTC(2027, 0, 15))).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("cuota mensual de IA de una cuenta externa", () => {
  it("corta al llegar al tope y deja pasar por debajo", async () => {
    await conContextoUso(externo(1000), async () => {
      await expect(exigirCuotaIA(AHORA, async () => 999)).resolves.toBeUndefined();
      olvidarConsumo();
      await expect(exigirCuotaIA(AHORA, async () => 1000)).rejects.toBeInstanceOf(CuotaIAAgotadaError);
      olvidarConsumo();
      const error = await exigirCuotaIA(AHORA, async () => 5000).catch((e) => e) as CuotaIAAgotadaError;
      expect(error).toMatchObject({ usados: 5000, cuota: 1000, name: "CuotaIAAgotadaError" });
      expect(error.message).toContain("límite mensual");
    });
  });
  it("una cuota de 0 significa «sin IA»: corta desde la primera llamada", async () => {
    await conContextoUso(externo(0), async () => {
      await expect(exigirCuotaIA(AHORA, async () => 0)).rejects.toBeInstanceOf(CuotaIAAgotadaError);
    });
  });
  it("sin tope, o fuera de una solicitud, o con una cuenta interna, no corta nunca (y ni siquiera consulta)", async () => {
    const cargar = vi.fn(async () => 9_999_999);
    await conContextoUso(externo(null), () => exigirCuotaIA(AHORA, cargar));
    await exigirCuotaIA(AHORA, cargar);
    await conContextoUso({ ...externo(10), tipoUsuario: "interno" }, () => exigirCuotaIA(AHORA, cargar));
    expect(cargar).not.toHaveBeenCalled();
  });
  it("recuerda el consumo un minuto (no consulta la base en cada llamada) y luego lo vuelve a leer", async () => {
    const cargar = vi.fn(async () => 100);
    await consumoMensualTokens("u-1", AHORA, cargar);
    await consumoMensualTokens("u-1", AHORA + 30_000, cargar);
    expect(cargar).toHaveBeenCalledTimes(1);
    await consumoMensualTokens("u-1", AHORA + 61_000, cargar);
    expect(cargar).toHaveBeenCalledTimes(2);
    expect(cargar).toHaveBeenCalledWith("u-1", "2026-10-01T00:00:00.000Z");
  });
  it("cada cuenta lleva su propia cuenta", async () => {
    await consumoMensualTokens("a", AHORA, async () => 10);
    expect(await consumoMensualTokens("b", AHORA, async () => 20)).toBe(20);
    expect(await consumoMensualTokens("a", AHORA, async () => 99)).toBe(10);
  });
  it("si no se puede leer el consumo no se deja sin servicio a nadie: cuenta 0 y avisa una sola vez", async () => {
    const roto = vi.fn(async () => { throw new Error("relation \"uso_ia\" does not exist"); });
    expect(await consumoMensualTokens("x", AHORA, roto)).toBe(0);
    await conContextoUso(externo(1000), () => expect(exigirCuotaIA(AHORA, roto)).resolves.toBeUndefined());
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(String((console.error as unknown as { mock: { calls: string[][] } }).mock.calls[0][0])).toContain("usuarios-externos.sql");
  });
});
