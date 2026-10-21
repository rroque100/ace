import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * El autoguardado se tragaba el motivo del fallo.
 *
 * La ruta `PATCH /api/necesidades/[id]` responde a un 400 diciendo QUÉ campo
 * falla y por qué —se mejoró justo para eso, porque con setenta campos un
 * «Solicitud inválida» a secas deja al usuario sin nada que hacer salvo
 * adivinar—. El autoguardado descartaba esa respuesta y solo mostraba «No se
 * pudo autoguardar».
 *
 * Ocurrió dos veces en el mismo día: la primera con «Cómputo del plazo», y la
 * segunda quedó sin diagnosticar precisamente porque el mensaje no llegaba.
 *
 * La distinción importa: si el servidor DIJO por qué, no se arregla solo y va a
 * fallar en cada tecla. Un fallo de red es pasajero, y anunciarlo mientras se
 * escribe sería ruido.
 *
 * Ocurrió una TERCERA vez, y por afinar de más: el mensaje solo se enseñaba en
 * el 400. Cuando la base no tiene una columna que la ficha ya envía —una
 * migración sin correr— la ruta responde 500 con el nombre exacto de la
 * columna, y ese 500 se callaba por «pasajero». No lo era. Ahora se enseña
 * cualquier respuesta que traiga motivo, sea cual sea el código.
 */
const FUENTE = readFileSync("app/components/necesidad/usar-ficha-form.ts", "utf-8");

function cuerpoDe(nombre: string): string {
  const i = FUENTE.indexOf(nombre);
  expect(i, `no se encontró ${nombre}`).toBeGreaterThan(-1);
  return FUENTE.slice(i, FUENTE.indexOf("\n  }", i));
}

describe("el autoguardado dice por qué falló", () => {
  const cuerpo = cuerpoDe("async function autoguardarFicha");

  it("enseña el motivo venga con el código que venga", () => {
    // `onError` es lo que pinta el aviso de la página. Sin esta llamada, el
    // usuario no puede saber qué corregir.
    const iFallo = cuerpo.indexOf("if (!response.ok)");
    expect(iFallo).toBeGreaterThan(-1);
    const tramo = cuerpo.slice(iFallo, cuerpo.indexOf("return;", iFallo));
    expect(tramo).toContain("detalle?.error");
    expect(tramo).toContain("onError(detalle.error)");
  });

  it("y ya NO lo limita al 400", () => {
    // Limitarlo al 400 dejó sin diagnosticar un 500 que decía exactamente qué
    // columna faltaba. El conflicto de versión (409) se atiende antes, aparte.
    const iFallo = cuerpo.indexOf("if (!response.ok)");
    expect(cuerpo.slice(iFallo)).not.toContain("response.status === 400");
    expect(cuerpo).toContain("response.status === 409");
  });

  it("los fallos de red siguen callados: son pasajeros", () => {
    // El catch del final no debe anunciar nada: dispara mientras se teclea.
    const catchFinal = cuerpo.slice(cuerpo.lastIndexOf("} catch"));
    expect(catchFinal).not.toContain("onError");
  });
});

describe("el guardado explícito ya lo decía", () => {
  it("sigue mostrando el motivo", () => {
    // No se toca: es la referencia de la que se copia el comportamiento.
    const cuerpo = cuerpoDe("async function saveFicha");
    expect(cuerpo).toContain("onError(data.error");
  });
});
