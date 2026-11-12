import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Trinquete de la migración a Tailwind: las cifras solo pueden BAJAR. Si falla por arriba, el cambio ha
// reintroducido CSS propio o estilos en línea; si falla porque has bajado algo, baja la cifra aquí para
// fijar el avance. Plan: docs/superpowers/plans/2026-11-01-migracion-tailwind-completa.md
const TOPE = {
  // Veces que un `className` usa una clase definida en algún CSS propio. Hoy ninguna: el CSS que queda es global.
  usosClasePropia: 0,
  // Ficheros .tsx que usan alguna.
  ficherosConClasePropia: 0,
  // `style={{…}}` en línea: los dinámicos (anchos %, colores de datos) son legítimos; los literales no.
  estilosEnLinea: 65,
  // Tamaño de la base global (tokens, resets de elementos, keyframes).
  lineasBaseCss: 469,
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

// Los únicos CSS de app/: `tailwind.css` (configuración), `workspace.css` (tokens y modo oscuro) y `base.css` (resets
// globales y keyframes). Un CSS de componente nuevo (`x.css` junto a `x.tsx`) es justo lo que se quiere impedir.
const PERMITIDOS = ["app/tailwind.css", "app/workspace.css", "app/base.css"];
const cssTodos = ficheros("app", [".css"]);
const cssPropio = cssTodos.filter((r) => r !== "app/tailwind.css" && r !== "app/workspace.css");
const propias = new Set(cssPropio.flatMap((r) => [...leer(r).replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1])));
const tsx = ficheros("app", [".tsx"]);

describe("migración a Tailwind: el trinquete solo baja", () => {
  it("no hay CSS de componente: solo tailwind.css, workspace.css y base.css", () => {
    expect(cssTodos.filter((r) => !PERMITIDOS.includes(r)), "los estilos de un componente van en utilidades, no en un .css").toEqual([]);
    expect(existsSync(join(RAIZ, "app/styles.css"))).toBe(false);
  });

  it("usos de clase propia en className", () => {
    let usos = 0;
    const conClase = new Set<string>();
    for (const ruta of tsx) {
      for (const m of leer(ruta).matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g)) {
        const s = (m[1] ?? m[2] ?? m[3] ?? "").replace(/\$\{[^}]*\}/g, " ");
        for (const t of s.split(/\s+/)) if (t && propias.has(t) && !/[:[/]/.test(t)) { usos++; conClase.add(ruta); }
      }
    }
    expect(usos, "usa utilidades de Tailwind y los tokens").toBeLessThanOrEqual(TOPE.usosClasePropia);
    expect(conClase.size).toBeLessThanOrEqual(TOPE.ficherosConClasePropia);
  });

  it("estilos en línea", () => {
    const n = tsx.reduce((a, r) => a + (leer(r).match(/style=\{\{/g)?.length ?? 0), 0);
    expect(n, "los literales (padding, display, colores) van a utilidades; solo los dinámicos se quedan").toBeLessThanOrEqual(TOPE.estilosEnLinea);
  });

  it("tamaño de la base global", () => {
    expect(leer("app/base.css").split("\n").length).toBeLessThanOrEqual(TOPE.lineasBaseCss);
  });

  // Las utilidades migradas usan variantes propias (`legado:`, `fuera-tw:`…). Si alguien borra su `@custom-variant` de
  // tailwind.css, Tailwind no avisa: descarta en silencio todas las utilidades con esa variante y la app pierde los estilos.
  it("toda variante propia que usan los estilos está declarada en tailwind.css", () => {
    const declaradas = new Set([...leer("app/tailwind.css").matchAll(/@custom-variant\s+([\w-]+)/g)].map((m) => m[1]));
    const usadas = new Set<string>();
    for (const r of ficheros("app", [".ts", ".tsx"])) {
      for (const m of leer(r).matchAll(/(?:^|[\s"'`:])(legado|fuera-tw(?:-boton|-texto)?):/g)) usadas.add(m[1]);
    }
    expect(usadas.size, "los estilos migrados usan legado: y fuera-tw*:").toBeGreaterThan(0);
    expect([...usadas].filter((v) => !declaradas.has(v))).toEqual([]);
  });
});
