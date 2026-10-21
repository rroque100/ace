import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { objetosEfectivosDe } from "@/lib/necesidad-ficha-secciones";

/**
 * Los DOS campos que deciden qué ficha se pinta —tipo de proceso y tipo de
 * objeto— estaban recalculados en cuatro sitios del componente de detalle, y no
 * coincidían: unos cruzaban el proceso del borrador con el objeto GUARDADO y
 * otros tomaban los dos del borrador. Al cambiar el tipo de objeto sin guardar,
 * la misma pantalla marcaba unos campos como obligatorios según el objeto viejo
 * y otros según el nuevo.
 *
 * Estas pruebas no comprueban el render —el suite es de Node y no monta React—
 * sino que la definición siga siendo ÚNICA. Es lo que se rompió, y es lo que se
 * puede vigilar leyendo el fuente.
 */
const FUENTE = readFileSync("app/components/necesidad-detail.tsx", "utf-8");

describe("los ejes de la ficha se definen una sola vez", () => {
  it("el respaldo al proceso guardado aparece solo en el eje", () => {
    const veces = FUENTE.match(/\?\? necesidad\?\.tipo_proceso_seleccion \?\?/g) ?? [];
    expect(veces.length, "reintroducido fuera de `ejeProceso`").toBe(1);
  });

  it("el respaldo al objeto guardado aparece solo en el eje", () => {
    const veces = FUENTE.match(/\?\? necesidad\?\.tipo_objeto \?\?/g) ?? [];
    expect(veces.length, "reintroducido fuera de `ejeObjeto`").toBe(1);
  });

  it("los objetos efectivos se derivan una sola vez del eje", () => {
    // La otra llamada legítima recibe el proceso por PARÁMETRO
    // (`camposObjetivoDelProceso`), que es un caso distinto: se le pide la
    // lista para un proceso concreto, no para el que hay en pantalla.
    const desdeEje = FUENTE.match(/objetosEfectivosDe\(ejeProceso/g) ?? [];
    expect(desdeEje.length).toBe(1);
  });
});

describe("por qué importa cuál de los dos objetos se usa", () => {
  it("el objeto cambia los objetos efectivos, no es un detalle", () => {
    // Si daba igual, la incoherencia no habría tenido consecuencias. Da igual
    // solo cuando el procedimiento acota los objetos por sí mismo.
    const sinProceso = objetosEfectivosDe("", "bienes");
    expect(sinProceso).toEqual(["bienes"]);
    expect(objetosEfectivosDe("", "obras")).toEqual(["obras"]);
    expect(objetosEfectivosDe("", "obras")).not.toEqual(sinProceso);
  });

  it("sin objeto no hay objetos efectivos que acoten nada", () => {
    expect(objetosEfectivosDe("", undefined)).toEqual([]);
  });
});
