import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BLOQUES_FICHA,
  MODO_POR_DEFECTO,
  modoParaSeccion,
  panelesDelModo,
} from "@/lib/necesidad-modos";

describe("reparto de bloques por modo", () => {
  it("ningun bloque queda huerfano", () => {
    // Un bloque sin modo no se ve NUNCA, y el usuario concluye que desaparecio.
    for (const b of BLOQUES_FICHA) {
      expect(b.modos.length, b.id).toBeGreaterThan(0);
    }
  });

  it("los dos modos tienen contenido", () => {
    expect(panelesDelModo("redactar").length).toBeGreaterThan(0);
    expect(panelesDelModo("revisar").length).toBeGreaterThan(0);
  });

  it("el flujo, la ficha y la derivacion viven en los dos modos", () => {
    // Quien revisa necesita leer lo que juzga sin cambiar de modo; y la
    // derivacion —«Abrir expediente» sobre todo— debe llegarse desde «Redactar»
    // (modo por defecto) sin descubrir el interruptor de modo.
    for (const id of ["sec-flujo", "sec-ficha", "sec-derivacion"]) {
      expect(modoParaSeccion(id), id).toBe(null);
      expect(panelesDelModo("redactar"), id).toContain(id);
      expect(panelesDelModo("revisar"), id).toContain(id);
    }
  });

  it("cada modo tiene bloques que le son propios", () => {
    // Si todo estuviera en ambos, el interruptor no separaria nada.
    expect(modoParaSeccion("sec-adjuntos")).toBe("redactar");
    expect(modoParaSeccion("sec-admisibilidad")).toBe("revisar");
  });

  it("un id desconocido devuelve null en vez de lanzar", () => {
    expect(modoParaSeccion("sec-inventado")).toBe(null);
  });

  it("no hay ids repetidos en el catalogo", () => {
    const ids = BLOQUES_FICHA.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("el modo por defecto es redactar", () => {
    expect(MODO_POR_DEFECTO).toBe("redactar");
  });
});

describe("el catalogo no se queda atras del componente", () => {
  // Se miran el detalle Y los paneles extraidos. Cuando la matriz de riesgos
  // salio a su propio fichero esta prueba fallo —hizo su trabajo—, y la leccion
  // es que el guardian no puede vigilar UN fichero: los bloques ya viven en
  // varios y seguiran repartiendose.
  const fuente = [
    readFileSync("app/components/necesidad-detail.tsx", "utf-8"),
    ...readdirSync("app/components/necesidad")
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => readFileSync(`app/components/necesidad/${f}`, "utf-8")),
  ].join("\n");
  const enElDom = [...new Set([...fuente.matchAll(/id="(sec-[a-z]+)"/g)].map((m) => m[1]))];

  it("todo sec-* del componente esta en el catalogo", () => {
    // Anadir un bloque y olvidar su modo debe fallar aqui, no en produccion.
    const catalogados = new Set<string>(BLOQUES_FICHA.map((b) => b.id));
    expect(enElDom.filter((id) => !catalogados.has(id))).toEqual([]);
  });

  it("todo bloque del catalogo existe en el componente", () => {
    const presentes = new Set(enElDom);
    expect(BLOQUES_FICHA.map((b) => b.id).filter((id) => !presentes.has(id))).toEqual([]);
  });
});
