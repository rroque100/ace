import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guarda de la paleta. Tiene dos partes:
//
//  1. Los TOKENS de `app/workspace.css` (claro y oscuro) cumplen contraste WCAG. Antes había un placeholder a 2,6:1,
//     textos de estado sobre su fondo tintado por debajo de 4,5:1 y bordes de campo casi invisibles; ningún test
//     lo vio porque nadie calculaba el contraste.
//  2. Un CONTADOR que solo puede bajar: colores escritos a mano (clases de la paleta por defecto de Tailwind,
//     blancos y hex fijos) que no cambian con el tema. Cada color a mano es un hueco en modo oscuro: `bg-white`
//     dejó el chat y los botones secundarios blancos sobre un fondo oscuro. Si este test falla por arriba, usa
//     un token (`bg-panel`, `text-muted`, `bg-warning-soft`, `border-line-strong`…); si baja, BAJA la cifra aquí.

const RAIZ = process.cwd();
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), "utf-8");

function ficheros(dir: string, extensiones: string[]): string[] {
  return readdirSync(join(RAIZ, dir)).flatMap((nombre) => {
    const ruta = `${dir}/${nombre}`;
    if (statSync(join(RAIZ, ruta)).isDirectory()) return ficheros(ruta, extensiones);
    return extensiones.some((e) => nombre.endsWith(e)) ? [ruta] : [];
  });
}

// ── Tokens ──────────────────────────────────────────────────────────────────────────────────────────────

/** Bloque de declaraciones de la primera regla cuyo selector es exactamente `selector`. */
function bloque(css: string, selector: string): string {
  const inicio = css.indexOf(`${selector} {`);
  if (inicio < 0) throw new Error(`No hay regla ${selector} en workspace.css`);
  return css.slice(css.indexOf("{", inicio) + 1, css.indexOf("\n}", inicio));
}

function tokens(css: string): Record<string, string> {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return Object.fromEntries([...sinComentarios.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const workspace = leer("app/workspace.css");
const CLARO = tokens(bloque(workspace, ":root"));
// El oscuro solo redefine lo que cambia: lo demás se hereda del claro.
const OSCURO = { ...CLARO, ...tokens(bloque(workspace, ':root[data-theme="dark"]')) };

type Rgb = [number, number, number];
const aRgb = (hex: string): Rgb => {
  const h = hex.replace("#", "");
  const c = h.length === 3 ? [...h].map((x) => x + x).join("") : h;
  return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)) as Rgb;
};
const luminancia = ([r, g, b]: Rgb) => {
  const [R, G, B] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};
const contraste = (a: Rgb, b: Rgb) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const mezcla = (color: Rgb, porcentaje: number, base: Rgb): Rgb =>
  color.map((v, i) => v * porcentaje + base[i] * (1 - porcentaje)) as Rgb;

const TEMAS = { claro: CLARO, oscuro: OSCURO } as const;
const color = (tema: Record<string, string>, nombre: string): Rgb => {
  const valor = tema[nombre];
  if (!valor || !/^#[0-9a-f]{3,6}$/i.test(valor)) throw new Error(`${nombre} no es un hex en workspace.css: ${valor}`);
  return aRgb(valor);
};

// Porcentajes con los que workspace.css tinta cada estado sobre --surface (deben coincidir con los *-soft).
const TINTES: Record<string, number> = { danger: 11, warning: 14, success: 13, info: 12, accent: 12 };

describe("paleta: tokens de workspace.css", () => {
  it("el oscuro redefine los mismos tokens de color que el claro", () => {
    const hex = (t: Record<string, string>) => Object.keys(t).filter((k) => /^#[0-9a-f]{3,8}$/i.test(t[k]));
    const dark = tokens(bloque(workspace, ':root[data-theme="dark"]'));
    const faltan = hex(CLARO).filter((k) => !(k in dark));
    expect(faltan, `tokens claros sin versión oscura: ${faltan.join(", ")}`).toEqual([]);
  });

  it("los tintes de estado de workspace.css usan los porcentajes que asume este test", () => {
    for (const [estado, pct] of Object.entries(TINTES)) {
      expect(CLARO[`--${estado}-soft`], estado).toContain(`var(--${estado}) ${pct}%`);
    }
  });

  for (const [nombreTema, tema] of Object.entries(TEMAS)) {
    describe(nombreTema, () => {
      const fondos = ["--bg", "--surface", "--panel"];

      it("texto principal y secundario: ≥ 4,5:1 sobre cada fondo", () => {
        for (const texto of ["--ink", "--muted"]) {
          for (const fondo of fondos) {
            expect(contraste(color(tema, texto), color(tema, fondo)), `${texto} sobre ${fondo}`).toBeGreaterThanOrEqual(4.5);
          }
        }
      });

      it("placeholder: ≥ 4,5:1 sobre los fondos donde aparece un campo", () => {
        for (const fondo of [...fondos, "--soft"]) {
          expect(contraste(color(tema, "--placeholder"), color(tema, fondo)), `placeholder sobre ${fondo}`).toBeGreaterThanOrEqual(4.5);
        }
      });

      it("marca y estados: ≥ 4,5:1 como texto sobre el panel", () => {
        for (const estado of ["--brand", "--danger", "--success", "--warning", "--info", "--accent"]) {
          expect(contraste(color(tema, estado), color(tema, "--panel")), `${estado} sobre panel`).toBeGreaterThanOrEqual(4.5);
        }
      });

      it("estados: ≥ 4,5:1 sobre su propio fondo tintado (*-soft)", () => {
        for (const [estado, pct] of Object.entries(TINTES)) {
          const fondo = mezcla(color(tema, `--${estado}`), pct / 100, color(tema, "--surface"));
          expect(contraste(color(tema, `--${estado}`), fondo), `${estado} sobre ${estado}-soft`).toBeGreaterThanOrEqual(4.5);
        }
      });

      it("texto sobre el botón de marca: ≥ 4,5:1", () => {
        expect(contraste(color(tema, "--on-brand"), color(tema, "--brand"))).toBeGreaterThanOrEqual(4.5);
      });

      it("borde de campos (--line-strong): ≥ 3:1 contra el panel y el fondo (WCAG 1.4.11)", () => {
        for (const fondo of ["--panel", "--bg"]) {
          expect(contraste(color(tema, "--line-strong"), color(tema, fondo)), `line-strong sobre ${fondo}`).toBeGreaterThanOrEqual(3);
        }
      });
    });
  }
});

// ── Colores a mano: el contador solo puede bajar ────────────────────────────────────────────────────────

// Cifras de partida tras migrar a tokens. Bajarlas al limpiar más; NUNCA subirlas.
const TOPE = {
  // slate/teal/amber/red… y `bg-white` (sin transparencia) en TSX y CSS con @apply. `text-white` y `white/NN` se
  // permiten: van sobre fondos de marca u oscuros fijos (sidebar, héroes), donde el blanco es lo correcto.
  clasesDePaletaPorDefecto: 35,
  // Literales #rrggbb en componentes: no cambian con el tema ni con los ajustes de los tokens.
  hexEnComponentes: 434,
  // `background: #fff` / `white` en cualquier CSS de app/: quedan el papel de la hoja de informe y el módulo de expedientes (paleta propia). Un botón con `background: white` dejó «Anterior/Siguiente» ilegibles en oscuro.
  blancosFijosEnCss: 3,
  // `background: #rrggbb` (cualquier tono) en styles.css.
  fondosHexEnStylesCss: 13,
};

const CLASE_PALETA =
  /(?<![\w-])(?:[a-z-]+:)*(?:text|bg|border|ring|fill|stroke|divide|outline|from|to|via|decoration|accent|caret|shadow)-(?:slate|gray|zinc|neutral|stone|teal|emerald|green|red|rose|amber|yellow|orange|blue|sky|indigo|violet|purple)-\d{2,3}(?:\/\d+)?(?![\w-])/g;
const BG_WHITE = /(?<![\w-])(?:[a-z-]+:)*bg-white(?![\w/-])/g;
const HEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;

const fuentes = [...ficheros("app", [".tsx", ".ts"]), ...ficheros("app", [".css"])];
const cuenta = (re: RegExp, rutas: string[]) => rutas.reduce((n, r) => n + (leer(r).match(re)?.length ?? 0), 0);

describe("paleta: colores escritos a mano", () => {
  it("las clases de la paleta por defecto (slate, teal, bg-white…) no crecen", () => {
    const total = cuenta(CLASE_PALETA, fuentes) + cuenta(BG_WHITE, fuentes);
    expect(total, "usa tokens: text-muted, bg-panel, bg-brand-soft, border-line…").toBeLessThanOrEqual(TOPE.clasesDePaletaPorDefecto);
  });

  it("los hex literales en componentes no crecen", () => {
    expect(cuenta(HEX, ficheros("app", [".tsx", ".ts"]))).toBeLessThanOrEqual(TOPE.hexEnComponentes);
  });

  it("los CSS no vuelven a fijar fondos blancos, y styles.css tampoco fondos hex", () => {
    const css = leer("app/styles.css");
    const blancos = ficheros("app", [".css"]).reduce((n, r) => n + (leer(r).match(/background(?:-color)?: ?(?:#fff(?:fff)?|white)\b/g) ?? []).length, 0);
    const fondos = (css.match(/^\s*background(?:-color)?: *#[0-9a-fA-F]{3,6};/gm) ?? []).length;
    expect(blancos).toBeLessThanOrEqual(TOPE.blancosFijosEnCss);
    expect(fondos).toBeLessThanOrEqual(TOPE.fondosHexEnStylesCss);
  });

  it("los controles de formulario usan border-line-strong, no el borde decorativo", () => {
    // Un campo con border-line (1,3:1) no se distingue del panel; solo los separadores usan --line.
    const campos = ["app/components/configuracion/ui.ts", "app/components/ui/field.tsx", "app/components/necesidad/ficha-estilos.ts"];
    for (const ruta of campos) {
      const lineas = leer(ruta).split("\n").filter((l) => /placeholder:text-placeholder/.test(l));
      expect(lineas.length, ruta).toBeGreaterThan(0);
      for (const l of lineas) expect(l, `${ruta}: ${l.trim().slice(0, 80)}`).not.toMatch(/border-line(?![\w-])/);
    }
  });
});
