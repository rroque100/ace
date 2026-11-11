import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Un `\b` de una expresión regular escrito a través de la consola (bash, un heredoc, `node -e` con comillas) llega al fichero como
// el carácter de retroceso U+0008 y la expresión deja de funcionar SIN ningún error: en lib/legal-chat.ts, `/\breglamento\b/`
// quedó como «retroceso + reglamento + retroceso» y nunca coincidía, así que una pregunta que nombraba el Reglamento no activaba
// por sí sola la búsqueda dirigida a él. Ningún código fuente necesita un retroceso literal: si aparece, es esa avería.
// (Otros caracteres de control sí se usan a propósito, como el separador U+0001 de lib/requisitos-calificacion.ts.)

const RAICES = ["lib", "app", "scripts", "tests"];
const EXTENSIONES = /\.(?:ts|tsx|mts|mjs|js|cjs)$/;

function ficheros(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (nombre === "node_modules" || nombre.startsWith(".")) return [];
    return statSync(ruta).isDirectory() ? ficheros(ruta) : EXTENSIONES.test(nombre) ? [ruta] : [];
  });
}

describe("código fuente sin retrocesos literales", () => {
  it("ningún fichero contiene U+0008 (un `\\b` que se rompió al pasar por la consola)", () => {
    const rotos = RAICES.flatMap(ficheros).flatMap((ruta) =>
      readFileSync(ruta, "utf8").split(/\r?\n/).flatMap((linea, i) => (linea.includes("\u0008") ? [`${ruta}:${i + 1}`] : [])),
    );
    expect(rotos).toEqual([]);
  });
});
