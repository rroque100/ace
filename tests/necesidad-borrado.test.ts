import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { rutasPorBucket } from "@/lib/necesidad-borrado";

/**
 * Al borrar una necesidad se quedaban ficheros en el almacén.
 *
 * Las filas de `necesidad_documentos` sí desaparecen —tienen `on delete
 * cascade`—, pero el PDF no: nadie lo borra. Y los EETT/TDR viven en
 * `documents`, que NO tiene clave foránea a `necesidades` (el vínculo es
 * `metadata->>necesidadId`, JSON puro), así que ahí se quedaban también las
 * filas.
 *
 * Comprobado con datos reales antes de escribir esto: un PDF de 1 646 703 bytes
 * en `necesidades/1b577471-…/`, de una necesidad borrada el 22 de julio, sin
 * ninguna fila apuntándole.
 */
describe("rutas que hay que borrar del almacén", () => {
  it("agrupa por bucket, porque el borrado se pide por bucket", () => {
    const r = rutasPorBucket([
      { storage_bucket: "documents", storage_path: "necesidades/a/uno.pdf" },
      { storage_bucket: "documents", storage_path: "necesidades/a/dos.pdf" },
      { storage_bucket: "otro", storage_path: "x/tres.pdf" },
    ]);
    expect(r.get("documents")).toEqual(["necesidades/a/uno.pdf", "necesidades/a/dos.pdf"]);
    expect(r.get("otro")).toEqual(["x/tres.pdf"]);
  });

  it("descarta filas sin ruta o sin bucket en vez de romper", () => {
    // Un documento a medio subir puede no tener ruta. Que eso impida borrar la
    // necesidad entera sería peor que dejar un fichero.
    const r = rutasPorBucket([
      { storage_bucket: "documents", storage_path: null },
      { storage_bucket: null, storage_path: "huerfano.pdf" },
      { storage_bucket: "documents", storage_path: "   " },
      { storage_bucket: "documents", storage_path: "vale.pdf" },
    ]);
    expect(r.get("documents")).toEqual(["vale.pdf"]);
    expect(r.size).toBe(1);
  });

  it("no repite una ruta aunque venga dos veces", () => {
    // El mismo fichero puede estar referenciado por el adjunto y por el EETT/TDR.
    const r = rutasPorBucket([
      { storage_bucket: "documents", storage_path: "a.pdf" },
      { storage_bucket: "documents", storage_path: "a.pdf" },
    ]);
    expect(r.get("documents")).toEqual(["a.pdf"]);
  });

  it("sin documentos no devuelve buckets", () => {
    expect(rutasPorBucket([]).size).toBe(0);
  });
});

describe("los tres borrados limpian el almacén", () => {
  // El suite no levanta el servidor, así que se vigila el fuente: lo que se
  // rompió fue que la ruta NO llamaba a la limpieza, y eso se ve leyendo.
  const rutas = {
    "borrado de la necesidad": "app/api/necesidades/[id]/route.ts",
    "borrado de un adjunto": "app/api/necesidades/[id]/documentos/route.ts",
    "borrado de un EETT/TDR": "app/api/necesidades/[id]/eett-tdr/route.ts",
  };

  for (const [nombre, ruta] of Object.entries(rutas)) {
    it(`el ${nombre} borra los ficheros`, () => {
      // Se cuenta la LLAMADA, no la mención: con `toContain("borrarFicherosDe")`
      // la prueba seguía verde al quitar la llamada, porque el import bastaba
      // para satisfacerla. Se comprobó quitándola a mano.
      const llamadas = readFileSync(ruta, "utf-8")
        .split("\n")
        .filter((l) => !l.trimStart().startsWith("import"))
        .filter((l) => /borrarFicherosDe\(/.test(l));
      expect(llamadas.length, `${ruta} borra la fila pero deja el PDF`).toBeGreaterThan(0);
    });
  }
});
