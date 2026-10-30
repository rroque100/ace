import { describe, expect, it } from "vitest";
import { PASSWORD_MAXIMO, PASSWORD_MINIMO_EXTERNO, fortalezaPassword, problemasPassword, requisitosPassword } from "@/lib/password-politica";

const DNI = "45871236";

describe("política de la contraseña que elige una persona externa", () => {
  it("acepta una contraseña razonable", () => {
    for (const buena of ["Lluvia-de-Mayo7", "contratos2027x", "Mi.clave.nueva9", "ñandú-azul-42"]) {
      expect(problemasPassword(buena, DNI), buena).toEqual([]);
    }
  });

  it("exige el largo mínimo (y un máximo que no deje pasar un texto enorme)", () => {
    expect(problemasPassword("Ab1cdef", DNI)).toContain(`Al menos ${PASSWORD_MINIMO_EXTERNO} caracteres`);
    expect(problemasPassword("Ab1cdefg", DNI)).toEqual([]);
    expect(problemasPassword(`Ab1${"x".repeat(PASSWORD_MAXIMO)}`, DNI)).toContain(`Al menos ${PASSWORD_MINIMO_EXTERNO} caracteres`);
  });

  it("exige una letra y un número", () => {
    expect(problemasPassword("solo-letras-largas", DNI)).toContain("Una letra y un número");
    expect(problemasPassword("9384726150", DNI)).toContain("Una letra y un número");
    expect(problemasPassword("con2numeros", DNI)).not.toContain("Una letra y un número");
  });

  it("no deja que el DNI de la cuenta forme parte de la contraseña", () => {
    expect(problemasPassword(`clave${DNI}`, DNI)).toContain("No contiene tu DNI");
    expect(problemasPassword(`${DNI}clave`, DNI)).toContain("No contiene tu DNI");
    // Sin DNI conocido no hay nada que comparar: no se inventa un rechazo.
    expect(problemasPassword("Lluvia-de-Mayo7", null)).toEqual([]);
  });

  it("rechaza las contraseñas de siempre, con o sin mayúsculas y tildes", () => {
    for (const comun of ["12345678", "Password1", "PASSWORD", "qwerty123", "Contraseña1", "contrasena1", "ABCD1234", "peru2026"]) {
      expect(problemasPassword(comun, DNI), comun).toContain("No es una contraseña habitual");
    }
  });

  it("cada requisito informa de su estado, en un orden estable, para mostrarlos en vivo", () => {
    const vacio = requisitosPassword("", DNI);
    expect(vacio.map((r) => r.clave)).toEqual(["largo", "letra_numero", "sin_usuario", "no_comun"]);
    // Una contraseña vacía no cumple «no es habitual»: no debe verse una marca verde antes de escribir nada.
    expect(vacio.find((r) => r.clave === "no_comun")?.cumple).toBe(false);
    expect(requisitosPassword("Lluvia-de-Mayo7", DNI).every((r) => r.cumple)).toBe(true);
  });

  it("la fortaleza orienta pero no decide: sube con el largo y la variedad, y una contraseña habitual nunca pasa de «débil»", () => {
    expect(fortalezaPassword("")).toBe(0);
    expect(fortalezaPassword("abc")).toBe(0);
    expect(fortalezaPassword("Lluvia-de-Mayo7")).toBeGreaterThan(fortalezaPassword("lluviademayo"));
    expect(fortalezaPassword("Sol.Y.Luna-2027-Peru!")).toBe(4);
    expect(fortalezaPassword("12345678")).toBeLessThanOrEqual(1);
    expect(fortalezaPassword("Password1")).toBeLessThanOrEqual(1);
  });

  it("cada contraseña de la lista que el servidor rechaza también se ve rechazada en pantalla (misma función)", () => {
    for (const clave of ["abc", "12345678", "sololetraslargas", `x1${DNI}`]) {
      expect(problemasPassword(clave, DNI).length, clave).toBeGreaterThan(0);
      expect(requisitosPassword(clave, DNI).some((r) => !r.cumple), clave).toBe(true);
    }
  });
});
