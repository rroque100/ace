// Poda el CSS heredado tras migrar clases a utilidades (scripts/migrar-a-tailwind.mjs --todo).
//
// Uso:  node scripts/css-podar.mjs             → informe (no escribe nada)
//       node scripts/css-podar.mjs --aplicar   → quita del CSS lo que ya no puede aplicarse
//       node scripts/css-podar.mjs --tambien-desconocidas   → poda además las clases que no son de ninguna migración
//
// Un selector (cada parte de una lista con comas) se quita cuando nombra una clase MIGRADA que ya no está en ningún
// sitio como clase real: ni en un `className`, ni en un selector entre comillas, ni armada en ejecución. Si se queda sin
// selectores, la regla entera se va; y un `@media` que se queda vacío, también.
//
// Una clase que nunca estuvo en el código ni en una migración (`.recharts-wrapper`, la que añade una librería) NO se poda
// sola: se lista aparte, porque desde aquí no se distingue de una clase muerta de verdad.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";

const RAIZ = process.cwd();
const aplicar = process.argv.includes("--aplicar");
const tambienDesconocidas = process.argv.includes("--tambien-desconocidas");
// `--muertas=a,b`: clases cuyo CSS sobra aunque el código las nombre (marcadores que solo busca un `querySelector`: sus reglas
// ya están en utilidades).
const muertasForzadas = new Set((process.argv.find((a) => a.startsWith("--muertas=")) ?? "").slice(10).split(",").filter(Boolean));

function ficheros(dir, ext) {
  return readdirSync(join(RAIZ, dir)).flatMap((n) => {
    const r = `${dir}/${n}`;
    if (n === "node_modules" || n === ".next") return [];
    if (statSync(join(RAIZ, r)).isDirectory()) return ficheros(r, ext);
    return ext.some((e) => n.endsWith(e)) ? [r] : [];
  });
}
const GENERADO = "Generado por scripts/migrar-a-tailwind.mjs";

// ───────────── clases migradas (las claves de los módulos de estilos generados) ─────────────
const migradas = new Set();
for (const f of ficheros("app", [".ts"]).filter((x) => /-estilos\.ts$|estilos-comunes\.ts$/.test(x))) {
  const t = readFileSync(join(RAIZ, f), "utf-8");
  if (!t.includes(GENERADO)) continue;
  for (const m of t.matchAll(/^\s{2}("[^"]+"|[A-Za-z_$][\w$]*): (?:"|String\.raw)/gm)) {
    const k = m[1].replace(/^"|"$/g, "");
    migradas.add(k);
    for (const parte of k.split("_")) migradas.add(parte);
    // los marcadores (clases que una utilidad nombra) también están en la cadena
  }
}

// ───────────── clases vivas: palabras de cadenas de texto del código, sin los módulos generados ─────────────
// Un literal formado solo por palabras de clase (`"a b"`, `".expPanel"`, `"ok"`) cuenta. Es conservador: un dato como
// `"error"` también mantiene viva a `.error`, y su CSS se queda.
const fuentes = [...ficheros("app", [".tsx", ".ts"]), ...ficheros("lib", [".ts", ".tsx"])];
// Los .ts del servidor (rutas, lógica) solo cuentan si hablan de clases: «error» u «ok» están en todas.
const textos = fuentes
  .map((f) => ({ f, t: readFileSync(join(RAIZ, f), "utf-8") }))
  .filter(({ t }) => !t.includes(GENERADO))
  .filter(({ f, t }) => f.endsWith(".tsx") || /className|classList|querySelector|\.closest\(/.test(t))
  .map(({ t }) => t);
const vivas = new Set();
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const LITERAL = /(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
for (const t0 of textos) {
  const t = sinComentarios(t0).replace(/\b[SC]\["[^"]*"\]/g, " ");
  for (const m of t.matchAll(LITERAL)) {
    if (m[1] !== "`") { revisar(m[2]); continue; }
    // En una plantilla, cada `${…}` separa clases (`wrap ${abierto ? " x" : ""}` sigue siendo una lista) y las cadenas de
    // dentro del `${…}` son clases que se añaden a veces (`chatComposerDock`, `normFocusReading`): cuentan como vivas.
    revisar(m[2].replace(/\$\{[^{}]*\}/g, " "));
    for (const i of m[2].match(/\$\{[^{}]*\}/g) ?? []) for (const d of i.matchAll(LITERAL)) revisar(d[2]);
  }
}
function revisar(texto) {
  {
    const s = texto.trim();
    if (!s) return;
    // Una lista de clases (`"a b-c"`), o un selector (`".expPanel"`, `"form.expSearchBar"`). Una ruta (`/api/x/timeline`), una
    // frase o un texto con puntuación no son clases: de lo contrario «timeline» o «content» estarían vivas en cualquier parte.
    if (/^[\w-]+(?:\s+[\w-]+)*$/.test(s)) for (const w of s.split(/\s+/)) vivas.add(w);
    // Una lista de clases que mezcla marcadores con utilidades (`"workspaceShell grid lg:grid-cols-[264px_minmax(0,1fr)]"`): tras
    // la migración por fases casi todo el código es así, y sin esto `workspaceShell` contaba como muerta y se podaba su CSS.
    // Solo ASCII y sin espacios raros: una frase en español (acentos, puntuación de texto) no entra.
    else if (/^[\w\-:[\]().,%/#&>*+=~!@'"]+(?:\s+[\w\-:[\]().,%/#&>*+=~!@'"]+)*$/.test(s) && /\s/.test(s)) {
      for (const w of s.split(/\s+/)) if (/^[A-Za-z_][\w-]*$/.test(w)) vivas.add(w);
    }
    else if (/^[\w\s.#>:[\]="'()*,-]+$/.test(s) && !/\//.test(s)) for (const k of s.matchAll(/\.([A-Za-z_][\w-]*)/g)) vivas.add(k[1]);
  }
}
const todoElTexto = textos.map(sinComentarios).join("\n");
const escaparRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const armada = (k) => {
  const partes = k.match(/[A-Za-z][a-z0-9]*|\d+|-/g) ?? [];
  let prefijo = "";
  return partes.slice(0, -1).some((p) => {
    prefijo += p;
    return prefijo.length >= 3 && new RegExp(`[\`"'\\s(]${escaparRe(prefijo)}(\\$\\{|["']\\s*\\+)`).test(todoElTexto);
  });
};
const cacheArmada = new Map();
const viva = (k) => {
  if (vivas.has(k)) return true;
  if (!cacheArmada.has(k)) cacheArmada.set(k, armada(k));
  return cacheArmada.get(k);
};

// ───────────── selectores ─────────────
// Clases que un selector exige para casar (las de `:not(...)` no cuentan). `:is(a, b)` casa si casa alguna alternativa.
function dividirComas(t) {
  const out = [];
  let prof = 0;
  let a = "";
  for (const ch of t) {
    if ("([".includes(ch)) prof++;
    if (")]".includes(ch)) prof--;
    if (ch === "," && prof === 0) { out.push(a); a = ""; } else a += ch;
  }
  out.push(a);
  return out;
}
function quitarNot(s) {
  let r = s;
  for (let i = 0; i < 4; i++) r = r.replace(/:not\([^()]*\)/g, "");
  return r;
}
function claseDeSelector(s) {
  return [...s.replace(/\[[^\]]*\]/g, "").matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]);
}
function casa(s, muerta) {
  const i = s.search(/:(is|where)\(/);
  if (i >= 0) {
    const ini = s.indexOf("(", i);
    let prof = 0;
    let j = ini;
    for (; j < s.length; j++) {
      if (s[j] === "(") prof++;
      else if (s[j] === ")" && --prof === 0) break;
    }
    return dividirComas(s.slice(ini + 1, j)).some((alt) => casa(s.slice(0, i) + alt.trim() + s.slice(j + 1), muerta));
  }
  return !claseDeSelector(quitarNot(s)).some(muerta);
}

const desconocidas = new Map(); // clase muerta que no es de una migración → dónde
let reglasFuera = 0;
let selectoresFuera = 0;
const informe = [];
const css = ficheros("app", [".css"]).filter((f) => !/^app[\\/]tailwind\.css$/.test(f));
for (const f of css) {
  const origen = readFileSync(join(RAIZ, f), "utf-8");
  const root = postcss.parse(origen);
  let reglas = 0;
  let selectores = 0;
  const muerta = (k) => {
    if (muertasForzadas.has(k)) return true;
    if (viva(k)) return false;
    if (migradas.has(k) || tambienDesconocidas) return true;
    if (!desconocidas.has(k)) desconocidas.set(k, new Set());
    desconocidas.get(k).add(f);
    return false;
  };
  root.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;
    const partes = dividirComas(rule.selector).map((x) => x.trim()).filter(Boolean);
    const quedan = partes.filter((p) => casa(p, muerta));
    if (quedan.length === partes.length) return;
    selectores += partes.length - quedan.length;
    if (!quedan.length) {
      // Los comentarios que van justo encima documentan esa regla: se van con ella.
      for (let prev = rule.prev(); prev && prev.type === "comment"; prev = rule.prev()) prev.remove();
      rule.remove();
      reglas++;
    }
    else rule.selector = quedan.join(",\n");
  });
  // `@media`/`@supports`/`@container` que se quedan vacíos
  let cambio = true;
  while (cambio) {
    cambio = false;
    root.walkAtRules((at) => {
      if (/^(media|supports|container|layer)$/.test(at.name) && at.nodes && at.nodes.length === 0) { at.remove(); cambio = true; }
    });
  }
  const nuevo = root.toString();
  const antes = origen.split("\n").length;
  const despues = nuevo.split("\n").length;
  informe.push(`${f.padEnd(62)} ${String(antes).padStart(6)} → ${String(despues).padStart(6)} líneas · ${reglas} reglas y ${selectores} selectores fuera`);
  reglasFuera += reglas;
  selectoresFuera += selectores;
  if (aplicar && nuevo !== origen) writeFileSync(join(RAIZ, f), nuevo);
}
console.log(informe.join("\n"));
console.log(`\nTotal: ${reglasFuera} reglas y ${selectoresFuera} selectores fuera${aplicar ? " (escrito)" : " (informe: usa --aplicar)"}`);
if (desconocidas.size) {
  console.log(`\nClases sin uso en el código y que no son de ninguna migración (${desconocidas.size}): no se podan solas.`);
  console.log("Pueden ser clases muertas de verdad o de una librería; revísalas y usa --tambien-desconocidas si son muertas.");
  console.log([...desconocidas].map(([k, fs]) => `${k} (${[...fs].map((x) => x.split("/").pop()).join(",")})`).join("  "));
}
