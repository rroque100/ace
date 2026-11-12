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
import ts from "typescript";

const RAIZ = process.cwd();
const args = process.argv.slice(2);
const fichero = args.find((a) => !a.startsWith("--"));
const aplicar = args.includes("--aplicar");
// `--todo` migra TODAS las clases propias de app/**/*.tsx de una vez. Es el único modo que resuelve bien la cascada entre
// una clase compartida y la exclusiva con la que convive en un elemento (`secondaryButton docBtn`): migradas por separado
// las utilidades de una ganarían siempre a las reglas heredadas de la otra. Las compartidas (usadas en 2+ ficheros) van a
// `app/components/estilos-comunes.ts` (`C`); las exclusivas, al `<componente>-estilos.ts` de siempre (`S`).
const todo = args.includes("--todo");
// `--marcar=a,b`: clases que el código busca por nombre (`querySelector(".a")`) y deben seguir en el DOM como marcador.
const marcarClases = new Set((args.find((a) => a.startsWith("--marcar=")) ?? "").slice(9).split(",").filter(Boolean));
// `--forzar=a,b`: clases que se migran aunque algún .ts las nombre (palabras sueltas como `aviso` que no son clases allí).
const forzarClases = new Set((args.find((a) => a.startsWith("--forzar=")) ?? "").slice(9).split(",").filter(Boolean));
const extraClases = (args.find((a) => a.startsWith("--clases="))?.slice(9) ?? "").split(",").filter(Boolean);
const excluirClases = (args.find((a) => a.startsWith("--excluir="))?.slice(10) ?? "").split(",").filter(Boolean);
// Clases cuyas utilidades deben ir con `!`: mientras convivan, una regla SIN capa de los CSS de compatibilidad (por
// ejemplo `.legalWorkspace .secondaryButton`) gana a las utilidades, que están en una capa. Se marcan a mano tras ver en
// la comparación de estilos qué clase pierde frente a una de esas reglas.
// Formato: `--importante=clase` (todas sus utilidades) o `--importante=clase=utilidad` (solo esa; las utilidades llevan
// `:` por las variantes, de ahí el segundo `=`). Se pueden separar varios con `;`.
const sinFuente = new Set((args.find((a) => a.startsWith("--sin-fuente=")) ?? "").slice(13).split(",").filter(Boolean));
// `--sin-tw=a,b`: clases cuyos elementos NO están dentro de `.tw` (el menú, la barra superior, los lanzadores del asistente). Ahí
// el reset de `.tw` no los toca, así que los bordes y botones de styles.css SÍ se veían y no se pueden descartar.
const sinTwClases = new Set((args.find((a) => a.startsWith("--sin-tw=")) ?? "").slice(9).split(",").filter(Boolean));
// `--tw-condicional` (el modo de la segunda pasada, 2026-11-12). Sin él la herramienta SUPONE que todo el CSS heredado vive dentro
// de un `.tw` y descarta los bordes y el fondo de los botones (el reset de `.tw` los anulaba); en el main de entonces casi ninguna
// pantalla estaba dentro de `.tw` y se perdieron bordes en Validar, Historial, Archivo, Métricas… Con él:
//   - lo que el reset anulaba se escribe con las variantes `fuera-tw:`, `fuera-tw-boton:` y `fuera-tw-texto:` (app/tailwind.css):
//     el navegador decide elemento a elemento si está dentro de un `.tw`, como hacía la cascada;
//   - todo lo que venía de styles.css lleva `legado:`, que lo mete en la subcapa `utilities.legado`: vuelve a perder frente a las
//     utilidades escritas a mano, como cuando styles.css estaba en la capa `legacy`;
//   - los empates de especificidad que el CSS resolvía por orden se resuelven con escalones `[html_&]` (ver `peldano`).
const twCondicional = args.includes("--tw-condicional");
function fueraDeTw(toks) {
  // Con `--tw-condicional` no hay que decidirlo: las utilidades llevan la condición y el navegador la evalúa.
  if (twCondicional) return false;
  return toks.some((t) => sinTwClases.has(t));
}
const importantes = new Map();
for (const e of (args.find((a) => a.startsWith("--importante=")) ?? "").slice(13).split(";").filter(Boolean)) {
  const i = e.indexOf("=");
  const clase = i < 0 ? e : e.slice(0, i);
  if (i < 0) importantes.set(clase, null);
  else if (importantes.get(clase) !== null) importantes.set(clase, [...(importantes.get(clase) ?? []), e.slice(i + 1)]);
}
const marcarImportante = (clase, tokens) => {
  if (!importantes.has(clase)) return tokens;
  const solo = importantes.get(clase);
  return tokens.map((t) => (t.endsWith("!") || (solo !== null && !solo.includes(t)) ? t : t + "!"));
};
if (!fichero && !todo) {
  console.error("Falta el componente: node scripts/migrar-a-tailwind.mjs app/components/x.tsx [--aplicar]  (o --todo)");
  process.exit(1);
}

// Contenedores que están siempre presentes donde vive el componente: su especificidad cuenta, pero no hace falta
// condicionar por ellos (las páginas del Centro Jurídico los llevan todos).
// `--envoltorios=a,b` añade clases que el componente SIEMPRE lleva en su raíz o antecesores (por ejemplo `chatAccessible`):
// sus reglas se funden con las base y la cascada se resuelve exacta, en vez de quedar como condiciones sueltas.
const ENVOLTORIOS = new Set(["legalWorkspace", "legalShell", "tw", ...(args.find((a) => a.startsWith("--envoltorios=")) ?? "").slice(14).split(",").filter(Boolean)]);

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
// Las clases de `:not(...)` no son el elemento al que se aplica la regla: no cuentan para decidir su dueña.
const quitarNot = (txt) => {
  let r = txt;
  for (let i = 0; i < 4; i++) r = r.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, "");
  return r;
};
const clasesPositivas = (txt) => clasesDe(quitarNot(txt));
// Los valores de atributo van entre comillas simples (Tailwind rechaza `[data-x=1]` o `=a b` sin ellas) y con `\_` si
// llevan guion bajo, que Tailwind si no convierte en espacio. Los espacios se escriben `_`.
const citarAtributos = (txt) =>
  txt.replace(/\[([\w-]+)([~|^$*]?=)("[^"]*"|'[^']*'|[^\]\s]+)\]/g, (_, a, op, v) => `[${a}${op}'${v.replace(/^["']|["']$/g, "").replace(/_/g, "\\_").replace(/\s+/g, "_")}']`);

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
    // Un borde de color pleno (`#16a34a`, `#0f766e`: la franja de las tarjetas de Evaluación, el borde de un botón de marca)
    // es el token entero. Al 30 % solo encaja un tinte claro (`#93cdb8`); antes iba todo al 30 % y las franjas casi desaparecían.
    if (l < 0.6 || (s > 0.6 && l < 0.75)) return estado();
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
  // Un hex con canal alfa (`#0002`, `#0f172a33`) es casi siempre una sombra o un velo: su color es la transparencia, no el
  // tono. Mandarlo al token más cercano lo volvía opaco (la sombra del lanzador de «Mi Yo» salió ámbar: `#0002` se leía
  // como un hex de 3 cifras roto). Se escribe tal cual en rgba().
  const conAlfa = valor.replace(/#([0-9a-fA-F]{4}|[0-9a-fA-F]{8})\b/g, (_, h) => {
    const largo = h.length === 4 ? [...h].map((c) => c + c).join("") : h;
    const [r, g, b, a] = [0, 2, 4, 6].map((i) => parseInt(largo.slice(i, i + 2), 16));
    return `rgba(${r},${g},${b},${Math.round((a / 255) * 1000) / 1000})`;
  });
  return conAlfa.replace(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, (h) => {
    const t = tokenDeHex(h, "fondo");
    const [base, opacidad] = t.split("/");
    const map = { canvas: "bg", "brand-soft": "soft", "danger-soft": "danger-soft", panel: "panel", surface: "surface", line: "line", "line-strong": "line-strong", ink: "ink", muted: "muted", "on-brand": "on-brand" };
    const v = `var(--${map[base] ?? base})`;
    // `warning/30` es el tono al 30 %: sin la mezcla salía el color pleno.
    return opacidad ? `color-mix(in srgb, ${v} ${opacidad}%, transparent)` : v;
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
// El signo va delante de la utilidad (`-left-[50%]`) y `esp()` ya lo ha quitado del valor: sin él, `left:-50%` salía `left-[50%]`
// (la línea del stepper de flujo se dibujaba a la derecha del paso en vez de a la izquierda). Vale también para %, rem, etc.
const neg = (v, base) => (v.trim().startsWith("-") && !v.includes("calc") ? `-${base}` : base);

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
    // `text-[…]` y `font-[…]` son ambiguos para Tailwind: con un valor que no es una medida (`inherit`, `var(--x)`) los toma por
    // COLOR y por TIPO DE LETRA. `font-size: inherit` salía `text-[inherit]` (un color) y los títulos de los paneles de la ficha
    // de necesidad crecieron de 15 a 16 px; `font-weight: var(--peso-medio)` no ponía peso. Esos valores van como propiedad.
    case "font-size": return [/^-?[\d.]+(px|rem|em|%|vw|vh|ch)?$|^(clamp|min|max|calc)\(/.test(v) ? `text-[${esc(v)}]` : `[font-size:${esc(v)}]`];
    case "font-weight": return [PESOS[v] ?? (/^\d+$/.test(v) ? `font-[${v}]` : `[font-weight:${esc(v)}]`)];
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
      // `color:` deshace la ambigüedad de `border-[var(--x)]` (¿ancho o color?).
      return [t ? `border${lado ? "-" + lado : ""}-${t}` : `border${lado ? "-" + lado : ""}-[color:${esc(sinHex(v))}]`];
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
    out.push(t ? `border${suf}-${t}` : `border${suf}-[color:${esc(sinHex(color))}]`);
  }
  return out;
}

// ───────────────────────── variantes ─────────────────────────

const PSEUDO = { ":hover": "hover", ":focus": "focus", ":focus-visible": "focus-visible", ":active": "active", ":disabled": "disabled", ":checked": "checked", "[open]": "open", "::placeholder": "placeholder", "::marker": "marker", ":first-child": "first", ":last-child": "last", ":empty": "empty", ":focus-within": "focus-within", "::before": "before", "::after": "after", "[disabled]": "disabled" };

function variantesAt(at) {
  return at.map((a) => {
    const nombre = a.match(/^@([\w-]+)/)?.[1] ?? "media";
    const cond = a.replace(/^@[\w-]+\s*/, "").trim();
    let m;
    // `@max-[720px]` / `@min-[…]` son las variantes de contenedor de Tailwind: se ordenan por tamaño (el menor, el último), y
    // la forma arbitraria `[@container(…)]` se ordena como texto («560px» antes que «720px») y rompe la cascada entre rangos.
    if (nombre === "container") {
      if ((m = cond.match(/^\(\s*max-width:\s*(\d+)px\s*\)$/))) return `@max-[${m[1]}px]`;
      if ((m = cond.match(/^\(\s*min-width:\s*(\d+)px\s*\)$/))) return `@min-[${m[1]}px]`;
    }
    if (nombre !== "media" && nombre !== "supports") return `[@${nombre}${esc(cond)}]`;
    if ((m = cond.match(/^\(\s*max-width:\s*(\d+)px\s*\)$/))) return `max-[${m[1]}px]`;
    if ((m = cond.match(/^\(\s*min-width:\s*(\d+)px\s*\)$/))) return `min-[${m[1]}px]`;
    if (/^\(prefers-reduced-motion:\s*reduce\)$/.test(cond)) return "motion-reduce";
    if (/^print$/.test(cond)) return "print";
    return a.startsWith("@supports") ? `supports-[${esc(cond.replace(/^\(|\)$/g, ""))}]` : `[@media${esc(cond)}]`;
  });
}

// ───────────────────────── recolección y resolución ─────────────────────────

// `workspace.css` (tokens y reglas de modo oscuro) solo entra en `--todo`: también tiene reglas por clase (`.workspaceShell
// .primaryButton`, `[data-theme="dark"] .panel`) que hay que fundir en las utilidades antes de quitar esas clases.
const archivosCss = [...ficheros("app", [".css"])].filter((f) => !/^app[\\/]tailwind\.css$/.test(f) && (todo || !/^app[\\/]workspace\.css$/.test(f)));
const reglasTodas = archivosCss.flatMap((f) => parsear(readFileSync(join(RAIZ, f), "utf-8"), f));

const rutaNorm = (f) => f.replace(/\\/g, "/");
// Los ficheros que se reescriben: el indicado o, con `--todo`, todos los .tsx de app.
const fuentes = new Map((todo ? ficheros("app", [".tsx"]) : [fichero]).map((f) => [rutaNorm(f), readFileSync(join(RAIZ, f), "utf-8")]));
const propias = new Set(reglasTodas.flatMap((r) => dividir(r.sel, ",").flatMap(clasesDe)));
// Ganchos de utilidades de Tailwind que workspace.css nombra (`.tw .bg-brand`): son del framework, no clases propias.
if (todo) for (const k of ["tw", "bg-brand", "text-brand-dark"]) propias.delete(k);
// Una clase que el código a mano nombra dentro de una variante de Tailwind (`[&_.searchAssistantTrigger]:hidden`) tiene que seguir
// en el DOM aunque ya no tenga CSS: se conserva como marcador.
if (todo) {
  for (const src of fuentes.values()) {
    for (const m of src.matchAll(/\[[^\]\s"'`]*\.([A-Za-z_][\w-]*)[^\]\s"'`]*\]:/g)) if (propias.has(m[1])) marcarClases.add(m[1]);
  }
}

// Cada grupo de clases de los `className` de un fuente: un literal entre comillas, el texto fijo de una plantilla o cada
// literal dentro de una expresión (`cond ? "a" : "b"`, `cn("a", x && "b")`). `grupo(tipo, datos)` devuelve el código que lo
// sustituye, o `null` para dejarlo como está. `tipo`: "atributo" (`className="a b"`), "literal" (dentro de una expresión,
// datos = el texto) o "plantilla" (datos = los trozos de texto fijo; devuelve los trozos nuevos).
const LLAMADAS_CLASE = new Set(["cn", "clsx", "classNames", "twMerge", "twJoin"]);
const esIdent = (ch) => /[\w$]/.test(ch);
function finCadena(src, i) {
  const q = src[i];
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === "\\") j++;
    else if (src[j] === q) return j;
  }
  throw new Error(`cadena sin cerrar: ${src.slice(i, i + 60)}`);
}
// ¿Va el literal tras un `?`, `:`, `&&`, `||` o `??`? Entonces la clase solo está a veces (`abierto ? "open" : ""`).
const enCondicion = (antes) => /(\?|:|&&|\|\||\?\?)\s*$/.test(antes);
// Lee una plantilla desde su `` ` `` de apertura. Devuelve { fin, out } con el texto ya reescrito.
function leerPlantilla(src, i, grupo, elegible, condicional) {
  const trozos = [];
  const exprs = [];
  const originales = []; // el código de cada `${…}` tal como estaba, para saber si empieza o acaba en un espacio
  let texto = "";
  let j = i + 1;
  for (; j < src.length; j++) {
    const ch = src[j];
    if (ch === "\\") { texto += ch + src[j + 1]; j++; continue; }
    if (ch === "`") break;
    if (ch === "$" && src[j + 1] === "{") {
      trozos.push(texto);
      texto = "";
      const r = escanearExpr(src, j + 2, grupo);
      exprs.push(r.out);
      originales.push(src.slice(j + 2, r.fin));
      j = r.fin;
      continue;
    }
    texto += ch;
  }
  trozos.push(texto);
  const nuevos = elegible ? grupo("plantilla", trozos, condicional, originales) ?? trozos : trozos;
  let out = "`";
  nuevos.forEach((t, k) => { out += t + (k < exprs.length ? "${" + exprs[k] + "}" : ""); });
  return { fin: j, out: out + "`" };
}
// Recorre una expresión hasta la `}` que la cierra (sin consumirla). Solo reescribe literales «de clase»: los que están
// sueltos o dentro de `cn(...)`, corchetes o agrupaciones; no los argumentos de otras funciones (`expBtnClass("ghost")`).
function escanearExpr(src, i, grupo) {
  let out = "";
  const pila = [];
  let ident = "";
  const elegible = () => pila.every((p) => p.t === "[" || (p.t === "(" && (p.fn === "" || LLAMADAS_CLASE.has(p.fn))));
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      const fin = finCadena(src, i);
      const lit = src.slice(i, fin + 1);
      // Un literal que se compara (`tono === "brand"`, `"dec" === actor`) es un dato, no una clase.
      const comparado = /(?:===|!==|==|!=)\s*$/.test(out) || /^\s*(?:===|!==|==|!=)/.test(src.slice(fin + 1));
      const nuevo = elegible() && !comparado ? grupo("literal", src.slice(i + 1, fin), enCondicion(out)) : null;
      out += nuevo ?? lit;
      i = fin + 1;
      ident = "";
      continue;
    }
    if (ch === "`") {
      const r = leerPlantilla(src, i, grupo, elegible(), enCondicion(out));
      out += r.out;
      i = r.fin + 1;
      ident = "";
      continue;
    }
    if (ch === "}" && pila.length === 0) return { fin: i, out };
    if (ch === "(" || ch === "[" || ch === "{") pila.push({ t: ch, fn: ch === "(" ? ident : "" });
    else if (ch === ")" || ch === "]" || ch === "}") pila.pop();
    ident = esIdent(ch) ? ident + ch : "";
    out += ch;
    i++;
  }
  throw new Error("expresión sin cerrar");
}
// La etiqueta del elemento JSX que lleva el `className` (la del último `<` anterior): `button`, `a`, `Link`…
const etiquetaDe = (src, pos) => src.slice(src.lastIndexOf("<", pos)).match(/^<([A-Za-z][\w.]*)/)?.[1] ?? "";
function reescribirClassNames(src, grupo) {
  let out = "";
  let ultimo = 0;
  const re = /\bclassName=/g;
  let m;
  while ((m = re.exec(src))) {
    const ini = m.index + m[0].length;
    out += src.slice(ultimo, m.index);
    if (src[ini] === '"') {
      const fin = src.indexOf('"', ini + 1);
      const nuevo = grupo("atributo", src.slice(ini + 1, fin), false, undefined, etiquetaDe(src, m.index));
      // Si solo quedan clases ajenas, vuelve a ser un literal (`className="x"`), no `className={"x"}`.
      out += nuevo === null ? src.slice(m.index, fin + 1) : nuevo === "" ? "" : /^"[^"\\]*"$/.test(nuevo) ? `className=${nuevo}` : `className={${nuevo}}`;
      ultimo = fin + 1;
    } else if (src[ini] === "{") {
      const etiqueta = etiquetaDe(src, m.index);
      const r = escanearExpr(src, ini + 1, (t, d, c, o) => grupo(t, d, c, o, etiqueta));
      out += `className={${r.out}}`;
      ultimo = r.fin + 1;
    } else {
      out += m[0];
      ultimo = ini;
    }
    re.lastIndex = ultimo;
  }
  return out + src.slice(ultimo);
}
// Los grupos de clases que hay en un fuente, como listas de palabras (para saber qué clases usa y con cuáles convive).
// Clases que algún `className` pone solo a veces (estados: `compactSearchIntro`, `mobileOpen`…). Una regla `.estado .hijo` no
// puede darse por siempre cierta aunque la clase sea del mismo componente.
const condicionales = new Set();
const etiquetasPorClase = new Map(); // clase → etiquetas de los elementos que la llevan
function gruposDe(src) {
  const gs = [];
  reescribirClassNames(src, (tipo, datos, condicional, _originales, etiqueta) => {
    const g = tipo === "plantilla" ? datos.join(" ").split(/\s+/).filter(Boolean) : datos.split(/\s+/).filter(Boolean);
    if (condicional) for (const t of g) condicionales.add(t);
    for (const t of g) {
      if (!etiquetasPorClase.has(t)) etiquetasPorClase.set(t, new Set());
      etiquetasPorClase.get(t).add(etiqueta ?? "");
    }
    gs.push(g);
    return null;
  });
  return gs;
}
const gruposPorFichero = new Map([...fuentes].map(([r, src]) => [r, gruposDe(src)]));
const usoPorFichero = new Map(); // clase → ficheros que la usan
const usadas = new Set();
for (const [r, gs] of gruposPorFichero) {
  for (const g of gs) {
    for (const t of g) {
      if (!propias.has(t) || /[:[/]/.test(t)) continue;
      usadas.add(t);
      if (!usoPorFichero.has(t)) usoPorFichero.set(t, new Set());
      usoPorFichero.get(t).add(r);
    }
  }
}
const compartida = (c) => (usoPorFichero.get(c)?.size ?? 0) > 1;
// Cuántas veces aparece una clase en los `className`. Si una clase se usa una sola vez, una regla
// `.padre > .clase` equivale a `.clase`: el padre siempre es ese elemento.
function vecesUsada(c) {
  let n = 0;
  for (const gs of gruposPorFichero.values()) for (const g of gs) if (g.includes(c)) n++;
  return n;
}


// Fuentes que NO se reescriben (`lib`, helpers .ts…): si alguna cita la clase, no se puede migrar. Con la migración de un
// solo componente también cuentan los demás .tsx (la clase es compartida y se deja).
const todoSrc = [...ficheros("app", [".tsx", ".ts"]), ...ficheros("lib", [".ts", ".tsx"])].filter((f) => !fuentes.has(rutaNorm(f)));
// Con `--todo` solo cuentan los .ts que pueden fabricar o buscar clases: palabras como `error`, `ok` o `user` aparecen en
// cualquier ruta del servidor y no son clases.
const textosOtros = todoSrc
  .map((f) => readFileSync(join(RAIZ, f), "utf-8"))
  .filter((t) => !t.includes("Generado por scripts/migrar-a-tailwind.mjs"))
  .filter((t) => !todo || /className|classList|querySelector|\.closest\(/.test(t))
  .join("\n");
const usaOtro = (c) => new RegExp(`(?<![\\w-])${c}(?![\\w-])`).test(textosOtros);

const objetivo = new Set([...usadas].filter((c) => (!usaOtro(c) || forzarClases.has(c)) && !excluirClases.includes(c)));
for (const c of extraClases) objetivo.add(c);

// Clases con reglas sobre clases AJENAS (`.x > .otraClase`): migrarlas a medias cambiaría qué regla gana sobre esa clase
// ajena (las utilidades van en una capa por encima del CSS histórico), así que se conservan tal cual, sin migrar.
// Con `--todo`, una clase que no aparece en NINGÚN fuente (ni su prefijo armado en ejecución) está muerta: sus reglas no
// pueden aplicarse nunca, así que ni se migran ni obligan a conservar a las demás.
// (`S.x` y `C.x` son entradas ya migradas, no clases en el DOM.)
const todosLosTextos = [...fuentes.values(), textosOtros].join("\n").replace(/\b[SC]\.[A-Za-z_]\w*/g, " ").replace(/\b[SC]\["[^"]*"\]/g, " ");
const escaparRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const apareceClase = (k) => new RegExp(`(?<![\\w-])${escaparRe(k)}(?![\\w-])`).test(todosLosTextos);
// Una clase armada en ejecución (`faseToast-${tipo}`) no aparece entera: se detecta por un prefijo seguido de `${`.
const armadaEnEjecucion = (k) => {
  const partes = k.match(/[A-Za-z][a-z0-9]*|\d+|-/g) ?? [];
  let prefijo = "";
  return partes.slice(0, -1).some((p) => {
    prefijo += p;
    return prefijo.length >= 3 && new RegExp(`[\`"'\\s(]${escaparRe(prefijo)}(\\$\\{|["']\\s*\\+)`).test(todosLosTextos);
  });
};
const vivaCache = new Map();
const viva = (k) => {
  if (!todo || objetivo.has(k) || ENVOLTORIOS.has(k)) return true;
  if (!vivaCache.has(k)) vivaCache.set(k, apareceClase(k) || armadaEnEjecucion(k));
  return vivaCache.get(k);
};
const conservadas = new Map(); // clase → regla que obligó a conservarla
(function conservar() {
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const r of reglasTodas) {
      for (const selBruto of dividir(r.sel, ",").flatMap(expandirIs)) {
        const sel = selBruto.replace(/\s+/g, " ").trim();
        const comps = compuestos(sel);
        if (clasesPositivas(sel).some((k) => !viva(k))) continue;
        let idx = -1;
        comps.forEach((c, i) => {
          if (clasesPositivas(c.txt).some((k) => objetivo.has(k))) idx = i;
        });
        if (idx < 0 || idx === comps.length - 1) continue;
        const sujeto = comps[comps.length - 1];
        const ajenas = clasesPositivas(sujeto.txt).filter((k) => !objetivo.has(k) && !ENVOLTORIOS.has(k));
        if (!ajenas.length) continue;
        for (const k of clasesPositivas(comps[idx].txt)) {
          if (objetivo.has(k)) {
            objetivo.delete(k);
            conservadas.set(k, sel);
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
    for (const selBruto of dividir(r.sel, ",").flatMap(expandirIs)) {
      const sel = selBruto.replace(/\s+/g, " ").trim();
      if (clasesPositivas(sel).some((k) => !viva(k))) continue;
      const comps = compuestos(sel);
      // La dueña es el compuesto migrado MÁS A LA DERECHA: es el elemento al que se aplican los estilos. Los
      // antecesores migrados son contenedores que siempre están donde vive la clase (son clases de la misma página).
      let idx = -1;
      comps.forEach((c, i) => {
        if (clasesPositivas(c.txt).some((k) => objetivo.has(k))) idx = i;
      });
      if (idx < 0) continue;
      const dueño = comps[idx];
      const objetivos = clasesPositivas(dueño.txt).filter((k) => objetivo.has(k));
      // Con `--todo` las clases migradas siguen en el DOM como marcador cuando alguna utilidad las nombra, así que `.a.b`
      // se resuelve como `a` con la variante `[&.b]`.
      if (objetivos.length > 1 && !todo) {
        manual.push(`selector con dos clases migradas en el mismo elemento: ${sel}`);
        continue;
      }
      const nombre = objetivos[0];
      const antes = comps.slice(0, idx);
      const resto = comps.slice(idx + 1);

      // Un antecesor se puede ignorar si es un contenedor que siempre está donde vive la clase. Migrando un componente,
      // son los envoltorios y sus clases exclusivas. Con `--todo` una clase compartida vive en sitios muy distintos, así
      // que sus antecesores son condiciones de verdad (`[.padre_&]`); solo se ignoran en una exclusiva, y solo los
      // envoltorios o las exclusivas del mismo fichero.
      const siempre = (k) => {
        if (!todo) return ENVOLTORIOS.has(k) || objetivo.has(k);
        if (k === "tw") return true;
        if (condicionales.has(k)) return false;
        if (compartida(nombre)) return false;
        if (ENVOLTORIOS.has(k)) return true;
        return objetivo.has(k) && !compartida(k) && [...(usoPorFichero.get(k) ?? [])][0] === [...(usoPorFichero.get(nombre) ?? [])][0];
      };
      // Con `--todo`, si la regla apunta a un descendiente (`.a .b input`) los antecesores NO se funden: la utilidad
      // `[.a_.b_&_input]` conserva la especificidad de la original, y es lo que decide contra la de otra clase que apunta al
      // mismo `input` (`.legalWorkspace input`). Sin ellos las dos empatan y gana la que Tailwind ordene después.
      const conservarRuta = todo && resto.length > 0;
      const ignorable = (c) => !conservarRuta && c.txt.replace(/\.[\w-]+/g, "") === "" && clasesPositivas(c.txt).every(siempre);
      let varAnt = "";
      // «Hijo directo de una clase migrada» no se puede conservar (esa clase desaparece): se deja para hacerlo a mano.
      const ultimo = antes[antes.length - 1];
      if (!todo && ultimo && /[>+~]/.test(ultimo.comb) && clasesPositivas(ultimo.txt).some((k) => objetivo.has(k)) && vecesUsada(nombre) !== 1) {
        manual.push(`relación directa (${ultimo.comb}) con una clase migrada: ${sel}`);
        continue;
      }
      const reales = antes.filter((c) => !ignorable(c));
      if (reales.length) {
        // Si no se ha ignorado ninguno se conserva el camino exacto; si no, los que quedan se tratan como antecesores
        // (los ignorados son contenedores migrados o envoltorios, que siempre están).
        varAnt = citarAtributos(reales.length === antes.length ? `[${antes.map((c) => c.txt + sep(c.comb)).join("")}&]` : `[${reales.map((c) => c.txt + "_").join("")}&]`);
      }

      // Estado del propio elemento (`:hover`, `[open]`, `:has(…)`) y, si lo hay, camino a un descendiente.
      const propioBruto = dueño.txt.replace(new RegExp(`\\.${nombre}(?![\\w-])`), "");
      // `button.clase`: la etiqueta va pegada a la clase y se expresa como `[button&…]`.
      const etiqueta = propioBruto.match(/^[a-z][a-z0-9-]*/i)?.[0] ?? "";
      const propio = etiqueta ? propioBruto.slice(etiqueta.length) : propioBruto;
      const cola = resto.length ? sep(dueño.comb) + resto.map((c, i) => c.txt + (i < resto.length - 1 ? sep(c.comb) : "")).join("") : "";
      const sinComillas = (t) => citarAtributos(t);
      const varPropio = [];
      if (cola) {
        varPropio.push(`[${etiqueta}&${esc(sinComillas(propio))}${esc(sinComillas(cola)).replace(/^_(?=[>+~])/, "")}]`);
      } else if (etiqueta) {
        varPropio.push(`[${etiqueta}&${esc(sinComillas(propio))}]`);
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
      const rango = /^app\/(styles|base)\.css$/.test(r.archivo.replace(/\\/g, "/")) ? 0 : 1;
      // Dentro de `.tw`, el reset `border: 0 solid` (capa `tw-base`) va POR ENCIMA de la capa `legacy`: los bordes que
      // declara styles.css no se ven hoy. Se descartan para que migrar no los resucite (usa --sin-tw si el componente
      // no está dentro de un contenedor `.tw`).
      const BORDES = /^border(-(top|right|bottom|left))?(-(width|style|color))?$/;
      // Igual con la fuente: `.tw button { font: inherit }` (capa `tw-base`) gana a lo que styles.css diga de font-* y
      // line-height en un botón o campo. Se indica por clase (`--sin-fuente=a,b`) porque desde el CSS no se sabe qué
      // elemento lleva cada clase.
      const FUENTE = /^(font(-size|-weight|-style|-family)?|line-height)$/;
      let declVisibles = rango === 0 && !args.includes("--sin-tw") ? decl.filter((d) => !BORDES.test(d.prop)) : decl;
      if (rango === 0 && sinFuente.has(nombre)) declVisibles = declVisibles.filter((d) => !FUENTE.test(d.prop));
      // Lo mismo con `.tw button { background:none; color:inherit; cursor:pointer; font:inherit }` y `.tw input,select,textarea
      // { color:inherit; font:inherit }` (capa tw-base, por encima de legacy): lo que styles.css decía de eso en un botón o un
      // campo no se veía. La etiqueta sale del selector (`.panel button`) o, si no, de los elementos que llevan la clase.
      if (todo && rango === 0) {
        const FUENTE_TODA = "font(-size|-weight|-style|-family)?|line-height";
        const RESET = {
          button: new RegExp(`^(background(-color|-image)?|color|cursor|${FUENTE_TODA})$`),
          input: new RegExp(`^(color|${FUENTE_TODA})$`),
        };
        RESET.select = RESET.input;
        RESET.textarea = RESET.input;
        const etiquetas = resto.length ? [resto[resto.length - 1].txt.match(/^[a-z][a-z0-9]*/)?.[0]].filter(Boolean) : [...(etiquetasPorClase.get(nombre) ?? [])];
        if (etiquetas.length && etiquetas.every((t) => RESET[t])) declVisibles = declVisibles.filter((d) => !etiquetas.every((t) => RESET[t].test(d.prop)));
      }
      // `--tw-condicional`: en vez de adivinar si el elemento está dentro de `.tw` (hay `.tw` anidados, y una regla `.padre a`
      // puede apuntar a enlaces dentro de un `.tw` aunque `.padre` esté fuera), lo que el reset de `.tw` anulaba se escribe
      // con una condición que el navegador evalúa elemento a elemento: `fuera-tw:border` solo se aplica fuera
      // de `.tw`, exactamente como antes. `:where()` no suma especificidad, así que la cascada no cambia.
      if (twCondicional && rango === 0) {
        const BOTON = /^(background(-color|-image)?|cursor)$/;
        const TEXTO = /^(color|font(-size|-weight|-style|-family)?|line-height|font)$/;
        // Variantes declaradas en app/tailwind.css (`@custom-variant fuera-tw …`).
        const COND = { borde: "fuera-tw", boton: "fuera-tw-boton", texto: "fuera-tw-texto" };
        // El reset de botones y campos solo alcanza a esas etiquetas: si se sabe que la regla apunta a otra cosa (un `span`, un
        // `div`), su color y su fuente se aplican siempre y no hace falta la condición. Se mira la etiqueta del selector
        // (`.panel button`), la de los elementos que llevan la clase de destino, y un componente (`<Button>`) cuenta como botón.
        const ultimo = resto.length ? resto[resto.length - 1].txt : "";
        const tagSel = ultimo.match(/^[a-z][a-z0-9]*/)?.[0];
        const claseSel = ultimo.match(/^\.([A-Za-z_][\w-]*)/)?.[1];
        const etiquetasDestino = tagSel ? [tagSel] : [...(etiquetasPorClase.get(resto.length ? claseSel ?? "" : nombre) ?? [])];
        const comoHtml = (t) => (/^(Icon)?Button$/.test(t) ? "button" : /^(Input|Select|Textarea)$/.test(t) ? t.toLowerCase() : /^[A-Z]/.test(t) || !t ? null : t);
        const htmls = etiquetasDestino.map(comoHtml);
        const puede = (tags) => !htmls.length || htmls.some((t) => t === null || tags.includes(t));
        const puedeBoton = puede(["button"]);
        const puedeCampo = puede(["button", "input", "select", "textarea"]);
        const grupos = { normal: [], borde: [], boton: [], texto: [] };
        for (const d of decl) {
          const g = BORDES.test(d.prop) ? "borde" : BOTON.test(d.prop) && puedeBoton ? "boton" : TEXTO.test(d.prop) && puedeCampo ? "texto" : "normal";
          grupos[g].push(d);
        }
        const comun = { apply: [], spec: especificidad(sel), orden: r.orden, rango, sel, archivo: r.archivo };
        porDueña.get(nombre).push({ ...comun, variantes, decl: grupos.normal, declCompleta: grupos.normal, apply });
        for (const g of ["borde", "boton", "texto"]) {
          if (grupos[g].length) porDueña.get(nombre).push({ ...comun, variantes: [...variantes, COND[g]], decl: grupos[g], declCompleta: grupos[g] });
        }
        continue;
      }
      porDueña.get(nombre).push({ variantes, decl: declVisibles, declCompleta: decl, apply, spec: especificidad(sel), orden: r.orden, rango, sel, archivo: r.archivo });
    }
  }
  return porDueña;
}

const porDueña = asignar();

// Pares «antecesora>descendiente» de clases propias según el árbol JSX de cada componente (con el compilador de TypeScript).
// No ve el anidamiento entre componentes distintos (un hijo que se pinta dentro del contenedor de otro fichero).
function anidamientoJsx() {
  const pares = new Set();
  const textos = (nodo, out) => {
    if (ts.isStringLiteral(nodo) || ts.isNoSubstitutionTemplateLiteral(nodo)) out.push(nodo.text);
    else if (ts.isTemplateExpression(nodo)) { out.push(nodo.head.text); for (const s of nodo.templateSpans) out.push(s.literal.text); }
    ts.forEachChild(nodo, (h) => textos(h, out));
    return out;
  };
  for (const [ruta, src] of fuentes) {
    const sf = ts.createSourceFile(ruta, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visitar = (nodo, pila) => {
      let siguiente = pila;
      const apertura = ts.isJsxElement(nodo) ? nodo.openingElement : ts.isJsxSelfClosingElement(nodo) ? nodo : null;
      if (apertura) {
        const attr = apertura.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === "className");
        const aqui = attr?.initializer ? [...new Set(textos(attr.initializer, []).flatMap((t) => t.split(/\s+/)).filter((c) => propias.has(c)))] : [];
        for (const c of aqui) for (const a of pila) if (a !== c) pares.add(`${a}>${c}`);
        if (aqui.length) siguiente = [...pila, ...aqui];
      }
      ts.forEachChild(nodo, (h) => visitar(h, siguiente));
    };
    visitar(sf, []);
  }
  return pares;
}

// Empates entre CONTENEDORES distintos. `.documentItem span` y `.documentQuality span` tienen la misma especificidad y, en la
// página, uno va dentro del otro: ganaba la regla posterior en el CSS. Cada una acaba en la entrada de su contenedor y el
// resolvedor, que mira un elemento cada vez, no las ve competir (las etiquetas de calidad de Documentos cambiaron de color). Aquí
// se buscan entre todas las reglas las que apuntan al mismo descendiente con las mismas condiciones, la misma propiedad y la
// misma especificidad: la posterior lleva un escalón por cada contenedor anterior (ver `peldano` en el resolvedor).
if (twCondicional) {
  const esDescendiente = (v) => /^\[[a-z]*&/.test(v) && /[_>+~]/.test(v.replace(/\([^)]*\)/g, "").replace(/^\[[a-z]*&/, ""));
  const grupos = new Map();
  for (const [dueña, reglas] of porDueña) {
    for (const r of reglas) {
      if (r.rango !== 0 || !r.variantes.some(esDescendiente)) continue;
      for (const d of expandir(r.decl)) {
        for (const u of utilidad(d.prop, d.valor, null)) {
          for (const sl of ranuras(u)) {
            const k = `${r.variantes.join("|")}#${sl}#${r.spec}`;
            if (!grupos.has(k)) grupos.set(k, []);
            grupos.get(k).push({ dueña, r, sl });
          }
        }
      }
    }
  }
  // Solo compiten contenedores que están uno dentro del otro en el JSX de algún componente. «Se usan en el mismo fichero» era
  // demasiado amplio: en los componentes grandes encadenaba hasta 18 escalones, y cada escalón de más puede adelantar a una
  // regla que tenía un selector de etiqueta más y debía ganar.
  const pares = anidamientoJsx();
  const juntas = (a, b) => pares.has(`${a}>${b}`) || pares.has(`${b}>${a}`);
  for (const lista of grupos.values()) {
    if (new Set(lista.map((x) => x.dueña)).size < 2) continue;
    lista.sort((a, b) => a.r.orden - b.r.orden);
    // Nivel = uno más que el más alto de los contenedores anteriores con los que convive: así la posterior supera a todas las
    // que tenía delante aunque entre ellas no se crucen (A con B y B con C: C queda por encima de B, que ya estaba sobre A).
    const nivel = new Map();
    for (const { dueña, r, sl } of lista) {
      let n = nivel.get(dueña) ?? 0;
      for (const [d, k] of nivel) if (d !== dueña && juntas(d, dueña)) n = Math.max(n, k + 1);
      nivel.set(dueña, n);
      if (n) {
        if (!r.escalonDescendiente) r.escalonDescendiente = new Map();
        r.escalonDescendiente.set(sl, Math.max(n, r.escalonDescendiente.get(sl) ?? 0));
      }
    }
  }
}

function expandir(decl) {
  const out = [];
  const lados = (prefijo, v) => {
    const p = dividir(v, " ");
    const [t, r, b, l] = p.length === 1 ? [p[0], p[0], p[0], p[0]] : p.length === 2 ? [p[0], p[1], p[0], p[1]] : p.length === 3 ? [p[0], p[1], p[2], p[1]] : p;
    return [[`${prefijo}-top`, t], [`${prefijo}-right`, r], [`${prefijo}-bottom`, b], [`${prefijo}-left`, l]];
  };
  for (const d of decl) {
    if (d.prop === "padding" || d.prop === "margin") for (const [p, v] of lados(d.prop, d.valor)) out.push({ prop: p, valor: v, imp: d.imp });
    // `font: inherit; line-height: 1.5` en una regla: en CSS la segunda pisa la parte de la primera. Como dos utilidades
    // (`[font:inherit]` y `leading-[1.5]`) el orden lo pone Tailwind, y la abreviatura se comía la altura de línea (los campos
    // de notas de Guardado y Evaluación). Descompuesta en sus propiedades, la posterior sustituye a la anterior aquí mismo.
    else if (d.prop === "font" && /^(inherit|initial|unset)$/.test(d.valor.trim())) {
      for (const p of ["font-family", "font-size", "font-weight", "font-style", "line-height"]) out.push({ prop: p, valor: d.valor.trim(), imp: d.imp });
    }
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
  // Una propiedad arbitraria (`[font-weight:var(--peso-medio)]`) fija lo mismo que su utilidad con nombre (`font-bold`): si
  // no comparten ranura, el resolvedor deja las dos y gana la que Tailwind ponga después (en Historial, 100 etiquetas perdieron
  // la negrita). Se traducen a las mismas ranuras que usan las demás.
  if ((m = b.match(/^\[([a-z-]+):/))) {
    const MISMA = new Set(["font-size", "font-weight", "font-style", "font-family", "line-height", "letter-spacing", "color", "text-transform", "text-align", "white-space", "overflow-wrap", "word-break", "display", "position", "cursor", "opacity", "z-index", "box-shadow", "overflow-x", "overflow-y", "flex-direction", "flex-wrap", "align-items", "align-self", "justify-content", "justify-items", "justify-self", "grid-template-columns", "grid-template-rows", "grid-column", "top", "left", "right", "bottom", "resize"]);
    const p = m[1];
    if (MISMA.has(p)) return [p];
    if (p === "background-color") return ["bg-color"];
    if (p === "background") return ["bg-color", "bg-image"];
    if (p === "background-image") return ["bg-image"];
    if (p === "place-items") return ["align-items", "justify-items"];
    if (p === "overflow") return ["overflow-x", "overflow-y"];
    if (p === "border-color") return ["bc-t", "bc-r", "bc-b", "bc-l"];
    if (p === "border-radius") return ["r-tl", "r-tr", "r-bl", "r-br"];
    if (p === "width" || p === "height" || p === "min-width" || p === "min-height" || p === "max-width" || p === "max-height") return [{ width: "w", height: "h", "min-width": "min-w", "min-height": "min-h", "max-width": "max-w", "max-height": "max-h" }[p]];
    return [`arb:${p}`];
  }
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

// `[&:nth-child(2)]` → ["nth-child", "2"]; `[&[data-tone='ok']]` → ["data-tone", "ok"]. Lo demás, null.
function claveCondicion(v) {
  let m = v.match(/^\[&:(nth-child|nth-of-type|nth-last-child)\(([^)]+)\)\]$/);
  if (m) return [m[1], m[2]];
  m = v.match(/^\[&\[([\w-]+)=['"]?([^'"\]]+)['"]?\]\]$/);
  return m ? [m[1], m[2]] : null;
}
function excluyentes(a, b) {
  const ka = [...a].map(claveCondicion).filter(Boolean);
  const kb = [...b].map(claveCondicion).filter(Boolean);
  return ka.some(([k, v]) => kb.some(([k2, v2]) => k === k2 && v !== v2));
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
      const objetivoVar = [...vars].find((v) => /^\[[a-z]*&/.test(v) && /[_>+~]/.test(v.replace(/\([^)]*\)/g, "").replace(/^\[[a-z]*&/, ""))) ?? "";
      const conds = new Set([...vars].filter((v) => v !== objetivoVar));
      const slots = ranuras(util);
      const glob = Math.max(0, ...slots.map((sl) => r.escalonDescendiente?.get(sl) ?? 0));
      tokens.push({ cls: prefijo + util, conds, objetivoVar, slots, prec, rango: r.rango, spec: r.spec, glob });
    }
  });
  // Una utilidad queda anulada si otra de mayor precedencia, que se aplica SIEMPRE que ella (sus condiciones son un
  // subconjunto de las de la primera), fija todas sus propiedades. Así una regla de `@media` con poca especificidad
  // no pisa a una base más específica, que era lo que ocurría en el CSS original.
  const vivos = tokens.filter((t) => {
    // Las propiedades de `t` que ya fijan, entre todas, utilidades de mayor precedencia que se aplican siempre que `t`.
    const cubiertas = new Set();
    for (const u of tokens) {
      if (u.prec > t.prec && u.objetivoVar === t.objetivoVar && [...u.conds].every((v) => t.conds.has(v))) for (const sl of u.slots) cubiertas.add(sl);
    }
    return !t.slots.every((sl) => cubiertas.has(sl));
  });
  // Una regla SIN capa (rango 1: legal-workspace.css, workspace.css…) ganaba a todo lo que estuviera en una capa, utilidades
  // incluidas, aunque tuviera menos especificidad. Las utilidades están en una capa, así que lo que viene de ahí lleva `!` para
  // seguir ganando a las que vienen de styles.css (capa legacy) y a las escritas a mano. Solo con `--todo`, que es donde
  // conviven en un mismo elemento clases de uno y otro origen.
  // Empates. Dos reglas del mismo elemento con la MISMA especificidad y condiciones distintas (`.evalStats .statCard` y
  // `.statCard:nth-child(2)`) se desempataban por el orden del CSS: ganaba la posterior. Como utilidades, el orden lo pone
  // Tailwind (las tarjetas de Evaluación perdieron su borde de color). La posterior lleva `[html_&]`, que solo le suma un
  // selector de etiqueta: gana a su pareja y sigue perdiendo frente a lo que ya tenía más especificidad. Con varias en
  // cadena, un escalón por cada una (`[html_body_&]`).
  const escalon = new Map();
  if (todo) {
    for (const u of vivos) {
      let n = u.glob ?? 0;
      for (const t of vivos) {
        if (t.prec >= u.prec || t.spec !== u.spec || t.rango !== u.rango || t.objetivoVar !== u.objetivoVar) continue;
        if (!t.slots.some((sl) => u.slots.includes(sl))) continue;
        // Si todas las condiciones de la anterior están también en la posterior (base frente a `max-[640px]:`), Tailwind ya
        // escribe la posterior detrás y gana sola: el escalón sobraría y, peor, la subiría por encima de reglas que tenían un
        // selector de etiqueta más (`.x div { gap: 3px }` dejó de ganar a la @media de `.sourceActions` en Documentos).
        if ([...t.conds].every((v) => u.conds.has(v))) continue;
        // Condiciones que no pueden cumplirse a la vez (`:nth-child(2)` y `:nth-child(3)`, `[data-tone='ok']` y `='warn'`): no compiten.
        if (excluyentes(t.conds, u.conds)) continue;
        n = Math.max(n, (escalon.get(t) ?? 0) + 1);
      }
      if (n) escalon.set(u, n);
    }
  }
  // Cada escalón suma un selector de etiqueta (0,0,1): `html`, `html body` y, a partir del tercero, `:is(body)` repetido, que
  // también vale (0,0,1) y siempre se cumple.
  const peldano = (k) => (!k ? "" : k === 1 ? "[html_&]:" : `[html_body${":is(body)".repeat(k - 2)}_&]:`);
  // `legado:` (app/tailwind.css) mete la utilidad en la subcapa `utilities.legado`. Lo que viene de styles.css estaba en la capa
  // `legacy`, por DEBAJO de cualquier utilidad: una regla `.historyTabs button {color: muted}` perdía frente al `text-ink` que el
  // botón llevaba escrito a mano, tuviera la especificidad que tuviera. Como utilidad normal ganaba ella (Historial cambió de
  // peso y color en 100 etiquetas). En la subcapa vuelve a perder frente a las utilidades escritas a mano y, entre sí, las
  // heredadas siguen ordenándose por especificidad, como antes. Lo de los CSS sin capa (rango 1) no va ahí: lleva `!`.
  const capa = (t) => (twCondicional && t.rango === 0 ? "legado:" : "");
  return [...new Set(vivos.map((t) => {
    const cls = capa(t) + peldano(escalon.get(t) ?? 0) + t.cls;
    return todo && t.rango === 1 && !cls.endsWith("!") ? cls + "!" : cls;
  }))];
}


// ───────────────────────── salida ─────────────────────────

// Utilidades de cada clase por separado.
const sueltas = new Map();
for (const c of [...objetivo].sort()) {
  const reglas = porDueña.get(c) ?? [];
  sueltas.set(c, marcarImportante(c, reglas.length ? resolver(reglas) : []));
}

// Marcadores. Una utilidad puede nombrar OTRA clase (`[.padre_&]:p-2`, `[&_.hijo]:flex`, `[&.b]:…`): esa clase tiene que
// seguir en el DOM aunque ya no tenga CSS, así que su entrada lleva su propio nombre como palabra suelta. Solo con `--todo`.
// Ojo: en una variante el `_` es un espacio (`[.padre_.hijo_&]`), y `\w` lo incluye: `.padre_` no es una clase. Se quita el
// `_` final y, si aun así no es una clase propia, se toma lo que va antes del primer `_` (`.padre_p_` → `padre`).
const citadas = (texto) =>
  [...texto.matchAll(/\.([A-Za-z][\w-]*)/g)].flatMap((m) => {
    const k = m[1].replace(/_+$/, "");
    if (propias.has(k)) return [k];
    const primero = k.split("_")[0];
    return propias.has(primero) ? [primero] : [];
  });
const referenciadas = new Set(marcarClases);
if (todo) {
  for (const cl of sueltas.values()) for (const t of cl) for (const k of citadas(t)) referenciadas.add(k);
  // Y lo que ya nombraban los módulos generados antes (componentes migrados en otra pasada).
  for (const f of [...ficheros("app", [".ts"])].filter((x) => /-estilos\.ts$|estilos-comunes\.ts$/.test(x))) {
    const t = readFileSync(join(RAIZ, f), "utf-8");
    if (t.includes("Generado por scripts/migrar-a-tailwind.mjs")) for (const k of citadas(t)) referenciadas.add(k);
  }
}
const marcador = (c) => todo && referenciadas.has(c);
const tieneEntrada = (c) => sueltas.get(c).length > 0 || marcador(c);

// Registro de entradas: destino "C" (módulo común) o la ruta del fichero cuyo `S` la contiene.
const registro = new Map(); // destino → Map(clave → cadena)
const memo = new Map();
// Elementos con VARIAS clases migradas (`className="a b"`): en el CSS original qué regla gana entre ellas se decidía por
// precedencia (capa, especificidad, orden). Migradas por separado esa decisión se perdería (gana la que el CSS final ponga
// al último), así que se resuelven juntas y se escriben como una sola entrada `a_b`.
function entrada(miembros, fuera = false) {
  const clave = miembros.join("_") + (fuera ? "_fueraTw" : "");
  if (memo.has(clave)) return memo.get(clave);
  // Fuera de `.tw` valen las declaraciones completas (bordes, fondo, color de los botones); dentro, las ya filtradas.
  const reglasDe = (k) => (porDueña.get(k) ?? []).map((r) => (fuera ? { ...r, decl: r.declCompleta } : r));
  const cl = miembros.length === 1 && !fuera ? sueltas.get(miembros[0]) : miembros.reduce((acc, k) => marcarImportante(k, acc), resolver(miembros.flatMap(reglasDe)));
  const propietarias = miembros.filter((k) => !compartida(k));
  const destino = propietarias.length === 0 && todo ? "C" : [...usoPorFichero.get(propietarias[0] ?? miembros[0])][0];
  const e = { clave, destino, texto: [...miembros.filter(marcador), ...cl].join(" ") };
  if (!registro.has(destino)) registro.set(destino, new Map());
  registro.get(destino).set(clave, e.texto);
  memo.set(clave, e);
  return e;
}

const stemDe = (ruta) => basename(ruta).replace(/\.tsx$/, "");
const rutaEstilos = (ruta) => rutaNorm(join(dirname(ruta), `${stemDe(ruta)}-estilos.ts`));
const RUTA_COMUN = "app/components/estilos-comunes.ts";
const ident = (c) => /^[A-Za-z_$][\w$]*$/.test(c);

const restos = [];

// Reescritura de un .tsx. Devuelve el texto nuevo y qué módulos hay que importar.
function reescribirFichero(ruta, src) {
  const usa = { S: false, C: false, cn: false };
  const refer = (e) => {
    const o = e.destino === "C" ? "C" : "S";
    usa[o] = true;
    return ident(e.clave) ? `${o}.${e.clave}` : `${o}[${JSON.stringify(e.clave)}]`;
  };
  const miembrosDe = (palabras) => [...new Set(palabras.filter((t) => objetivo.has(t) && tieneEntrada(t)))].sort();
  const grupo = (tipo, datos, _condicional, originales = []) => {
    if (tipo === "plantilla") {
      // Texto fijo de una plantilla: los trozos pegados a un `${…}` (`msg-${rol}`) son parciales y no se tocan. Salvo que sean
      // una clase propia entera y el `${…}` vecino aporte otra clase separada por un espacio (`intro${x ? " compacta" : ""}`).
      const separado = (expr) => /["'`]\s|\s["'`]/.test(expr ?? "");
      const info = datos.map((trozo, k) =>
        trozo.split(/(\s+)/).map((t, i, arr) => {
          if (i % 2 === 1) return { t, esp: true, parcial: false };
          const pegadoAntes = i === 0 && k > 0 && !/^\s/.test(trozo) && !(propias.has(t) && separado(originales[k - 1]));
          const pegadoDespues = i === arr.length - 1 && k < datos.length - 1 && !/\s$/.test(trozo) && !(propias.has(t) && separado(originales[k]));
          return { t, esp: false, parcial: pegadoAntes || pegadoDespues };
        }),
      );
      const completas = info.flatMap((fila) => fila.filter((x) => !x.esp && !x.parcial && x.t).map((x) => x.t));
      if (!completas.some((t) => objetivo.has(t))) return null;
      const miembros = miembrosDe(completas);
      const fuera = fueraDeTw(completas);
      let puesto = false;
      return info.map((fila) => {
        const txt = fila
          .map((x) => {
            if (x.esp || x.parcial || !objetivo.has(x.t)) return x.t;
            if (!tieneEntrada(x.t)) return "";
            if (miembros.length > 1) {
              if (puesto) return "";
              puesto = true;
              return "${" + refer(entrada(miembros, fuera)) + "}";
            }
            return "${" + refer(entrada([x.t], fuera)) + "}";
          })
          .join("");
        return txt.replace(/[ \t]{2,}/g, " ");
      });
    }
    const toks = datos.split(/\s+/).filter(Boolean);
    if (!toks.some((t) => objetivo.has(t))) return null;
    const miembros = miembrosDe(toks);
    const fuera = fueraDeTw(toks);
    let puesto = false;
    const partes = [];
    let fijo = [];
    const volcar = () => {
      if (fijo.length) partes.push(JSON.stringify(fijo.join(" ")));
      fijo = [];
    };
    for (const t of toks) {
      if (!objetivo.has(t)) { fijo.push(t); continue; }
      if (!tieneEntrada(t)) continue;
      if (miembros.length > 1) {
        if (puesto) continue;
        puesto = true;
        volcar();
        partes.push(refer(entrada(miembros, fuera)));
      } else {
        volcar();
        partes.push(refer(entrada([t], fuera)));
      }
    }
    volcar();
    if (!partes.length) return tipo === "atributo" ? "" : '""';
    // `" abierto"` se pega a lo que va delante en una plantilla: el espacio de los extremos hay que conservarlo.
    const conEspacios = (codigo) => (tipo === "literal" ? `${/^\s/.test(datos) ? '" " + ' : ""}${codigo}${/\s$/.test(datos) ? ' + " "' : ""}` : codigo);
    if (partes.length === 1) return /^\s|\s$/.test(datos) && tipo === "literal" ? `(${conEspacios(partes[0])})` : partes[0];
    usa.cn = true;
    return /^\s|\s$/.test(datos) && tipo === "literal" ? `(${conEspacios(`cn(${partes.join(", ")})`)})` : `cn(${partes.join(", ")})`;
  };
  const nuevo = reescribirClassNames(src, grupo);

  // Clases migradas que el código cita fuera de un `className` (selectores, variables que luego van a un className…).
  // Un literal formado solo por palabras de clase y que contiene alguna migrada es sospechoso.
  nuevo.split(/\r?\n/).forEach((lineaOriginal, n) => {
    if (/^\s*(import |\/\/|\*|\{\/\*)/.test(lineaOriginal)) return;
    // `S["aviso--error"]` es una entrada ya migrada, no una clase suelta.
    const linea = lineaOriginal.replace(/\b[SC]\["[^"]*"\]/g, " ");
    for (const m of linea.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
      const t = m[2];
      if (!t || t.length > 120 || !/^[\w:\-./\[\]#, >]+$/.test(t)) continue;
      const hit = t.split(/[\s.,>#]+/).filter((w) => objetivo.has(w) && tieneEntrada(w));
      if (hit.length) restos.push(`${ruta}:${n + 1} ${[...new Set(hit)].join(",")}  ← ${linea.trim().slice(0, 90)}`);
    }
  });
  return { nuevo, usa };
}

const resultadoFicheros = new Map();
for (const [ruta, src] of fuentes) {
  const { nuevo, usa } = reescribirFichero(ruta, src);
  if (nuevo !== src) resultadoFicheros.set(ruta, { nuevo, usa });
}

// ───────────────────────── escritura ─────────────────────────

const claseSinReglas = [...sueltas].filter(([c, cl]) => cl.length === 0 && !marcador(c)).map(([c]) => c);
const nCompartidas = [...objetivo].filter(compartida).length;
console.log(`${todo ? "--todo" : fichero}: ${usadas.size} clases propias en className · ${objetivo.size} migradas (${nCompartidas} compartidas → módulo común) · ${usadas.size - objetivo.size} se quedan`);
const quedan = [...usadas].filter((c) => !objetivo.has(c));
if (conservadas.size) console.log(`conservadas sin migrar (tienen reglas sobre clases ajenas):\n${[...conservadas].map(([k, sel]) => `  ${k}  ← ${sel.slice(0, 110)}`).join("\n")}`);
if (quedan.length) console.log(`se quedan con su CSS: ${quedan.join(" ")}`);
if (claseSinReglas.length) console.log(`sin reglas CSS (clase marcador): ${claseSinReglas.join(" ")}`);
if (referenciadas.size) console.log(`marcadores que se conservan en el DOM (${[...referenciadas].filter((k) => objetivo.has(k)).length}): ${[...referenciadas].filter((k) => objetivo.has(k)).join(" ")}`);
for (const m of new Set(manual)) console.log(`MANUAL: ${m}`);
for (const r of restos) console.log(`MANUAL (¿clase fuera de className?): ${r}`);

// Entradas de cada módulo: las que ya tenía el fichero (si es un componente ya migrado) más las nuevas. Con la migración
// de un componente suelto se reescribe entero, como siempre.
const CRLF = (t) => (t.includes("\r\n") ? "\r\n" : "\n");
function cuerpoExistente(ruta, nombre) {
  let t;
  try { t = readFileSync(join(RAIZ, ruta), "utf-8"); } catch { return null; }
  const eol = CRLF(t);
  const ini = t.indexOf(`export const ${nombre} = {`);
  if (ini < 0) throw new Error(`${ruta}: no encuentro «export const ${nombre} = {»`);
  const cuerpo = t.slice(t.indexOf("{", ini) + 1, t.lastIndexOf("} as const;")).split(/\r?\n/).filter((l) => l.trim());
  const entradas = new Map();
  for (const l of cuerpo) {
    const m = l.match(/^\s{2}("[^"]+"|[A-Za-z_$][\w$]*): ("(?:[^"\\]|\\.)*"|String\.raw`[^`]*`),\r?$/);
    if (!m) throw new Error(`${ruta}: línea que no sé leer: ${l.slice(0, 80)}`);
    entradas.set(m[1].replace(/^"|"$/g, ""), m[2].startsWith("String.raw`") ? m[2].slice(11, -1) : JSON.parse(m[2]));
  }
  return { cabecera: t.slice(0, ini), entradas, eol };
}
function contenido(ruta, nombre, cabeceraNueva, nuevas) {
  const previo = todo ? cuerpoExistente(ruta, nombre) : null;
  const entradas = new Map(previo?.entradas ?? []);
  // Un marcador nuevo en una entrada que ya existía.
  for (const [k, v] of entradas) if (marcador(k) && !v.split(/\s+/).includes(k)) entradas.set(k, `${k} ${v}`.trim());
  for (const [k, v] of nuevas) entradas.set(k, v);
  const eol = previo?.eol ?? "\n";
  // Una utilidad con `\_` (guion bajo de verdad en un valor de atributo) se escribe con String.raw: Tailwind lee el fuente tal
  // cual, y con `"\\_"` vería dos barras y generaría un selector que no casa con la clase del DOM.
  const literal = (v) => (v.includes("\\") ? `String.raw\`${v.replace(/`/g, "\\`").replace(/\$\{/g, "\\${")}\`` : JSON.stringify(v));
  const lineas = [...entradas].map(([k, v]) => `  ${ident(k) ? k : JSON.stringify(k)}: ${literal(v)},`);
  return { texto: `${previo?.cabecera ?? cabeceraNueva}export const ${nombre} = {${eol}${lineas.join(eol)}${eol}} as const;${eol}`.replace(/\r?\n/g, eol), existia: !!previo, n: entradas.size };
}
const CABECERA_C = `// Estilos compartidos por varios componentes, en utilidades de Tailwind. Generado por scripts/migrar-a-tailwind.mjs a partir
// de las reglas CSS que tenían las clases; una cadena por clase (o \`a_b\` cuando dos conviven en un elemento).
// Una clase cuyo nombre aparece dentro de una utilidad (\`[.padre_&]:…\`) conserva su nombre como palabra suelta.
`;
const escrituras = [];
for (const [destino, nuevas] of registro) {
  const comun = destino === "C";
  const ruta = comun ? RUTA_COMUN : rutaEstilos(destino);
  const stem = comun ? "estilos-comunes" : stemDe(destino);
  const cabecera = comun
    ? CABECERA_C
    : `// Estilos de ${stem}.tsx en utilidades de Tailwind. Generado por scripts/migrar-a-tailwind.mjs a partir de las\n// reglas CSS que tenía el componente; una cadena por clase, con el mismo nombre que tenía.\n`;
  const c = contenido(ruta, comun ? "C" : "S", cabecera, nuevas);
  escrituras.push({ ruta, texto: c.texto, detalle: `${c.n} entradas` });
}
// Marcadores nuevos en componentes ya migrados que no reciben entradas nuevas.
if (todo) {
  // Solo los generados por esta herramienta: `ficha-estilos.ts` y similares se escribieron a mano con otra forma.
  const generado = (f) => readFileSync(join(RAIZ, f), "utf-8").includes("Generado por scripts/migrar-a-tailwind.mjs");
  for (const f of ficheros("app", [".ts"]).filter((x) => /-estilos\.ts$/.test(x)).map(rutaNorm).filter(generado)) {
    if (escrituras.some((e) => e.ruta === f)) continue;
    const c = contenido(f, "S", "", new Map());
    if (c.texto !== readFileSync(join(RAIZ, f), "utf-8")) escrituras.push({ ruta: f, texto: c.texto, detalle: "marcadores" });
  }
}

const importesDe = (ruta, src, usa) => {
  const stem = stemDe(ruta);
  const out = [];
  if (usa.S && !new RegExp(`from "\\./${stem}-estilos"`).test(src)) out.push(`import { S } from "./${stem}-estilos";`);
  if (usa.C && !src.includes(`from "@/app/components/estilos-comunes"`)) out.push(`import { C } from "@/app/components/estilos-comunes";`);
  if (usa.cn && !/\bcn\b[^;]*from "@\/lib\/utils"/.test(src)) out.push(`import { cn } from "@/lib/utils";`);
  return out;
};
for (const [ruta, { nuevo, usa }] of resultadoFicheros) {
  const eol = CRLF(nuevo);
  const importes = importesDe(ruta, nuevo, usa);
  let tsx = nuevo;
  if (importes.length) {
    // Ojo con `\s*$` en multilínea: en JS `$` también casa entre `\r` y `\n`, y el import se colaba en mitad del CRLF.
    const m = [...tsx.matchAll(/^import[\s\S]*?;[ \t]*(?=\r?\n)/gm)].pop();
    if (m) tsx = tsx.slice(0, m.index + m[0].length) + eol + importes.join(eol) + tsx.slice(m.index + m[0].length);
    else {
      // Sin ningún import (componente presentacional): tras la directiva "use client", si la hay.
      const d = tsx.match(/^"use (?:client|server)";\s*\r?\n/);
      const pos = d ? d[0].length : 0;
      tsx = tsx.slice(0, pos) + (d ? eol : "") + importes.join(eol) + eol + (d ? "" : eol) + tsx.slice(pos);
    }
  }
  escrituras.push({ ruta, texto: tsx, detalle: importes.length ? `+ ${importes.length} import` : "" });
}

console.log(`\n${resultadoFicheros.size} ficheros reescritos · ${escrituras.filter((e) => /-estilos\.ts$|estilos-comunes\.ts$/.test(e.ruta)).length} módulos de estilos`);
if (!aplicar) {
  console.log("(informe: no se ha escrito nada; usa --aplicar)");
  process.exit(0);
}
for (const e of escrituras) writeFileSync(join(RAIZ, e.ruta), e.texto);
console.log(`Escritos ${escrituras.length} ficheros.`);
