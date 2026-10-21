import { describe, expect, it } from "vitest";
import { limpiarPropuestaSimilares, promptServiciosSimilares } from "@/lib/servicios-similares";

/**
 * «Servicios similares al objeto convocado» es un juicio abierto, no un dato
 * exacto: por eso lo propone el modelo en vez de copiarse de un campo. Aquí se
 * prueba lo determinista —el prompt y el saneado de la respuesta—; la llamada al
 * modelo vive en la ruta y no se toca en el suite.
 */
describe("el prompt se arma con lo que la necesidad registró", () => {
  const p = promptServiciosSimilares({
    nombre: "Contratación del servicio de mantenimiento de áreas verdes",
    descripcion: "Mantenimiento y jardinería",
    tipoObjeto: "servicios",
  });

  it("dice el objeto y su descripción al modelo", () => {
    expect(p.user).toContain("Contratación del servicio de mantenimiento de áreas verdes");
    expect(p.user).toContain("Mantenimiento y jardinería");
  });

  it("la palabra del objeto sigue al tipo de la contratación", () => {
    expect(p.system).toContain("qué servicios se consideran iguales o similares");
    const obras = promptServiciosSimilares({ nombre: "x", tipoObjeto: "obras" });
    expect(obras.system).toContain("qué obras se consideran");
  });

  it("le pide enumeración limpia y sin el proyecto de inversión", () => {
    expect(p.system).toContain("SIN el nombre del proyecto de inversión");
    expect(p.system).toContain("Sin preámbulo");
  });

  it("con el objeto sin registrar no rompe el prompt", () => {
    const vacio = promptServiciosSimilares({});
    expect(vacio.user).toContain("(sin registrar)");
  });
});

describe("la respuesta del modelo se sanea para encajar en la frase", () => {
  it("quita viñetas y comillas de cada renglón y junta en una frase", () => {
    const crudo = '- "Instalación de coberturas metálicas"\n- Montaje de estructuras de acero.\n';
    expect(limpiarPropuestaSimilares(crudo)).toBe(
      "Instalación de coberturas metálicas, Montaje de estructuras de acero",
    );
  });

  it("retira el punto final —lo pone la plantilla— y las comillas envolventes", () => {
    expect(limpiarPropuestaSimilares('«jardinería y afines».')).toBe("jardinería y afines");
  });

  it("vacío devuelve vacío, para que el apartado conserve su corchete", () => {
    expect(limpiarPropuestaSimilares("")).toBe("");
    expect(limpiarPropuestaSimilares(null)).toBe("");
    expect(limpiarPropuestaSimilares("   \n  ")).toBe("");
  });

  it("capa al tope para no reventar el campo", () => {
    expect(limpiarPropuestaSimilares("a".repeat(3000), 2000).length).toBe(2000);
  });
});
