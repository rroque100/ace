import { describe, expect, it } from "vitest";
import { consultaConsumo, consultaEventos } from "@/lib/auditoria-consulta";

const AHORA = Date.UTC(2026, 9, 29, 12);
const UUID = "3f2b8d0e-5c1a-4b7e-9a60-1d2e3f4a5b6c";

describe("filtros de la auditoría: nada del cliente llega sin validar a la consulta", () => {
  it("por defecto, los últimos 30 días y 100 filas", () => {
    const c = consultaEventos({}, AHORA);
    expect(c).toMatchObject({ ok: true, limite: 100, desde: 0 });
    if (c.ok) {
      expect(c.filtro).toContain(`creado_en=gte.${encodeURIComponent("2026-09-29T12:00:00.000Z")}`);
      expect(c.filtro).toContain(`creado_en=lte.${encodeURIComponent("2026-10-29T12:00:00.000Z")}`);
    }
  });

  it("arma los filtros válidos de usuario, módulo e IP", () => {
    const c = consultaEventos({ usuarioId: UUID, modulo: "simulacro", ip: "190.12.5.7" }, AHORA);
    expect(c.ok && c.filtro).toContain(`usuario_id=eq.${UUID}`);
    expect(c.ok && c.filtro).toContain("modulo=eq.simulacro");
    expect(c.ok && c.filtro).toContain("ip=eq.190.12.5.7");
    expect(consultaEventos({ ip: "2800:200:e010:1::7" }, AHORA).ok).toBe(true);
  });

  it("rechaza lo que colaría un filtro propio (el `&` es el ataque: permite añadir condiciones y saltar la RLS)", () => {
    for (const parametros of [
      { usuarioId: `${UUID}&role=eq.admin` }, { usuarioId: "1 or 1=1" }, { usuarioId: "../etc" },
      { modulo: "simulacro&ip=neq.x" }, { modulo: "admin" }, { modulo: "__proto__" },
      { ip: "1.2.3.4&limit=99999" }, { ip: "1.2.3.4;drop" }, { ip: "<script>" }, { ip: "x".repeat(60) },
    ]) expect(consultaEventos(parametros, AHORA), JSON.stringify(parametros)).toMatchObject({ ok: false });
  });

  it("valida las fechas y el rango", () => {
    expect(consultaEventos({ desde: "ayer" }, AHORA)).toMatchObject({ ok: false, error: "Las fechas no son válidas." });
    expect(consultaEventos({ desde: "2026-10-30", hasta: "2026-10-01" }, AHORA)).toMatchObject({ ok: false, error: "La fecha de inicio es posterior a la de fin." });
    expect(consultaEventos({ desde: "2024-01-01", hasta: "2026-10-29" }, AHORA)).toMatchObject({ ok: false, error: "El rango no puede superar un año." });
    expect(consultaEventos({ desde: "2026-01-01", hasta: "2026-10-29" }, AHORA).ok).toBe(true);
  });

  it("acota el tamaño de página y calcula el desplazamiento", () => {
    expect(consultaEventos({ limite: "999999" }, AHORA)).toMatchObject({ ok: true, limite: 500 });
    expect(consultaEventos({ limite: "0" }, AHORA)).toMatchObject({ ok: true, limite: 100 });
    expect(consultaEventos({ limite: "-5" }, AHORA)).toMatchObject({ ok: true, limite: 1 });
    expect(consultaEventos({ limite: "abc" }, AHORA)).toMatchObject({ ok: true, limite: 100 });
    expect(consultaEventos({ limite: "50", pagina: "3" }, AHORA)).toMatchObject({ ok: true, limite: 50, desde: 150 });
    expect(consultaEventos({ pagina: "-2" }, AHORA)).toMatchObject({ ok: true, desde: 0 });
  });

  it("el consumo de IA no se filtra por IP (esa tabla no la guarda) pero sí por usuario, módulo y fechas", () => {
    const c = consultaConsumo({ usuarioId: UUID, modulo: "centro_juridico", ip: "1.2.3.4" }, AHORA);
    expect(c.ok && c.filtro).toContain(`usuario_id=eq.${UUID}`);
    expect(c.ok && c.filtro).not.toContain("ip=");
    expect(consultaConsumo({ usuarioId: "malo&x=1" }, AHORA).ok).toBe(false);
  });
});
