import { describe, expect, it } from "vitest";
import { APP_ROLES, ROLE_CAPABILITIES, rolesConCapacidad } from "@/lib/permisos-contratacion";
import { aprobadorNoCompetitivo, textoCausalArt55 } from "@/lib/regimen-seleccion";

describe("rolesConCapacidad", () => {
  it("devuelve los nombres legibles, no las claves", () => {
    // El aviso se le enseña a una persona: "area_usuaria" no es un rol, es una
    // clave de base de datos.
    const roles = rolesConCapacidad("necesidad.manage");
    expect(roles).toContain("Área usuaria");
    expect(roles.join(" ")).not.toContain("_");
  });

  it("incluye a admin, que el texto fijo anterior se dejaba fuera", () => {
    expect(rolesConCapacidad("necesidad.manage").join(", ")).toMatch(/administrador/i);
  });

  it("NO incluye al oficial de compra en necesidades", () => {
    // El requerimiento lo formula el área usuaria (Art. 44); el oficial de
    // compra conduce el procedimiento de selección (Art. 58).
    const roles = rolesConCapacidad("necesidad.manage");
    expect(roles).not.toContain("Oficial de Compra");
  });

  it("coincide con la matriz para toda capacidad", () => {
    // Si alguien cambia ROLE_CAPABILITIES, el aviso cambia con él: es lo que
    // evita que el texto se quede corto como estaba.
    for (const cap of ["necesidad.manage", "expediente.manage", "expediente.approve"] as const) {
      const esperados = APP_ROLES.filter((r) => ROLE_CAPABILITIES[r.value].includes(cap)).map(
        (r) => r.label,
      );
      expect(rolesConCapacidad(cap), cap).toEqual(esperados);
    }
  });

  it("una capacidad que nadie tiene devuelve lista vacía, no todos", () => {
    const inventada = "no.existe" as never;
    expect(rolesConCapacidad(inventada)).toEqual([]);
  });
});

describe("quién aprueba un procedimiento no competitivo (Art. 102)", () => {
  it("el TITULAR en emergencia, desabastecimiento y contrato resuelto", () => {
    // 102.2, literal: causales b), c) y k) del numeral 55.1.
    for (const causal of ["b", "c", "k"]) {
      const r = aprobadorNoCompetitivo(causal);
      expect(r.actor, causal).toBe("titular");
      expect(r.articulo).toBe("Art. 102.2");
    }
  });

  it("la AGA en las diez restantes", () => {
    // 102.1: a), d), e), f), g), h), i), j), l) y m).
    for (const causal of ["a", "d", "e", "f", "g", "h", "i", "j", "l", "m"]) {
      const r = aprobadorNoCompetitivo(causal);
      expect(r.actor, causal).toBe("aga");
      expect(r.articulo).toBe("Art. 102.1");
    }
  });

  it("sin causal cae en la AGA, que es la regla general del 102.1", () => {
    expect(aprobadorNoCompetitivo("").actor).toBe("aga");
    expect(aprobadorNoCompetitivo(null).actor).toBe("aga");
  });

  it("tolera mayúsculas y espacios", () => {
    expect(aprobadorNoCompetitivo(" B ").actor).toBe("titular");
  });

  it("las trece causales del Art. 55.1 tienen texto", () => {
    for (const c of "abcdefghijklm".split("")) {
      expect(textoCausalArt55(c), c).not.toBe("");
    }
  });
});
