import { describe, expect, it } from "vitest";
import { NECESIDAD_ESTADOS } from "@/lib/necesidad-workflow";
import {
  ORDEN_OPCIONES,
  ORDEN_POR_DEFECTO,
  esOrdenValido,
  ordenPostgrest,
  proximoPaso,
  resumenUrgencia,
} from "@/lib/necesidad-lista";

const DEC = { esDec: true, esAreaUsuaria: false };
const AREA = { esDec: false, esAreaUsuaria: true };
const NADIE = { esDec: false, esAreaUsuaria: false };

describe("orden de la lista", () => {
  it("cada opción lleva un fragmento order= con columna real y dirección", () => {
    for (const o of ORDEN_OPCIONES) {
      expect(o.order).toMatch(/^[a-z_]+\.(asc|desc)(\.nullslast|\.nullsfirst)?$/);
    }
  });

  it("el orden por defecto existe en el catálogo", () => {
    expect(ORDEN_OPCIONES.some((o) => o.value === ORDEN_POR_DEFECTO)).toBe(true);
  });

  it("ordenPostgrest devuelve el fragmento de la clave y cae al por defecto si no la reconoce", () => {
    for (const o of ORDEN_OPCIONES) {
      expect(ordenPostgrest(o.value)).toBe(o.order);
    }
    const porDefecto = ORDEN_OPCIONES.find((o) => o.value === ORDEN_POR_DEFECTO)!.order;
    expect(ordenPostgrest("no-existe")).toBe(porDefecto);
    expect(ordenPostgrest(null)).toBe(porDefecto);
    expect(ordenPostgrest("")).toBe(porDefecto);
  });

  it("esOrdenValido solo acepta claves del catálogo", () => {
    expect(esOrdenValido("monto")).toBe(true);
    expect(esOrdenValido("created_at.desc")).toBe(false); // el fragmento no es una clave
    expect(esOrdenValido(undefined)).toBe(false);
  });
});

describe("titular de urgencia", () => {
  it("junta lo que apremia con singular/plural correctos", () => {
    expect(resumenUrgencia({ porVencer: 2, estancadas: 1 }, 5)).toBe(
      "5 esperan tu acción · 2 por vencer · 1 estancada",
    );
    expect(resumenUrgencia({ porVencer: 0, estancadas: 0 }, 1)).toBe("1 espera tu acción");
    expect(resumenUrgencia({ porVencer: 0, estancadas: 3 }, 0)).toBe("3 estancadas");
  });

  it("sin nada urgente devuelve cadena vacía (no se pinta)", () => {
    expect(resumenUrgencia({ porVencer: 0, estancadas: 0 }, 0)).toBe("");
  });
});

describe("próximo paso de cada estado", () => {
  it("todo estado produce una etiqueta no vacía para cualquier lado", () => {
    for (const e of NECESIDAD_ESTADOS) {
      for (const lado of [DEC, AREA, NADIE]) {
        const p = proximoPaso(e.value, lado, false);
        expect(p.etiqueta.length).toBeGreaterThan(0);
      }
    }
  });

  it("es 'mi turno' exactamente cuando el actor del estado es mi lado", () => {
    for (const e of NECESIDAD_ESTADOS) {
      expect(proximoPaso(e.value, DEC, false).miTurno).toBe(e.actor === "dec");
      expect(proximoPaso(e.value, AREA, false).miTurno).toBe(e.actor === "area_usuaria");
      expect(proximoPaso(e.value, NADIE, false).miTurno).toBe(false);
    }
  });

  it("los estados terminales nunca son turno de nadie y llevan tono terminal", () => {
    for (const e of NECESIDAD_ESTADOS.filter((x) => x.actor === null)) {
      const p = proximoPaso(e.value, DEC, false);
      expect(p.miTurno).toBe(false);
      expect(p.tono).toBe("terminal");
    }
  });

  it("cuando toca al otro lado, lo dice y no propone acción", () => {
    // 'remitido_dec' espera a la DEC: para el área usuaria está "en manos de la DEC".
    const p = proximoPaso("remitido_dec", AREA, false);
    expect(p.miTurno).toBe(false);
    expect(p.tono).toBe("muted");
    expect(p.etiqueta).toContain("la DEC");
  });

  it("en mi turno, la etiqueta es una acción del flujo (p. ej. remitir en borrador)", () => {
    const p = proximoPaso("borrador", AREA, false);
    expect(p.miTurno).toBe(true);
    expect(p.tono).toBe("brand");
    expect(p.etiqueta.length).toBeGreaterThan(0);
  });
});
