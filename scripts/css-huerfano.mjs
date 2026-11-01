// Lista las reglas de app/styles.css cuyas clases ya no usa ningún componente.
// Uso:  node scripts/css-huerfano.mjs            → resumen y rangos de líneas
//       node scripts/css-huerfano.mjs --clase=toolPanel   → quién usa esa clase
//
// Es un informe, no borra nada: una clase armada en tiempo de ejecución
// (`msg-${rol}`) parece huérfana aunque no lo sea, así que cada rango se revisa
// a mano antes de quitarlo.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = process.cwd();
const CSS = process.argv.find((a) => a.startsWith("--css="))?.slice(6) ?? "app/styles.css";

function ficheros(dir, ext) {
  return readdirSync(join(RAIZ, dir)).flatMap((n) => {
    const r = `${dir}/${n}`;
    if (n === "node_modules" || n === ".next") return [];
    if (statSync(join(RAIZ, r)).isDirectory()) return ficheros(r, ext);
    return ext.some((e) => n.endsWith(e)) ? [r] : [];
  });
}

// Reglas planas con su rango de líneas. Las @media/@supports se recorren por dentro.
function reglas(css) {
  const out = [];
  const pila = [];
  let inicio = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "{") {
      // `pos` apunta al primer carácter del SELECTOR, no a la `{`: en una regla con el selector repartido en varias
      // líneas, el rango debe empezar en la primera; si no, al borrarla quedan líneas sueltas pegadas a la regla
      // siguiente (incluso a un `@media`) y el CSS queda inválido.
      const bruto = css.slice(inicio, i);
      pila.push({ sel: bruto.trim(), pos: inicio + (bruto.length - bruto.trimStart().length) });
      inicio = i + 1;
    } else if (c === "}") {
      const { sel, pos } = pila.pop();
      if (!sel.startsWith("@")) {
        out.push({ sel, desde: css.slice(0, pos).split("\n").length, hasta: css.slice(0, i).split("\n").length });
      }
      inicio = i + 1;
    } else if (c === ";" && pila.length === 0) {
      inicio = i + 1;
    }
  }
  return out;
}

// Los comentarios se vacían pero conservan sus saltos de línea: los rangos que se imprimen siguen siendo los reales.
const css = readFileSync(join(RAIZ, CSS), "utf-8").replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
const fuentes = [...ficheros("app", [".tsx", ".ts"]), ...ficheros("lib", [".ts", ".tsx"])];
const textos = Object.fromEntries(fuentes.map((f) => [f, readFileSync(join(RAIZ, f), "utf-8")]));

const arg = process.argv.find((a) => a.startsWith("--clase="));
if (arg) {
  const clase = arg.slice("--clase=".length);
  const re = new RegExp(`(?<![\\w-])${clase}(?![\\w-])`);
  const usan = fuentes.filter((f) => re.test(textos[f]));
  console.log(`${clase}: ${usan.length} fichero(s)\n${usan.join("\n")}`);
  process.exit(0);
}

const arg2 = process.argv.find((a) => a.startsWith("--fichero="));
if (arg2) {
  // Qué clases propias usa un componente, cuáles son solo suyas y cuánto CSS libera migrarlo.
  const fichero = arg2.slice("--fichero=".length);
  const propias = new Set([...css.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]));
  const suyas = new Set();
  for (const m of textos[fichero].matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g)) {
    const s = (m[1] ?? m[2] ?? m[3] ?? "").replace(/\$\{[^}]*\}/g, " ");
    for (const t of s.split(/\s+/)) if (t && propias.has(t) && !/[:[/]/.test(t)) suyas.add(t);
  }
  const otros = (c) => fuentes.filter((f) => f !== fichero && new RegExp(`(?<![\\w-])${c}(?![\\w-])`).test(textos[f]));
  const exclusivas = [...suyas].filter((c) => otros(c).length === 0);
  const compartidas = [...suyas].filter((c) => otros(c).length > 0);
  const liberadas = reglas(css).filter((r) => {
    const cl = [...r.sel.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]);
    return cl.length > 0 && cl.every((c) => exclusivas.includes(c));
  });
  const n = liberadas.reduce((a, r) => a + (r.hasta - r.desde + 1), 0);
  console.log(`${fichero}: ${suyas.size} clases propias · ${exclusivas.length} exclusivas · ${compartidas.length} compartidas`);
  console.log(`Migrarlo libera ${liberadas.length} reglas (${n} líneas) de ${CSS}`);
  console.log(`exclusivas:  ${exclusivas.join(" ")}`);
  console.log(`compartidas: ${compartidas.join(" ")}`);
  process.exit(0);
}

const usadas = new Set();
// Los componentes migrados con scripts/migrar-a-tailwind.mjs conservan el NOMBRE de la clase como clave de `S`
// (`S.documentResult`) pero ya no usan el CSS: ni sus ficheros -estilos.ts generados ni las referencias `S.x` cuentan.
for (const t of Object.values(textos)) {
  if (t.includes("Generado por scripts/migrar-a-tailwind.mjs")) continue;
  for (const m of t.replace(/\bS\.[A-Za-z_]\w*/g, " ").matchAll(/[A-Za-z_][\w-]*/g)) usadas.add(m[0]);
}

const todas = reglas(css);
const huerfanas = todas.filter((r) => {
  const cl = [...r.sel.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]);
  return cl.length > 0 && cl.every((c) => !usadas.has(c));
});
const lineas = huerfanas.reduce((n, r) => n + (r.hasta - r.desde + 1), 0);
console.log(`${huerfanas.length} reglas huérfanas de ${todas.length} (${lineas} líneas de ${css.split("\n").length})`);
// Una regla huérfana que comparte línea con una regla VIVA (típico de los `@media{…}` escritos en una sola línea)
// no se puede borrar por líneas: se marca con `!!` y hay que quitarla a mano, solo ella.
const vivas = todas.filter((r) => !huerfanas.includes(r));
const comparte = (r) => vivas.some((v) => v.desde <= r.hasta && v.hasta >= r.desde);

// Una clase armada en ejecución (`faseToast-${tipo}`) no aparece entera en el código y parece huérfana: se detecta
// si algún prefijo suyo va seguido de `${` o de `" +`. Se marca con `??` y se conserva.
const todoElCodigo = Object.values(textos).join("\n");
const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const dinamica = (r) =>
  [...r.sel.matchAll(/\.([A-Za-z_][\w-]*)/g)].some((m) => {
    const partes = m[1].match(/[A-Za-z][a-z0-9]*|\d+|-/g) ?? [];
    let prefijo = "";
    return partes.slice(0, -1).some((p) => {
      prefijo += p;
      return prefijo.length >= 3 && new RegExp(`[\`"'\\s(]${escapar(prefijo)}(\\$\\{|["']\\s*\\+)`).test(todoElCodigo);
    });
  });

for (const r of huerfanas.slice(0, 400)) {
  const marca = comparte(r) ? "!!" : dinamica(r) ? "??" : "  ";
  console.log(`${marca} ${r.desde}-${r.hasta}  ${r.sel.replace(/\s+/g, " ").slice(0, 90)}`);
}
if (huerfanas.some(comparte)) console.log("\n!! = comparte línea con una regla que sí se usa: no borrar la línea entera.");
if (huerfanas.some(dinamica)) console.log("?? = su nombre se arma en tiempo de ejecución: no es huérfana, se conserva.");
