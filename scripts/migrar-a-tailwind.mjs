// Migra un componente de clases CSS propias a utilidades de Tailwind, leyendo las reglas REALES del CSS.
//
// Uso:
//   node scripts/migrar-a-tailwind.mjs app/components/x.tsx            → informe (no escribe nada)
//   node scripts/migrar-a-tailwind.mjs app/components/x.tsx --aplicar  → escribe x-estilos.ts y reescribe x.tsx
//
// Qué hace, para cada clase propia que SOLO usa ese componente (las compartidas se dejan: las usan otros):
//   1. Reúne todas las reglas de app/**/*.css que la nombran (la propia, sus descendientes `.x summary`,
//      `.x > button`, sus estados `:hover`, `[open]`, `:has(…)`, lo que va dentro de `@media`, y los `@apply` de
//      los CSS de compatibilidad).
//   2. Resuelve la cascada (especificidad y orden) para que quede una sola declaración por propiedad y condición.
//   3. Traduce cada declaración a su utilidad (`display:flex` → `flex`, `gap:14px` → `gap-3.5`, `color:var(--muted)`
//      → `text-muted`) y a una propiedad arbitraria (`[overflow-wrap:anywhere]`) cuando no hay equivalente.
//      Los colores fijos (hex) se sustituyen por el token más cercano: es lo que arregla el modo oscuro.
//   4. Escribe `<componente>-estilos.ts` con una cadena por clase (mismo patrón que `ficha-estilos.ts`) y cambia
//      cada `className="x"` por `className={S.x}`.
//
// El DOM no cambia, así que el resultado se comprueba con docs/qa/estilos-computados.js. Lo que la herramienta no
// sabe traducir se imprime como «MANUAL» y no se toca.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, basename, dirname } from "node:path";

const RAIZ = process.cwd();
const args = process.argv.slice(2);
const fichero = args.find((a) => !a.startsWith("--"));
const aplicar = args.includes("--aplicar");
const extraClases = (args.find((a) => a.startsWith("--clases="))?.slice(9) ?? "").split(",").filter(Boolean);
const excluirClases = (args.find((a) => a.startsWith("--excluir="))?.slice(10) ?? "").split(",").filter(Boolean);
// Clases cuyas utilidades deben ir con `!`: mientras convivan, una regla SIN capa de los CSS de compatibilidad (por
// ejemplo `.legalWorkspace .secondaryButton`) gana a las utilidades, que están en una capa. Se marcan a mano tras ver en
// la comparación de estilos qué clase pierde frente a una de esas reglas.
// Formato: `--importante=clase` (todas sus utilidades) o `--importante=clase=utilidad` (solo esa; las utilidades llevan
// `:` por las variantes, de ahí el segundo `=`). Se pueden separar varios con `;`.
const importantes = new Map(
  (args.find((a) => a.startsWith("--importante=")) ?? "")
    .slice(13)
    .split(";")
    .filter(Boolean)
    .map((e) => {
      const i = e.indexOf("=");
      return i < 0 ? [e, null] : [e.slice(0, i), e.slice(i + 1)];
    }),
);
const marcarImportante = (clase, tokens) => {
  if (!importantes.has(clase)) return tokens;
  const solo = importantes.get(clase);
  return tokens.map((t) => (t.endsWith("!") || (solo !== null && t !== solo) ? t : t + "!"));
};
if (!fichero) {
  console.error("Falta el componente: node scripts/migrar-a-tailwind.mjs app/components/x.tsx [--aplicar]");
  process.exit(1);
}

// Contenedores que están siempre presentes donde vive el componente: su especificidad cuenta, pero no hace falta
// condicionar por ellos (las páginas del Centro Jurídico los llevan todos).
const ENVOLTORIOS = new Set(["legalWorkspace", "legalShell", "tw"]);

// ───────────────────────── lectura de CSS ─────────────────────────

function ficheros(dir, ext) {
  return readdirSync(join(RAIZ, dir)).flatMap((n) => {
    const r = `${dir}/${n}`;
    if (n === "node_modules" || n === ".next") return [];
    if (statSync(join(RAIZ, r)).isDirectory()) return ficheros(r, ext);
    return ext.some((e) => n.endsWith(e)) ? [r] : [];
  });
}

const limpiar = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));

function dividir(texto, separador) {
  const out = [];
  let prof = 0;
  let actual = "";
  let comilla = "";
  for (const ch of texto) {
    if (comilla) {
      actual += ch;
      if (ch === comilla) comilla = "";
      continue;
    }
    if (ch === '"' || ch === "'") comilla = ch;
    if ("([".includes(ch)) prof++;
    if (")]".includes(ch)) prof--;
    if (ch === separador && prof === 0) {
      out.push(actual);
      actual = "";
    } else actual += ch;
  }
  out.push(actual);
  return out.map((s) => s.trim()).filter(Boolean);
}

// Reparte `:is(a, b)` en selectores separados: `.x :is(.a, .b)` pasa a `.x .a` y `.x .b`.
function expandirIs(sel) {
  const i = sel.indexOf(":is(");
  if (i < 0) return [sel];
  let prof = 0;
  let j = i + 3;
  for (; j < sel.length; j++) {
    if (sel[j] === "(") prof++;
    else if (sel[j] === ")") {
      prof--;
      if (prof === 0) break;
    }
  }
  const interior = sel.slice(i + 4, j);
  const resto = sel.slice(j + 1);
  return dividir(interior, ",").flatMap((op) => expandirIs(sel.slice(0, i) + op + resto));
}

let ordenGlobal = 0;
function parsear(css, archivo) {
  css = limpiar(css);
  const out = [];
  const pila = [];
  let inicio = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "{") {
      pila.push({ sel: css.slice(inicio, i).trim(), cuerpo: i + 1 });
      inicio = i + 1;
    } else if (c === "}") {
      const { sel, cuerpo } = pila.pop();
      if (!sel.startsWith("@")) {
        out.push({ sel, cuerpo: css.slice(cuerpo, i), at: pila.map((p) => p.sel).filter((s) => s.startsWith("@")), archivo, orden: ordenGlobal++ });
      }
      inicio = i + 1;
    } else if (c === ";" && pila.length === 0) inicio = i + 1;
  }
  return out;
}

function declaraciones(cuerpo) {
  // El cuerpo de una regla anidada (`@media` dentro) no llega aquí: `parsear` ya lo separó.
  const sinAnidar = cuerpo;
  return dividir(sinAnidar, ";")
    .map((d) => {
      const i = d.indexOf(":");
      if (i < 0) return null;
      const prop = d.slice(0, i).trim().toLowerCase();
      let valor = d.slice(i + 1).trim();
      const imp = /!important\s*$/i.test(valor);
      valor = valor.replace(/\s*!important\s*$/i, "").trim();
      return { prop, valor, imp };
    })
    .filter(Boolean);
}

// ───────────────────────── selectores ─────────────────────────

function especificidad(sel) {
  let a = 0, b = 0, c = 0;
  const s = sel
    .replace(/\[[^\]]*\]/g, () => (b++, ""))
    .replace(/::?[\w-]+(\([^)]*\))?/g, (m) => (m.startsWith("::") ? c++ : /^:where/.test(m) ? 0 : b++, ""))
    .replace(/#[\w-]+/g, () => (a++, ""))
    .replace(/\.[\w-]+/g, () => (b++, ""))
    .replace(/[A-Za-z][\w-]*/g, () => (c++, ""));
  return a * 10000 + b * 100 + c;
}

// Parte un selector simple en compuestos y combinadores: [{ txt, comb }] donde comb es el que ENLAZA con el siguiente.
function compuestos(sel) {
  const out = [];
  let actual = "";
  let prof = 0;
  let comilla = "";
  let pendiente = "";
  const cerrar = (comb) => {
    if (actual) out.push({ txt: actual, comb: "" });
    if (out.length) out[out.length - 1].comb = comb;
    actual = "";
  };
  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i];
    if (comilla) { actual += ch; if (ch === comilla) comilla = ""; continue; }
    if (ch === '"' || ch === "'") { comilla = ch; actual += ch; continue; }
    if ("([".includes(ch)) prof++;
    if (")]".includes(ch)) prof--;
    if (prof === 0 && (ch === " " || ch === ">" || ch === "+" || ch === "~")) {
      let comb = ch === " " ? " " : ch;
      // espacios alrededor de > + ~
      while (sel[i + 1] === " ") i++;
      if (ch === " " && ">+~".includes(sel[i + 1] ?? "")) { comb = sel[i + 1]; i++; while (sel[i + 1] === " ") i++; }
      if (actual) { out.push({ txt: actual, comb }); actual = ""; }
      else if (out.length) out[out.length - 1].comb = comb;
      continue;
    }
    actual += ch;
  }
  if (actual) out.push({ txt: actual, comb: "" });
  return out;
}

const clasesDe = (txt) => [...txt.replace(/\[[^\]]*\]/g, "").matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]);

// ───────────────────────── valores → tokens ─────────────────────────

const TOKENS_VAR = {
  "--ink": "ink", "--muted": "muted", "--line": "line", "--line-strong": "line-strong", "--brand": "brand",
  "--brand-dark": "brand-dark", "--panel": "panel", "--surface": "surface", "--soft": "brand-soft", "--bg": "canvas",
  "--danger": "danger", "--success": "success", "--warning": "warning", "--info": "info", "--accent": "accent",
  "--accent-dark": "accent-dark", "--on-brand": "on-brand", "--placeholder": "placeholder",
  "--danger-soft": "danger-soft", "--warning-soft": "warning-soft", "--success-soft": "success-soft",
  "--info-soft": "info-soft", "--accent-soft": "accent-soft",
  // alias propios del Centro Jurídico (apuntan a los globales)
  "--ds-ink": "ink", "--ds-muted": "muted", "--ds-line": "line", "--ds-accent": "brand",
  "--chat-ink": "ink", "--chat-muted": "muted", "--chat-border": "line", "--chat-accent": "brand", "--chat-soft": "surface",
};

function hexARgb(h) {
  h = h.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

// Token de color más cercano al hex, según su función (texto, fondo o borde). Se razona por tono y claridad, que es
// como están pensados los tokens, en vez de por distancia RGB (que mandaría un crema al blanco).
function tokenDeHex(hex, rol) {
  const rgb = hexARgb(hex);
  const [h, s, l] = hsl(rgb);
  const estado = () => (h >= 335 || h < 20 ? "danger" : h < 70 ? "warning" : h < 150 ? "success" : h < 195 ? "brand" : h < 260 ? "info" : "accent");
  if (rol === "texto") {
    if (l > 0.92) return "on-brand";
    if (l > 0.62) return s < 0.2 ? "placeholder" : estado() === "brand" ? "brand" : estado();
    if (s < 0.2) return l < 0.3 ? "ink" : "muted";
    const e = estado();
    return e === "brand" ? (l < 0.32 ? "brand-dark" : "brand") : e;
  }
  if (rol === "borde") {
    if (s < 0.25 || (h > 150 && h < 195 && l > 0.7)) return l > 0.78 ? "line" : "line-strong";
    return `${estado()}/30`;
  }
  // fondo
  if (l > 0.97) return "panel";
  if (l > 0.86) {
    if (s < 0.12) return "surface";
    const e = estado();
    return e === "brand" ? "brand-soft" : `${e}-soft`;
  }
  if (l > 0.6 && s < 0.2) return "line";
  if (l < 0.28 && s < 0.35) return "ink";
  const e = estado();
  return l < 0.45 ? (e === "brand" ? "brand" : e) : `${e}/30`;
}

function tokenDeColor(valor, rol) {
  const v = valor.trim();
  const m = v.match(/^var\((--[\w-]+)(?:\s*,[^)]*)?\)$/);
  if (m) return TOKENS_VAR[m[1]] ?? null;
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return v.length === 9 || v.length === 5 ? null : tokenDeHex(v, rol);
  if (/^white$/i.test(v)) return rol === "texto" ? "on-brand" : "panel";
  if (/^transparent$/i.test(v)) return "transparent";
  if (/^currentcolor$/i.test(v)) return "current";
  if (/^inherit$/i.test(v)) return "inherit";
  return null;
}

// Sustituye los hex que quedan dentro de un valor compuesto (sombras, degradados) por variables de los tokens.
function sinHex(valor) {
  return valor.replace(/#[0-9a-fA-F]{3,6}\b/g, (h) => {
    const t = tokenDeHex(h, "fondo");
    const base = t.replace(/\/.*/, "");
    const map = { canvas: "bg", "brand-soft": "soft", "danger-soft": "danger-soft", panel: "panel", surface: "surface", line: "line", "line-strong": "line-strong", ink: "ink", muted: "muted", "on-brand": "on-brand" };
    return `var(--${map[base] ?? base})`;
  });
}

// ───────────────────────── declaración → utilidad ─────────────────────────

const esc = (v) => v.trim().replace(/\s+/g, "_");
const num = (v) => {
  const m = v.trim().match(/^(-?\d*\.?\d+)(px|rem)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] === "rem" ? n * 16 : n;
};

// 14px → "3.5"; solo si cabe en la escala de 0,5 (2 px); si no, arbitrario.
function esp(v) {
  const t = v.trim();
  if (t === "0" || t === "0px") return "0";
  if (t === "auto") return "auto";
  if (t === "100%") return "full";
  const n = num(t);
  if (n !== null && Math.abs(n) % 2 === 0) return String(Math.abs(n) / 4);
  return `[${esc(t)}]`;
}
const neg = (v, base) => (v.trim().startsWith("-") && !v.includes("calc") && num(v) !== null ? `-${base}` : base);

const MAPAS = {
  display: { flex: "flex", grid: "grid", block: "block", "inline-flex": "inline-flex", "inline-block": "inline-block", inline: "inline", none: "hidden", contents: "contents", "inline-grid": "inline-grid", "list-item": "list-item", table: "table" },
  position: { static: "static", relative: "relative", absolute: "absolute", fixed: "fixed", sticky: "sticky" },
  "flex-direction": { column: "flex-col", row: "flex-row", "column-reverse": "flex-col-reverse", "row-reverse": "flex-row-reverse" },
  "flex-wrap": { wrap: "flex-wrap", nowrap: "flex-nowrap", "wrap-reverse": "flex-wrap-reverse" },
  "align-items": { start: "items-start", "flex-start": "items-start", end: "items-end", "flex-end": "items-end", center: "items-center", stretch: "items-stretch", baseline: "items-baseline" },
  "align-self": { auto: "self-auto", start: "self-start", "flex-start": "self-start", end: "self-end", "flex-end": "self-end", center: "self-center", stretch: "self-stretch" },
  "justify-content": { "space-between": "justify-between", center: "justify-center", end: "justify-end", "flex-end": "justify-end", start: "justify-start", "flex-start": "justify-start", "space-around": "justify-around", "space-evenly": "justify-evenly" },
  "justify-items": { center: "justify-items-center", start: "justify-items-start", end: "justify-items-end", stretch: "justify-items-stretch" },
  "justify-self": { center: "justify-self-center", start: "justify-self-start", end: "justify-self-end", stretch: "justify-self-stretch", auto: "justify-self-auto" },
  "text-align": { left: "text-left", center: "text-center", right: "text-right", justify: "text-justify", start: "text-start", end: "text-end" },
  "text-transform": { uppercase: "uppercase", lowercase: "lowercase", capitalize: "capitalize", none: "normal-case" },
  "font-style": { italic: "italic", normal: "not-italic" },
  "white-space": { nowrap: "whitespace-nowrap", normal: "whitespace-normal", "pre-wrap": "whitespace-pre-wrap", "pre-line": "whitespace-pre-line", pre: "whitespace-pre" },
  overflow: { hidden: "overflow-hidden", auto: "overflow-auto", visible: "overflow-visible", scroll: "overflow-scroll", clip: "overflow-clip" },
  "overflow-x": { hidden: "overflow-x-hidden", auto: "overflow-x-auto", visible: "overflow-x-visible", scroll: "overflow-x-scroll", clip: "overflow-x-clip" },
  "overflow-y": { hidden: "overflow-y-hidden", auto: "overflow-y-auto", visible: "overflow-y-visible", scroll: "overflow-y-scroll", clip: "overflow-y-clip" },
  "text-overflow": { ellipsis: "text-ellipsis", clip: "text-clip" },
  cursor: { pointer: "cursor-pointer", default: "cursor-default", "not-allowed": "cursor-not-allowed", text: "cursor-text", wait: "cursor-wait", help: "cursor-help", grab: "cursor-grab", move: "cursor-move" },
  resize: { vertical: "resize-y", horizontal: "resize-x", none: "resize-none", both: "resize" },
  "text-decoration-line": { underline: "underline", none: "no-underline", "line-through": "line-through" },
  "text-decoration": { underline: "underline", none: "no-underline", "line-through": "line-through" },
  "list-style": { none: "list-none", disc: "list-disc", decimal: "list-decimal" },
  "list-style-type": { none: "list-none", disc: "list-disc", decimal: "list-decimal" },
  "pointer-events": { none: "pointer-events-none", auto: "pointer-events-auto" },
  "user-select": { none: "select-none", text: "select-text", all: "select-all" },
  visibility: { hidden: "invisible", visible: "visible" },
  "overflow-wrap": { anywhere: "wrap-anywhere", "break-word": "wrap-break-word", normal: "wrap-normal" },
  "word-break": { "break-all": "break-all", "keep-all": "break-keep", normal: "break-normal" },
  "vertical-align": { middle: "align-middle", top: "align-top", bottom: "align-bottom", baseline: "align-baseline" },
  "object-fit": { cover: "object-cover", contain: "object-contain" },
};
const PESOS = { 100: "font-thin", 300: "font-light", 400: "font-normal", 500: "font-medium", 600: "font-semibold", 700: "font-bold", 800: "font-extrabold", 900: "font-black", bold: "font-bold", normal: "font-normal" };

const generico = (prop, valor) => `[${prop}:${esc(sinHex(valor))}]`;

function tam(prefijo, valor) {
  const t = valor.trim();
  if (t === "100%") return `${prefijo}-full`;
  if (t === "0" || t === "0px") return `${prefijo}-0`;
  if (t === "auto") return `${prefijo}-auto`;
  if (t === "none") return `${prefijo}-none`;
  if (t === "fit-content") return `${prefijo}-fit`;
  if (t === "min-content") return `${prefijo}-min`;
  if (t === "max-content") return `${prefijo}-max`;
  if (t === "100vw" && /^(w|min-w|max-w)$/.test(prefijo)) return `${prefijo}-screen`;
  if (t === "100dvh" || t === "100vh") return `${prefijo}-[${t}]`;
  const n = num(t);
  if (n !== null && n > 0 && n % 4 === 0 && /^(w|h|min-w|min-h|size)$/.test(prefijo)) return `${prefijo}-${n / 4}`;
  return `${prefijo}-[${esc(t)}]`;
}

// Devuelve las clases (sin variantes) de una declaración; null = no se sabe traducir (se usa la genérica).
function utilidad(prop, valor, rol) {
  const v = valor.trim();
  const mapa = MAPAS[prop];
  if (mapa && mapa[v]) return [mapa[v]];
  switch (prop) {
    case "gap": {
      const p = v.split(/\s+/);
      return p.length === 1 ? [`gap-${esp(p[0])}`] : [`gap-y-${esp(p[0])}`, `gap-x-${esp(p[1])}`];
    }
    case "row-gap": return [`gap-y-${esp(v)}`];
    case "column-gap": return [`gap-x-${esp(v)}`];
    case "flex": return v === "1" ? ["flex-1"] : v === "none" ? ["flex-none"] : v === "auto" ? ["flex-auto"] : [generico("flex", v)];
    case "flex-shrink": return [v === "0" ? "shrink-0" : v === "1" ? "shrink" : generico(prop, v)];
    case "flex-grow": return [v === "0" ? "grow-0" : v === "1" ? "grow" : generico(prop, v)];
    case "flex-basis": return [`basis-${esp(v)}`];
    case "grid-template-columns": {
      const m = v.match(/^repeat\((\d+),\s*minmax\(0,\s*1fr\)\)$/);
      return [m ? `grid-cols-${m[1]}` : `grid-cols-[${esc(v)}]`];
    }
    case "grid-template-rows": return [`grid-rows-[${esc(v)}]`];
    case "grid-column": return [v === "1 / -1" || v === "1/-1" ? "col-span-full" : generico(prop, v)];
    case "width": return [tam("w", v)];
    case "height": return [tam("h", v)];
    case "min-width": return [tam("min-w", v)];
    case "min-height": return [tam("min-h", v)];
    case "max-width": return [tam("max-w", v)];
    case "max-height": return [tam("max-h", v)];
    case "font-size": return [`text-[${esc(v)}]`];
    case "font-weight": return [PESOS[v] ?? `font-[${v}]`];
    case "line-height": return [`leading-[${esc(v)}]`];
    case "letter-spacing": return [`tracking-[${esc(v)}]`];
    case "opacity": {
      const n = parseFloat(v);
      return [Number.isFinite(n) && Number.isInteger(n * 100) && n * 100 % 5 === 0 ? `opacity-${Math.round(n * 100)}` : `opacity-[${v}]`];
    }
    case "z-index": return [/^(0|10|20|30|40|50)$/.test(v) ? `z-${v}` : `z-[${v}]`];
    case "top": case "left": case "right": case "bottom": return [neg(v, `${prop}-${esp(v.replace(/^-/, ""))}`)];
    case "inset": return [neg(v, `inset-${esp(v.replace(/^-/, ""))}`)];
    case "color": {
      const t = tokenDeColor(v, "texto");
      return t ? [`text-${t}`] : [`text-[color:${esc(sinHex(v))}]`];
    }
    case "background-color": {
      const t = tokenDeColor(v, "fondo");
      return t ? [`bg-${t}`] : [`bg-[color:${esc(sinHex(v))}]`];
    }
    case "background": {
      const t = tokenDeColor(v, "fondo");
      if (t) return [`bg-${t}`];
      if (v === "none") return [generico("background", "none")];
      return [generico("background", v)];
    }
    case "border-radius": {
      const p = v.split(/\s+/);
      if (p.length === 1) {
        if (v === "0" || v === "0px") return ["rounded-none"];
        if (v === "999px" || v === "9999px" || v === "50%" || v === "100%") return ["rounded-full"];
        return [`rounded-[${esc(v)}]`];
      }
      return [generico(prop, v)];
    }
    case "border-top-left-radius": return [`rounded-tl-[${esc(v)}]`];
    case "border-top-right-radius": return [`rounded-tr-[${esc(v)}]`];
    case "border-bottom-left-radius": return [`rounded-bl-[${esc(v)}]`];
    case "border-bottom-right-radius": return [`rounded-br-[${esc(v)}]`];
    case "box-shadow": return [v === "none" ? "shadow-none" : `shadow-[${esc(sinHex(v))}]`];
    case "outline": return [v === "none" || v === "0" ? "outline-none" : generico(prop, v)];
    case "outline-offset": return [`outline-offset-[${esc(v)}]`];
    case "border": case "border-top": case "border-right": case "border-bottom": case "border-left": return bordeCompuesto(prop, v);
    case "border-color": case "border-top-color": case "border-right-color": case "border-bottom-color": case "border-left-color": {
      const lado = { "border-color": "", "border-top-color": "t", "border-right-color": "r", "border-bottom-color": "b", "border-left-color": "l" }[prop];
      const t = tokenDeColor(v, "borde");
      return [t ? `border${lado ? "-" + lado : ""}-${t}` : `border${lado ? "-" + lado : ""}-[${esc(sinHex(v))}]`];
    }
    case "border-width": case "border-top-width": case "border-right-width": case "border-bottom-width": case "border-left-width": {
      const lado = { "border-width": "", "border-top-width": "t", "border-right-width": "r", "border-bottom-width": "b", "border-left-width": "l" }[prop];
      const n = num(v);
      return [`border${lado ? "-" + lado : ""}${n === 1 ? "" : n === 0 ? "-0" : `-[${esc(v)}]`}`];
    }
    case "border-style": return [{ solid: "border-solid", dashed: "border-dashed", dotted: "border-dotted", none: "border-none" }[v] ?? generico(prop, v)];
    case "transition": case "animation": case "transform": case "content": case "font": case "font-family": case "text-wrap":
    case "text-shadow": case "background-image": case "background-size": case "background-position": case "backdrop-filter":
    case "filter": case "aspect-ratio": case "scroll-margin-top": case "scroll-snap-type": case "accent-color": case "caret-color": case "fill": case "stroke":
      return [generico(prop, v)];
    default:
      return [generico(prop, v)];
  }
}

function bordeCompuesto(prop, v) {
  const lado = { border: "", "border-top": "t", "border-right": "r", "border-bottom": "b", "border-left": "l" }[prop];
  const suf = lado ? `-${lado}` : "";
  if (v === "0" || v === "none" || v === "0px") return [`border${suf}-0`];
  const partes = dividir(v, " ");
  const out = [];
  let ancho = null, estilo = null, color = null;
  for (const p of partes) {
    if (/^\d*\.?\d+px$/.test(p)) ancho = p;
    else if (/^(solid|dashed|dotted|double|none)$/.test(p)) estilo = p;
    else color = p;
  }
  const n = ancho ? num(ancho) : 1;
  out.push(`border${suf}${n === 1 ? "" : n === 0 ? "-0" : `-[${ancho}]`}`);
  if (estilo && estilo !== "solid") out.push(`border-${estilo}`);
  if (color) {
    const t = tokenDeColor(color, "borde");
    out.push(t ? `border${suf}-${t}` : `border${suf}-[${esc(sinHex(color))}]`);
  }
  return out;
}

// ───────────────────────── variantes ─────────────────────────

const PSEUDO = { ":hover": "hover", ":focus": "focus", ":focus-visible": "focus-visible", ":active": "active", ":disabled": "disabled", ":checked": "checked", "[open]": "open", "::placeholder": "placeholder", "::marker": "marker", ":first-child": "first", ":last-child": "last", ":empty": "empty", ":focus-within": "focus-within", "::before": "before", "::after": "after", "[disabled]": "disabled" };

function variantesAt(at) {
  return at.map((a) => {
    const nombre = a.match(/^@([\w-]+)/)?.[1] ?? "media";
    const cond = a.replace(/^@[\w-]+\s*/, "").trim();
    if (nombre !== "media" && nombre !== "supports") return `[@${nombre}${esc(cond)}]`;
    let m;
    if ((m = cond.match(/^\(\s*max-width:\s*(\d+)px\s*\)$/))) return `max-[${m[1]}px]`;
    if ((m = cond.match(/^\(\s*min-width:\s*(\d+)px\s*\)$/))) return `min-[${m[1]}px]`;
    if (/^\(prefers-reduced-motion:\s*reduce\)$/.test(cond)) return "motion-reduce";
    if (/^print$/.test(cond)) return "print";
    return a.startsWith("@supports") ? `supports-[${esc(cond.replace(/^\(|\)$/g, ""))}]` : `[@media${esc(cond)}]`;
  });
}

// ───────────────────────── recolección y resolución ─────────────────────────

const archivosCss = [...ficheros("app", [".css"])].filter((f) => !/^app[\\/](workspace|tailwind)\.css$/.test(f));
const reglasTodas = archivosCss.flatMap((f) => parsear(readFileSync(join(RAIZ, f), "utf-8"), f));

const fuente = readFileSync(join(RAIZ, fichero), "utf-8");
const propias = new Set(reglasTodas.flatMap((r) => dividir(r.sel, ",").flatMap(clasesDe)));

function clasesEnClassName(src) {
  const set = new Set();
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g)) {
    const s = (m[1] ?? m[2] ?? m[3] ?? "").replace(/\$\{[^}]*\}/g, " ");
    for (const t of s.split(/\s+/)) if (t && propias.has(t) && !/[:[/]/.test(t)) set.add(t);
  }
  return set;
}
const usadas = clasesEnClassName(fuente);
// Cuántas veces aparece una clase en los `className` del componente. Si una clase se usa una sola vez, una regla
// `.padre > .clase` equivale a `.clase`: el padre siempre es ese elemento.
function vecesUsada(c) {
  let n = 0;
  for (const m of fuente.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g)) {
    const t = (m[1] ?? m[2] ?? m[3] ?? "").replace(/\$\{[^}]*\}/g, " ");
    if (t.split(/\s+/).includes(c)) n++;
  }
  return n;
}


// Fuentes de todo el proyecto para saber si otra pieza usa la clase (entonces no es exclusiva).
const todoSrc = [...ficheros("app", [".tsx", ".ts"]), ...ficheros("lib", [".ts", ".tsx"])].filter((f) => f.replace(/\\/g, "/") !== fichero.replace(/\\/g, "/"));
const textosOtros = todoSrc.map((f) => readFileSync(join(RAIZ, f), "utf-8")).join("\n");
const usaOtro = (c) => new RegExp(`(?<![\\w-])${c}(?![\\w-])`).test(textosOtros);

const objetivo = new Set([...usadas].filter((c) => !usaOtro(c) && !excluirClases.includes(c)));
for (const c of extraClases) objetivo.add(c);

// Clases con reglas sobre clases AJENAS (`.x > .otraClase`): migrarlas a medias cambiaría qué regla gana sobre esa clase
// ajena (las utilidades van en una capa por encima del CSS histórico), así que se conservan tal cual, sin migrar.
const conservadas = new Set();
(function conservar() {
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const r of reglasTodas) {
      for (const sel of dividir(r.sel, ",").flatMap(expandirIs)) {
        const comps = compuestos(sel);
        let idx = -1;
        comps.forEach((c, i) => {
          if (clasesDe(c.txt).some((k) => objetivo.has(k))) idx = i;
        });
        if (idx < 0 || idx === comps.length - 1) continue;
        const sujeto = comps[comps.length - 1];
        const ajenas = clasesDe(sujeto.txt).filter((k) => !objetivo.has(k) && !ENVOLTORIOS.has(k));
        if (!ajenas.length) continue;
        for (const k of clasesDe(comps[idx].txt)) {
          if (objetivo.has(k)) {
            objetivo.delete(k);
            conservadas.add(k);
            cambio = true;
          }
        }
      }
    }
  }
})();


const manual = [];

// Una regla contribuye a una clase objetivo (su «dueña»: el compuesto más a la izquierda que contiene una).
function asignar() {
  const porDueña = new Map(); // clase → [{ variantes, decl[], apply[], spec, orden }]
  const sep = (comb) => (comb === " " ? "_" : comb);
  for (const r of reglasTodas) {
    for (const sel of dividir(r.sel, ",").flatMap(expandirIs)) {
      const comps = compuestos(sel);
      // La dueña es el compuesto migrado MÁS A LA DERECHA: es el elemento al que se aplican los estilos. Los
      // antecesores migrados son contenedores que siempre están donde vive la clase (son clases de la misma página).
      let idx = -1;
      comps.forEach((c, i) => {
        if (clasesDe(c.txt).some((k) => objetivo.has(k))) idx = i;
      });
      if (idx < 0) continue;
      const dueño = comps[idx];
      const objetivos = clasesDe(dueño.txt).filter((k) => objetivo.has(k));
      if (objetivos.length > 1) {
        manual.push(`selector con dos clases migradas en el mismo elemento: ${sel}`);
        continue;
      }
      const nombre = objetivos[0];
      const antes = comps.slice(0, idx);
      const resto = comps.slice(idx + 1);

      // Un antecesor se puede ignorar si solo lleva clases de envoltorio o migradas.
      const ignorable = (c) => c.txt.replace(/\.[\w-]+/g, "") === "" && clasesDe(c.txt).every((k) => ENVOLTORIOS.has(k) || objetivo.has(k));
      let varAnt = "";
      // «Hijo directo de una clase migrada» no se puede conservar (esa clase desaparece): se deja para hacerlo a mano.
      const ultimo = antes[antes.length - 1];
      if (ultimo && /[>+~]/.test(ultimo.comb) && clasesDe(ultimo.txt).some((k) => objetivo.has(k)) && vecesUsada(nombre) !== 1) {
        manual.push(`relación directa (${ultimo.comb}) con una clase migrada: ${sel}`);
        continue;
      }
      const reales = antes.filter((c) => !ignorable(c));
      if (reales.length) {
        // Si no se ha ignorado ninguno se conserva el camino exacto; si no, los que quedan se tratan como antecesores
        // (los ignorados son contenedores migrados o envoltorios, que siempre están).
        varAnt = reales.length === antes.length ? `[${antes.map((c) => c.txt + sep(c.comb)).join("")}&]` : `[${reales.map((c) => c.txt + "_").join("")}&]`;
      }

      // Estado del propio elemento (`:hover`, `[open]`, `:has(…)`) y, si lo hay, camino a un descendiente.
      const propio = dueño.txt.replace(new RegExp(`\\.${nombre}(?![\\w-])`), "");
      const cola = resto.length ? sep(dueño.comb) + resto.map((c, i) => c.txt + (i < resto.length - 1 ? sep(c.comb) : "")).join("") : "";
      const sinComillas = (t) => t.replace(/["']/g, "");
      const varPropio = [];
      if (cola) {
        varPropio.push(`[&${esc(sinComillas(propio))}${esc(sinComillas(cola)).replace(/^_(?=[>+~])/, "")}]`);
      } else if (propio) {
        const nombrada = PSEUDO[propio];
        if (nombrada) varPropio.push(nombrada);
        else if (/^:has\(/.test(propio)) varPropio.push(`has-[${esc(sinComillas(propio.slice(5, -1)))}]`);
        else if (/^\[aria-pressed=["']?true["']?\]$/.test(propio)) varPropio.push("aria-pressed");
        else if (/^\[aria-expanded=["']?true["']?\]$/.test(propio)) varPropio.push("aria-expanded");
        else if (/^\[aria-selected=["']?true["']?\]$/.test(propio)) varPropio.push("aria-selected");
        else varPropio.push(`[&${esc(sinComillas(propio))}]`);
      }
      const variantes = [...variantesAt(r.at), ...(varAnt ? [varAnt] : []), ...varPropio];
      const decl = declaraciones(r.cuerpo).filter((d) => !d.prop.includes("@") && !d.valor.startsWith("@apply"));
      const apply = [...r.cuerpo.matchAll(/@apply\s+([^;]+);/g)].flatMap((m) => m[1].trim().split(/\s+/));
      if (!porDueña.has(nombre)) porDueña.set(nombre, []);
      // Las reglas de styles.css están en la capa `legacy`; las de los demás CSS van sin capa y ganan a las de la capa
      // aunque tengan menos especificidad.
      const rango = r.archivo.replace(/\\/g, "/") === "app/styles.css" ? 0 : 1;
      // Dentro de `.tw`, el reset `border: 0 solid` (capa `tw-base`) va POR ENCIMA de la capa `legacy`: los bordes que
      // declara styles.css no se ven hoy. Se descartan para que migrar no los resucite (usa --sin-tw si el componente
      // no está dentro de un contenedor `.tw`).
      const BORDES = /^border(-(top|right|bottom|left))?(-(width|style|color))?$/;
      const declVisibles = rango === 0 && !args.includes("--sin-tw") ? decl.filter((d) => !BORDES.test(d.prop)) : decl;
      porDueña.get(nombre).push({ variantes, decl: declVisibles, apply, spec: especificidad(sel), orden: r.orden, rango, sel, archivo: r.archivo });
    }
  }
  return porDueña;
}

const porDueña = asignar();

function expandir(decl) {
  const out = [];
  const lados = (prefijo, v) => {
    const p = dividir(v, " ");
    const [t, r, b, l] = p.length === 1 ? [p[0], p[0], p[0], p[0]] : p.length === 2 ? [p[0], p[1], p[0], p[1]] : p.length === 3 ? [p[0], p[1], p[2], p[1]] : p;
    return [[`${prefijo}-top`, t], [`${prefijo}-right`, r], [`${prefijo}-bottom`, b], [`${prefijo}-left`, l]];
  };
  for (const d of decl) {
    if (d.prop === "padding" || d.prop === "margin") for (const [p, v] of lados(d.prop, d.valor)) out.push({ prop: p, valor: v, imp: d.imp });
    else if (d.prop.startsWith("--ds-") || d.prop.startsWith("--chat-")) continue;
    else out.push(d);
  }
  return out;
}

function comprimir(props, imp) {
  // props: Map prop→valor de padding/margin longhands → clases
  const out = [];
  for (const base of ["padding", "margin"]) {
    const g = (l) => props.get(`${base}-${l}`);
    const [t, r, b, l] = ["top", "right", "bottom", "left"].map(g);
    const pre = base === "padding" ? "p" : "m";
    const f = (valor, eje) => {
      if (valor === undefined) return;
      const n = valor.trim();
      const negativo = n.startsWith("-");
      out.push(`${negativo ? "-" : ""}${pre}${eje}-${esp(n.replace(/^-/, ""))}`);
    };
    if ([t, r, b, l].every((x) => x !== undefined) && t === r && r === b && b === l) f(t, "");
    else {
      if (t !== undefined && b !== undefined && t === b) f(t, "y"); else { f(t, "t"); f(b, "b"); }
      if (l !== undefined && r !== undefined && l === r) f(l, "x"); else { f(l, "l"); f(r, "r"); }
    }
  }
  return out;
}

// Qué propiedades fija una utilidad (sin variantes). Sirve para saber si una utilidad posterior anula a una anterior.
function ranuras(base) {
  let b = base.replace(/!$/, "").replace(/^-/, "");
  let m;
  if ((m = b.match(/^\[([a-z-]+):/))) return [`arb:${m[1]}`];
  if ((m = b.match(/^([pm])([xytrbl])?-/))) {
    const pre = m[1];
    const e = m[2];
    const lados = !e ? ["t", "r", "b", "l"] : e === "x" ? ["l", "r"] : e === "y" ? ["t", "b"] : [e];
    return lados.map((l) => `${pre}${l}`);
  }
  if (/^(flex|grid|block|inline-flex|inline-block|inline|hidden|contents|inline-grid|table|list-item)$/.test(b)) return ["display"];
  if (/^flex-(row|col)(-reverse)?$/.test(b)) return ["flex-direction"];
  if (/^flex-(wrap|nowrap)(-reverse)?$/.test(b)) return ["flex-wrap"];
  if (/^flex-(1|auto|none)$/.test(b)) return ["flex"];
  if (/^(grow|grow-0)$/.test(b)) return ["flex-grow"];
  if (/^(shrink|shrink-0)$/.test(b)) return ["flex-shrink"];
  if (/^basis-/.test(b)) return ["flex-basis"];
  if (/^items-/.test(b)) return ["align-items"];
  if (/^self-/.test(b)) return ["align-self"];
  if (/^justify-items-/.test(b)) return ["justify-items"];
  if (/^justify-self-/.test(b)) return ["justify-self"];
  if (/^justify-/.test(b)) return ["justify-content"];
  if (/^gap-x-/.test(b)) return ["gap-x"];
  if (/^gap-y-/.test(b)) return ["gap-y"];
  if (/^gap-/.test(b)) return ["gap-x", "gap-y"];
  if (/^text-(left|center|right|justify|start|end)$/.test(b)) return ["text-align"];
  if (/^text-(ellipsis|clip)$/.test(b)) return ["text-overflow"];
  if (/^text-(xs|sm|base|lg|xl|[2-9]xl)$/.test(b) || /^text-\[(?!color:)[\d.]+(px|rem|em)\]$/.test(b) || /^text-\[clamp\(/.test(b)) return ["font-size"];
  if (/^text-/.test(b)) return ["color"];
  if (/^font-(thin|light|normal|medium|semibold|bold|extrabold|black)$/.test(b) || /^font-\[\d+\]$/.test(b)) return ["font-weight"];
  if (/^(italic|not-italic)$/.test(b)) return ["font-style"];
  if (/^leading-/.test(b)) return ["line-height"];
  if (/^tracking-/.test(b)) return ["letter-spacing"];
  if (/^(uppercase|lowercase|capitalize|normal-case)$/.test(b)) return ["text-transform"];
  if (/^(underline|no-underline|line-through)$/.test(b)) return ["text-decoration"];
  if (/^whitespace-/.test(b)) return ["white-space"];
  if (/^wrap-/.test(b)) return ["overflow-wrap"];
  if (/^break-/.test(b)) return ["word-break"];
  if ((m = b.match(/^(w|h|min-w|min-h|max-w|max-h)-/))) return [m[1]];
  if (/^size-/.test(b)) return ["w", "h"];
  if (/^border-(solid|dashed|dotted|none|double)$/.test(b)) return ["border-style"];
  if ((m = b.match(/^border-([trblxy])(?:-(.*))?$/)) && (m[2] === undefined || m[2] === "0" || /^\[[\d.]+px\]$/.test(m[2]))) {
    const e = m[1];
    return (e === "x" ? ["l", "r"] : e === "y" ? ["t", "b"] : [e]).map((l) => `bw-${l}`);
  }
  if (b === "border" || b === "border-0" || /^border-\[[\d.]+px\]$/.test(b) || /^border-[248]$/.test(b)) return ["bw-t", "bw-r", "bw-b", "bw-l"];
  if ((m = b.match(/^border-([trblxy])-(.+)$/))) {
    const e = m[1];
    return (e === "x" ? ["l", "r"] : e === "y" ? ["t", "b"] : [e]).map((l) => `bc-${l}`);
  }
  if (/^border-/.test(b)) return ["bc-t", "bc-r", "bc-b", "bc-l"];
  if ((m = b.match(/^rounded-(tl|tr|bl|br)/))) return [`r-${m[1]}`];
  if ((m = b.match(/^rounded-([tblr])(?:-|$)/))) {
    const e = m[1];
    return (e === "t" ? ["tl", "tr"] : e === "b" ? ["bl", "br"] : e === "l" ? ["tl", "bl"] : ["tr", "br"]).map((c) => `r-${c}`);
  }
  if (/^rounded/.test(b)) return ["r-tl", "r-tr", "r-bl", "r-br"];
  if (/^bg-none$/.test(b)) return ["bg-image"];
  if (/^bg-/.test(b)) return ["bg-color"];
  if (/^overflow-x-/.test(b)) return ["overflow-x"];
  if (/^overflow-y-/.test(b)) return ["overflow-y"];
  if (/^overflow-/.test(b)) return ["overflow-x", "overflow-y"];
  if (/^shadow-/.test(b)) return ["box-shadow"];
  if (/^opacity-/.test(b)) return ["opacity"];
  if (/^z-/.test(b)) return ["z-index"];
  if (/^cursor-/.test(b)) return ["cursor"];
  if (/^resize/.test(b)) return ["resize"];
  if (/^(static|relative|absolute|fixed|sticky)$/.test(b)) return ["position"];
  if ((m = b.match(/^(top|left|right|bottom|inset)-/))) return [m[1]];
  if (/^grid-cols-/.test(b)) return ["grid-template-columns"];
  if (/^grid-rows-/.test(b)) return ["grid-template-rows"];
  if (/^col-span-/.test(b)) return ["grid-column"];
  if (/^list-/.test(b)) return ["list-style"];
  if (/^outline-offset-/.test(b)) return ["outline-offset"];
  if (/^outline/.test(b)) return ["outline"];
  if (/^(select|pointer-events|accent|object|align|animate|transition|duration|ease)-/.test(b)) return [`raw:${b}`];
  return [`raw:${b}`];
}

// Separa «variantes:utilidad» respetando los corchetes (`[&_h2]:text-[19px]`).
function partirVariantes(clase) {
  let prof = 0;
  let ultimo = -1;
  for (let i = 0; i < clase.length; i++) {
    const ch = clase[i];
    if (ch === "[") prof++;
    else if (ch === "]") prof--;
    else if (ch === ":" && prof === 0) ultimo = i;
  }
  return ultimo < 0 ? ["", clase] : [clase.slice(0, ultimo + 1), clase.slice(ultimo + 1)];
}

// Aplica la cascada: una utilidad posterior anula a las anteriores cuyas propiedades cubre por completo.
function cascada(clases) {
  const res = [];
  for (const cls of clases) {
    const [pre, base] = partirVariantes(cls);
    const claves = new Set(ranuras(base).map((s) => pre + s));
    for (let i = res.length - 1; i >= 0; i--) {
      if (res[i].cls === cls || [...res[i].claves].every((k) => claves.has(k))) res.splice(i, 1);
    }
    res.push({ cls, claves });
  }
  return res.map((r) => r.cls);
}

// Separa los prefijos «a:b:[&_x]:» en variantes sueltas respetando los corchetes.
function trocearVariantes(prefijo) {
  const out = [];
  let prof = 0;
  let actual = "";
  for (const ch of prefijo) {
    if (ch === "[") prof++;
    if (ch === "]") prof--;
    if (ch === ":" && prof === 0) {
      if (actual) out.push(actual);
      actual = "";
    } else actual += ch;
  }
  if (actual) out.push(actual);
  return out;
}

function resolver(reglas) {
  // Orden de cascada: especificidad y, a igualdad, orden de aparición.
  const ord = [...reglas].sort((a, b) => a.rango - b.rango || a.spec - b.spec || a.orden - b.orden);
  const tokens = [];
  ord.forEach((r, prec) => {
    const props = new Map();
    const imps = new Map();
    for (const d of expandir(r.decl)) {
      props.set(d.prop, d.valor);
      imps.set(d.prop, d.imp);
    }
    const base = [];
    const espaciado = new Map([...props].filter(([p]) => /^(padding|margin)-/.test(p)));
    const hayImp = [...espaciado.keys()].some((k) => imps.get(k));
    for (const c of comprimir(espaciado, hayImp)) base.push(`${c}${hayImp ? "!" : ""}`);
    for (const [p, v] of props) {
      if (/^(padding|margin)-/.test(p)) continue;
      for (const c of utilidad(p, v, null)) base.push(`${c}${imps.get(p) ? "!" : ""}`);
    }
    for (const a of r.apply) base.push(a);
    for (const b of base) {
      // Un `@apply` puede traer sus propias variantes (`md:flex`): se suman a las de la regla.
      const [pv, util] = partirVariantes(b);
      const vars = new Set([...r.variantes, ...trocearVariantes(pv)]);
      const prefijo = [...r.variantes, ...trocearVariantes(pv)].map((v) => v + ":").join("");
      // `objetivo` = la variante que cambia el elemento al que se aplica (`[&_label]`, `[&>span]`): dos utilidades solo
      // compiten si van al mismo elemento. El resto de variantes son condiciones sobre ese elemento.
      const objetivoVar = [...vars].find((v) => /^\[&/.test(v) && /[_>+~]/.test(v.replace(/\([^)]*\)/g, "").slice(2))) ?? "";
      const conds = new Set([...vars].filter((v) => v !== objetivoVar));
      tokens.push({ cls: prefijo + util, conds, objetivoVar, slots: ranuras(util), prec });
    }
  });
  // Una utilidad queda anulada si otra de mayor precedencia, que se aplica SIEMPRE que ella (sus condiciones son un
  // subconjunto de las de la primera), fija todas sus propiedades. Así una regla de `@media` con poca especificidad
  // no pisa a una base más específica, que era lo que ocurría en el CSS original.
  const vivos = tokens.filter(
    (t) =>
      !tokens.some(
        (u) => u.prec > t.prec && u.objetivoVar === t.objetivoVar && [...u.conds].every((v) => t.conds.has(v)) && t.slots.every((s) => u.slots.includes(s)),
      ),
  );
  return [...new Set(vivos.map((t) => t.cls))];
}

// ───────────────────────── salida ─────────────────────────

const resultado = new Map();
for (const c of [...objetivo].sort()) {
  const reglas = porDueña.get(c) ?? [];
  const cl = reglas.length ? resolver(reglas) : [];
  resultado.set(c, marcarImportante(c, cl));
}

// Elementos con VARIAS clases migradas (`className="a b"`): en el CSS original qué regla gana entre ellas se decidía por
// precedencia (capa, especificidad, orden). Migradas por separado esa decisión se perdería (gana la que el CSS final ponga
// al último), así que se resuelven juntas y se escriben como una sola entrada `a_b`.
const combos = new Map();
for (const m of fuente.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g)) {
  const txt = (m[1] ?? m[2] ?? m[3] ?? "").replace(/\$\{[^}]*\}/g, " ");
  const miembros = [...new Set(txt.split(/\s+/).filter((t) => objetivo.has(t) && resultado.get(t).length))];
  if (miembros.length > 1) combos.set(miembros.join("_"), miembros);
}
for (const [clave, miembros] of combos) {
  const cl = resolver(miembros.flatMap((k) => porDueña.get(k) ?? []));
  resultado.set(clave, miembros.reduce((acc, k) => marcarImportante(k, acc), cl));
}

const stem = basename(fichero).replace(/\.tsx$/, "");
const ficheroEstilos = join(dirname(fichero), `${stem}-estilos.ts`);

const exportES = `// Estilos de ${stem}.tsx en utilidades de Tailwind. Generado por scripts/migrar-a-tailwind.mjs a partir de las
// reglas CSS que tenía el componente; una cadena por clase, con el mismo nombre que tenía.
export const S = {\n${[...resultado].map(([c, cl]) => `  ${c}: ${JSON.stringify(cl.join(" "))},`).join("\n")}\n} as const;\n`;

console.log(`${fichero}: ${usadas.size} clases propias · ${objetivo.size} exclusivas migradas · ${usadas.size - objetivo.size} compartidas (se dejan)`);
if (conservadas.size) console.log(`conservadas sin migrar (tienen reglas sobre clases ajenas): ${[...conservadas].join(" ")}`);
console.log(`compartidas que se quedan: ${[...usadas].filter((c) => !objetivo.has(c)).join(" ")}`);
const sinReglas = [...resultado].filter(([, cl]) => cl.length === 0).map(([c]) => c);
if (sinReglas.length) console.log(`sin reglas CSS (clase marcador): ${sinReglas.join(" ")}`);
for (const m of new Set(manual)) console.log(`MANUAL: ${m}`);

// Reescritura del TSX.
function reescribir(src) {
  const avisos = [];
  const usaCn = { v: false };
  const refer = (c) => `S.${c}`;
  const out = src.replace(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g, (todo, a, b, c3) => {
    const txt = a ?? b ?? c3;
    if (a !== undefined || c3 !== undefined) {
      const toks = txt.split(/\s+/).filter(Boolean);
      if (!toks.some((t) => objetivo.has(t))) return todo;
      const miembros = [...new Set(toks.filter((t) => objetivo.has(t) && resultado.get(t).length))];
      const clave = miembros.length > 1 ? miembros.join("_") : null;
      let puesto = false;
      const partes = toks
        .map((t) => {
          if (!objetivo.has(t)) return JSON.stringify(t);
          if (!resultado.get(t).length) return null;
          if (!clave) return refer(t);
          if (puesto) return null;
          puesto = true;
          return refer(clave);
        })
        .filter(Boolean);
      if (!partes.length) return "";
      if (partes.length === 1 && partes[0].startsWith("S.")) return `className={${partes[0]}}`;
      usaCn.v = true;
      return `className={cn(${partes.join(", ")})}`;
    }
    // Plantilla: se sustituyen los tokens del texto fijo por `${S.x}`.
    if (!/\S/.test(txt)) return todo;
    const trozos = txt.split(/(\$\{(?:[^{}]|\{[^{}]*\})*\})/);
    let tocado = false;
    const miembrosT = [...new Set(trozos.filter((t) => !t.startsWith("${")).flatMap((t) => t.match(/[A-Za-z_][\w-]*/g) ?? []).filter((w) => objetivo.has(w) && resultado.get(w).length))];
    const claveT = miembrosT.length > 1 ? miembrosT.join("_") : null;
    let puestoT = false;
    const nuevo = trozos
      .map((t) => {
        if (t.startsWith("${")) {
          if ([...objetivo].some((k) => new RegExp(`(?<![\\w-])${k}(?![\\w-])`).test(t))) avisos.push(`clase migrada dentro de una expresión: ${t.slice(0, 80)}`);
          return t;
        }
        return t.replace(/[A-Za-z_][\w-]*/g, (w) => {
          if (objetivo.has(w)) {
            tocado = true;
            if (!resultado.get(w).length) return "";
            if (!claveT) return `\${${refer(w)}}`;
            if (puestoT) return "";
            puestoT = true;
            return `\${${refer(claveT)}}`;
          }
          return w;
        });
      })
      .join("");
    return tocado ? `className={\`${nuevo.replace(/\s{2,}/g, " ").trim()}\`}` : todo;
  });
  return { out, avisos, usaCn: usaCn.v };
}

const { out: nuevoTsx, avisos, usaCn } = reescribir(fuente);
for (const a of avisos) console.log(`MANUAL: ${a}`);

// Clases migradas citadas fuera de un className (querySelector, classList…)
const restos = [...objetivo].filter((c) => new RegExp(`["'\`.]${c}(?![\\w-])`).test(nuevoTsx.replace(/S\.[\w]+/g, "")));
if (restos.length) console.log(`MANUAL: nombres de clase usados fuera de className (¿selectores?): ${restos.join(" ")}`);

if (!aplicar) {
  console.log("\n(informe: no se ha escrito nada; usa --aplicar)");
  console.log(`${[...resultado].reduce((n, [, cl]) => n + cl.length, 0)} utilidades en ${resultado.size} clases`);
  process.exit(0);
}

writeFileSync(join(RAIZ, ficheroEstilos), exportES);
let tsx = nuevoTsx;
const importes = [`import { S } from "./${stem}-estilos";`];
if (usaCn && !/from "@\/lib\/utils"/.test(tsx)) importes.push(`import { cn } from "@/lib/utils";`);
else if (usaCn && !/\bcn\b[^;]*from "@\/lib\/utils"/.test(tsx)) importes.push(`import { cn } from "@/lib/utils";`);
// Tras el último import del bloque inicial
const m = [...tsx.matchAll(/^import[\s\S]*?;\s*$/gm)].pop();
tsx = tsx.slice(0, m.index + m[0].length) + "\n" + importes.join("\n") + tsx.slice(m.index + m[0].length);
writeFileSync(join(RAIZ, fichero), tsx);
console.log(`\nEscrito ${ficheroEstilos} y reescrito ${fichero}`);
