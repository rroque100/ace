import { describe, expect, it } from "vitest";
import {
  correoDeUsuario,
  credencialAIdentificador,
  esUsuarioValido,
  etiquetaDeCuenta,
  normalizarUsuario,
  usuarioDeCorreo,
} from "@/lib/usuario-credencial";

describe("validación del usuario", () => {
  it("acepta exactamente ocho dígitos", () => {
    expect(esUsuarioValido("12345678")).toBe(true);
    expect(esUsuarioValido("00000001")).toBe(true);
  });

  it("rechaza longitudes distintas de ocho", () => {
    expect(esUsuarioValido("1234567")).toBe(false);
    expect(esUsuarioValido("123456789")).toBe(false);
    expect(esUsuarioValido("")).toBe(false);
  });

  it("rechaza cualquier cosa que no sean dígitos", () => {
    expect(esUsuarioValido("1234567a")).toBe(false);
    expect(esUsuarioValido("1234 567")).toBe(false);
    expect(esUsuarioValido("+1234567")).toBe(false);
    // Un DNI con separadores no es válido: el correo derivado sería distinto
    // según cómo se hubiera tecleado, y la misma persona tendría dos cuentas.
    expect(esUsuarioValido("1234-5678")).toBe(false);
  });
});

describe("normalización al teclear", () => {
  it("quita todo lo que no sea dígito", () => {
    expect(normalizarUsuario("12-34 56.78")).toBe("12345678");
    expect(normalizarUsuario("abc")).toBe("");
  });

  it("corta el exceso en vez de dejar escribir de más", () => {
    expect(normalizarUsuario("1234567890")).toBe("12345678");
  });

  it("tolera valores ausentes", () => {
    expect(normalizarUsuario(undefined as unknown as string)).toBe("");
  });
});

describe("ida y vuelta usuario ↔ correo", () => {
  it("el correo derivado vuelve al mismo usuario", () => {
    for (const u of ["12345678", "00000000", "99999999"]) {
      expect(usuarioDeCorreo(correoDeUsuario(u))).toBe(u);
    }
  });

  it("no construye un correo con un usuario inválido", () => {
    // Sin esto se crearía `undefined@ace.local`: una cuenta que nadie puede usar
    // ni encontrar después para borrarla.
    expect(() => correoDeUsuario("123")).toThrow();
    expect(() => correoDeUsuario("")).toThrow();
  });

  it("no reconoce como usuario un correo real ni una cuenta de rol", () => {
    expect(usuarioDeCorreo("persona@entidad.gob.pe")).toBeNull();
    expect(usuarioDeCorreo("dec@ace.local")).toBeNull();
    expect(usuarioDeCorreo(null)).toBeNull();
  });

  it("es insensible a mayúsculas en el dominio", () => {
    expect(usuarioDeCorreo("12345678@ACE.LOCAL")).toBe("12345678");
  });
});

describe("etiqueta de la cuenta", () => {
  it("las cuentas nuevas se ven por su usuario", () => {
    expect(etiquetaDeCuenta("12345678@ace.local")).toBe("12345678");
  });

  it("las cuentas antiguas y las de rol siguen viéndose por su correo", () => {
    // Ocultarlas dejaría filas sin identificar en la tabla de usuarios.
    expect(etiquetaDeCuenta("persona@entidad.gob.pe")).toBe("persona@entidad.gob.pe");
    expect(etiquetaDeCuenta("dec@ace.local")).toBe("dec@ace.local");
  });

  it("sin correo no inventa nada", () => {
    expect(etiquetaDeCuenta(null)).toBe("");
  });
});

describe("lo que se teclea al iniciar sesión", () => {
  it("ocho dígitos se traducen al correo interno", () => {
    expect(credencialAIdentificador("12345678")).toBe("12345678@ace.local");
  });

  it("un correo pasa tal cual, en minúsculas", () => {
    // Las cuentas creadas ANTES de este cambio tienen correos reales. Si el
    // inicio de sesión solo admitiera dígitos, se quedarían fuera el día del
    // despliegue —incluida la del administrador que gestiona las demás—.
    expect(credencialAIdentificador("Persona@Entidad.gob.pe")).toBe("persona@entidad.gob.pe");
    expect(credencialAIdentificador("dec@ace.local")).toBe("dec@ace.local");
  });

  it("un usuario incompleto falla en vez de inventar una cuenta", () => {
    expect(() => credencialAIdentificador("1234")).toThrow();
  });
});
