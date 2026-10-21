import { describe, expect, it } from "vitest";
import { direccionDeLaEntidad } from "@/lib/configuracion-types";
import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";

/**
 * La dirección exacta del apartado de forma de pago (Art. 67) es el domicilio de
 * la propia entidad, y ya está registrado en Configuración → Datos de la
 * entidad. Volver a teclearlo en cada requerimiento es como acaban conviviendo
 * tres direcciones distintas de la misma municipalidad.
 */
const ENTIDAD = {
  address: "Plaza de Armas S/N",
  city: "Challhuahuacho",
  department: "Apurímac",
  province: "Cotabambas",
};

describe("la dirección se compone de las cuatro casillas de Configuración", () => {
  it("en el orden en que se escribe en un documento", () => {
    expect(direccionDeLaEntidad(ENTIDAD)).toBe(
      "Plaza de Armas S/N, Challhuahuacho, Cotabambas, Apurímac",
    );
  });

  it("una entidad a medio configurar da una dirección más corta, no comas vacías", () => {
    expect(direccionDeLaEntidad({ address: "Jr. Lima 100", city: "Abancay" })).toBe(
      "Jr. Lima 100, Abancay",
    );
    expect(direccionDeLaEntidad({ ...ENTIDAD, province: "" })).toBe(
      "Plaza de Armas S/N, Challhuahuacho, Apurímac",
    );
  });

  it("sin calle no devuelve nada", () => {
    // Una ubicación sin domicilio no es una dirección exacta: el hueco del
    // formato debe quedarse a la vista.
    expect(direccionDeLaEntidad({ city: "Challhuahuacho", department: "Apurímac" })).toBe("");
    expect(direccionDeLaEntidad({ address: "   " })).toBe("");
    expect(direccionDeLaEntidad(null)).toBe("");
    expect(direccionDeLaEntidad(undefined)).toBe("");
  });

  it("los espacios sobrantes no cuentan como dato", () => {
    expect(direccionDeLaEntidad({ address: " Jr. Lima 100 ", city: "  ", province: null })).toBe(
      "Jr. Lima 100",
    );
  });
});

describe("llega hasta el campo por dos caminos", () => {
  it("al abrir la ficha, si el campo está vacío", async () => {
    // Se vigila el fuente porque el suite no monta React.
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad/usar-ficha-form.ts", "utf-8");
    const i = fuente.indexOf("function startFichaEdit");
    const cuerpo = fuente.slice(i, fuente.indexOf("setFichaEdit(true)", i));
    expect(cuerpo).toContain("initial.formaPagoDireccion = direccionDeLaEntidad(entidad)");
    // Y solo si está vacío: lo que ya hay escrito es del usuario.
    expect(cuerpo).toContain("if (!initial.formaPagoDireccion)");
  });

  it("y al «Redactar con IA», para las fichas ya abiertas", async () => {
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad-detail.tsx", "utf-8");
    const i = fuente.indexOf("const pedirRedactarIA");
    const cuerpo = fuente.slice(i, fuente.indexOf("\n  };", i));
    expect(cuerpo).toContain("direccionDeLaEntidad(configuredEntity)");
    // Lo escrito a mano manda sobre lo de Configuración.
    expect(cuerpo).toContain('(fichaForm.formaPagoDireccion ?? "").trim() || direccionDeLaEntidad');
    // Y se escribe en el CAMPO, no solo en el texto: lo que va al documento
    // tiene que poder verse y corregirse en la ficha.
    expect(cuerpo).toContain('setFichaField("formaPagoDireccion", direccion)');
  });

  it("el ejemplo del campo enseña la forma que tiene la dirección compuesta", () => {
    const campo = FICHA_SECCIONES.flatMap((s) => s.fields).find((f) => f.api === "formaPagoDireccion")!;
    expect(campo.ejemplo).toBe(direccionDeLaEntidad(ENTIDAD));
    // Y la ayuda dice de dónde sale, para que nadie la busque en otro sitio.
    expect(campo.baseLegal).toContain("Datos de la entidad");
  });
});
