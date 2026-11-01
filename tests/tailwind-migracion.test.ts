import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Trinquete de la migración a Tailwind: las cifras solo pueden BAJAR. Si falla por arriba, el cambio ha
// reintroducido CSS propio o estilos en línea; si falla porque has bajado algo, baja la cifra aquí para
// fijar el avance. Plan: docs/superpowers/plans/2026-11-01-migracion-tailwind-completa.md
const TOPE = {
  // Veces que un `className` usa una clase definida en app/styles.css.
  usosClasePropia: 1434,
  // Ficheros .tsx que usan alguna.
  ficherosConClasePropia: 110,
  // `style={{…}}` en línea: los dinámicos (anchos %, colores de datos) son legítimos; los literales no.
  estilosEnLinea: 372,
  // Tamaño de la hoja heredada.
  lineasStylesCss: 9048,
};

const RAIZ = process.cwd();
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), "utf-8");
function ficheros(dir: string, ext: string[]): string[] {
  return readdirSync(join(RAIZ, dir)).flatMap((n) => {
    const r = `${dir}/${n}`;
    if (statSync(join(RAIZ, r)).isDirectory()) return ficheros(r, ext);
    return ext.some((e) => n.endsWith(e)) ? [r] : [];
  });
}

const propias = new Set([...leer("app/styles.css").replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]));
const tsx = ficheros("app", [".tsx"]);

describe("migración a Tailwind: el trinquete solo baja", () => {
  it("usos de clase propia en className", () => {
    let usos = 0;
    const conClase = new Set<string>();
    for (const ruta of tsx) {
      for (const m of leer(ruta).matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g)) {
        const s = (m[1] ?? m[2] ?? m[3] ?? "").replace(/\$\{[^}]*\}/g, " ");
        for (const t of s.split(/\s+/)) if (t && propias.has(t) && !/[:[/]/.test(t)) { usos++; conClase.add(ruta); }
      }
    }
    expect(usos, "usa utilidades de Tailwind y la tabla de equivalencias del plan").toBeLessThanOrEqual(TOPE.usosClasePropia);
    expect(conClase.size).toBeLessThanOrEqual(TOPE.ficherosConClasePropia);
  });

  it("estilos en línea", () => {
    const n = tsx.reduce((a, r) => a + (leer(r).match(/style=\{\{/g)?.length ?? 0), 0);
    expect(n, "los literales (padding, display, colores) van a utilidades; solo los dinámicos se quedan").toBeLessThanOrEqual(TOPE.estilosEnLinea);
  });

  it("tamaño de styles.css", () => {
    expect(leer("app/styles.css").split("\n").length).toBeLessThanOrEqual(TOPE.lineasStylesCss);
  });
});
