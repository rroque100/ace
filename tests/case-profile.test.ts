import { describe, expect, it } from "vitest";
import { caseFieldLimits } from "@/lib/chat-case-context";
import {
  CASE_PROFILE_STALE_DAYS, caseProfileKey, describeProfile, describeProfileAge, isEmptyCommonContext, isStaleProfile, matchesProfile, parseCaseProfile,
  profileAgeDays, profileToContext, serializeCaseProfile,
} from "@/lib/case-profile";

const DIA = 86_400_000;
const ahora = Date.UTC(2026, 9, 29, 12);

describe("perfil de caso: qué se guarda y qué no", () => {
  it("guarda régimen, fechas y objeto, y nunca los hechos", () => {
    const guardado = serializeCaseProfile({ regime: "Ley 30225", dates: "Convocado el 3 de marzo de 2025", object: "Obra", facts: "El contratista se atrasó y no hay penalidad pactada" }, ahora)!;
    expect(guardado).not.toContain("contratista");
    expect(JSON.parse(guardado)).toEqual({ regime: "Ley 30225", dates: "Convocado el 3 de marzo de 2025", object: "Obra", savedAt: ahora });
  });
  it("sin nada común que guardar no hay perfil, aunque haya hechos", () => {
    expect(serializeCaseProfile({ regime: "", dates: "  ", facts: "solo hechos" }, ahora)).toBeNull();
  });
  it("un perfil guardado vuelve como contexto sin hechos, listo para el formulario", () => {
    const perfil = parseCaseProfile(serializeCaseProfile({ regime: "", dates: "Junio de 2026", object: "Servicios", facts: "x" }, ahora))!;
    expect(profileToContext(perfil)).toEqual({ regime: "", dates: "Junio de 2026", object: "Servicios", facts: "" });
    expect(profileToContext({ ...perfil, object: "" }).object).toBeUndefined();
  });
});

describe("lo leído del almacenamiento se trata como entrada de un tercero", () => {
  it("rechaza texto que no es un perfil, sin lanzar", () => {
    for (const malo of [null, undefined, "", "no es json", "[]", "null", "42", '"texto"', "{}", '{"regime":5,"dates":[],"object":{}}']) expect(parseCaseProfile(malo as never), String(malo)).toBeNull();
  });
  it("recorta campos desmesurados a los topes del formulario y descarta tipos ajenos", () => {
    const perfil = parseCaseProfile(JSON.stringify({ regime: "r".repeat(5000), dates: "d".repeat(5000), object: "o".repeat(5000), savedAt: ahora, facts: "no debe entrar", extra: 1 }))!;
    expect(perfil.regime).toHaveLength(caseFieldLimits.regime);
    expect(perfil.dates).toHaveLength(caseFieldLimits.dates);
    expect(perfil.object).toHaveLength(caseFieldLimits.object);
    expect(Object.keys(perfil).sort()).toEqual(["dates", "object", "regime", "savedAt"]);
  });
  it("una fecha de guardado inválida no rompe nada: el perfil cuenta como antiguo", () => {
    for (const savedAt of ["ayer", -5, 0, Number.NaN, null]) {
      const perfil = parseCaseProfile(JSON.stringify({ dates: "2024", savedAt }))!;
      expect(perfil.savedAt).toBe(0);
      expect(isStaleProfile(perfil, ahora)).toBe(true);
      expect(describeProfileAge(perfil, ahora)).toBe("guardado hace tiempo");
    }
  });
  it("la clave es por usuario, para que dos personas en el mismo navegador no compartan caso", () => {
    expect(caseProfileKey("a")).not.toBe(caseProfileKey("b"));
    expect(caseProfileKey("")).toBe(caseProfileKey(""));
  });
});

describe("antigüedad del perfil: una fecha vieja no debe mandar en silencio", () => {
  const perfil = { regime: "", dates: "2024", object: "", savedAt: ahora };
  it("cuenta días completos y los muestra", () => {
    expect(profileAgeDays(perfil, ahora)).toBe(0);
    expect(describeProfileAge(perfil, ahora)).toBe("guardado hoy");
    expect(describeProfileAge(perfil, ahora + DIA)).toBe("guardado ayer");
    expect(describeProfileAge(perfil, ahora + 5 * DIA + 3_600_000)).toBe("guardado hace 5 días");
  });
  it("pasado el plazo se marca como viejo (y el reloj hacia atrás no da días negativos)", () => {
    expect(isStaleProfile(perfil, ahora + (CASE_PROFILE_STALE_DAYS - 1) * DIA)).toBe(false);
    expect(isStaleProfile(perfil, ahora + CASE_PROFILE_STALE_DAYS * DIA)).toBe(true);
    expect(profileAgeDays(perfil, ahora - 3 * DIA)).toBe(0);
  });
});

describe("comparar el formulario con el perfil", () => {
  const perfil = { regime: "Ley 30225", dates: "Marzo de 2025", object: "Obra", savedAt: ahora };
  it("ignora los hechos y los espacios sobrantes", () => {
    expect(matchesProfile({ regime: " Ley 30225 ", dates: "Marzo de 2025", object: "Obra", facts: "lo que sea" }, perfil)).toBe(true);
    expect(matchesProfile({ regime: "Ley 30225", dates: "Abril de 2025", object: "Obra", facts: "" }, perfil)).toBe(false);
    expect(matchesProfile({ regime: "Ley 30225", dates: "Marzo de 2025", facts: "" }, perfil)).toBe(false);
  });
  it("lo común vacío se reconoce aunque haya hechos", () => {
    expect(isEmptyCommonContext({ regime: "", dates: " ", facts: "hechos" })).toBe(true);
    expect(isEmptyCommonContext({ regime: "", dates: "2024", facts: "" })).toBe(false);
  });
  it("el resumen se recorta y no repite campos vacíos", () => {
    expect(describeProfile(perfil)).toBe("Obra · Marzo de 2025 · Ley 30225");
    expect(describeProfile({ ...perfil, regime: "", object: "" })).toBe("Marzo de 2025");
    expect(describeProfile({ ...perfil, object: "x".repeat(400) }).length).toBeLessThanOrEqual(140);
  });
});
