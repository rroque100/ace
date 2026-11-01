// Lista, ordenadas, las clases que el último `npm run build` dejó en el CSS final.
// Uso:  node scripts/utilidades-css.mjs salida.txt
//
// Sirve para comprobar que un cambio de configuración de Tailwind (por ejemplo, quitar las líneas `@source`)
// no hace desaparecer ninguna utilidad: se guarda la lista antes, se reconstruye y se comparan con `diff`.
// Lee los selectores con sus escapes (`md\:flex`, `bg-\[\#fff\]`), que con un `grep` simple se cortan.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = ".next/static/chunks";
const salida = process.argv[2];
if (!salida) {
  console.error("Falta el fichero de salida: node scripts/utilidades-css.mjs salida.txt");
  process.exit(1);
}

const css = readdirSync(DIR)
  .filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(join(DIR, f), "utf-8"))
  .join("\n");

const clases = new Set([...css.matchAll(/\.((?:\\.|[A-Za-z0-9_-])+)/g)].map((m) => m[1]));
// Los números de versión y de fuente (`.0bjc5…woff2`, `1.5`) no son clases: solo se guardan las que empiezan por letra o `\`.
const lista = [...clases].filter((c) => /^[A-Za-z\\_-]/.test(c)).sort();
writeFileSync(salida, lista.join("\n") + "\n");
console.log(`${lista.length} clases → ${salida}`);
