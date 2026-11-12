// Último paso: el CSS que sobrevive (tokens, resets de elementos, keyframes) pasa a un único app/base.css y se borran los
// CSS de componentes y sus imports.
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
const leer = (r) => readFileSync(r, "utf-8");
const limpio = (t) => t.replace(/@reference\s+"[^"]*";\s*/g, "").replace(/\r\n/g, "\n").trim();
function kf(t, nombre) {
  const i = t.indexOf(`@keyframes ${nombre}`);
  if (i < 0) return "";
  let prof = 0;
  for (let j = t.indexOf("{", i); j < t.length; j++) {
    if (t[j] === "{") prof++;
    else if (t[j] === "}" && --prof === 0) return t.slice(i, j + 1);
  }
  return "";
}
const legal = leer("app/components/legal-workspace.css");
const frames = ["normShimmer", "chatAiSpinner"].map((n) => kf(legal, n)).filter(Boolean);
if (frames.length !== 2) throw new Error("no encuentro los keyframes de legal-workspace.css");
const base = `/* CSS global que sobrevive a la migración a Tailwind: tokens, resets de elementos (h1, body, inputs, foco, scrollbar) y los
   @keyframes que las utilidades \`animate-[…]\` referencian por nombre. NO hay clases de componente: eso va en utilidades.
   Entra en la capa \`legacy\` (ver tailwind.css), por debajo de las utilidades. */
${limpio(leer("app/styles.css"))}

/* Animaciones que citan las utilidades del Centro Jurídico. */
${frames.join("\n")}
`;
writeFileSync("app/base.css", base);
for (const f of [
  "app/styles.css",
  "app/components/legal-workspace.css",
  "app/components/exam-ui.css",
  "app/components/norm-article-reading.css",
  "app/components/normative-browser.css",
  "app/components/search-discovery.css",
  "app/components/voice-search.css",
]) if (existsSync(f)) rmSync(f);
function quitarImport(ruta, patron) {
  const t = leer(ruta);
  const n = t.replace(patron, "");
  if (n === t) console.log(`  (sin import que quitar en ${ruta})`);
  writeFileSync(ruta, n);
}
const imp = (nombre) => new RegExp(`import "[./]*[\\w./-]*${nombre}";\\r?\\n`, "g");
for (const r of ["app/actualizacion-documental/page.tsx", "app/busqueda/page.tsx", "app/chat/page.tsx", "app/comparar/page.tsx", "app/normas/page.tsx", "app/simulador/page.tsx", "app/simulador/banco/page.tsx"]) {
  quitarImport(r, imp("legal-workspace\\.css"));
  quitarImport(r, imp("exam-ui\\.css"));
}
quitarImport("app/components/norm-article-reading.tsx", imp("norm-article-reading\\.css"));
quitarImport("app/components/normative-browser.tsx", imp("normative-browser\\.css"));
quitarImport("app/components/search-discovery.tsx", imp("search-discovery\\.css"));
quitarImport("app/components/voice-dictation.tsx", imp("voice-search\\.css"));
quitarImport("app/components/voice-search.tsx", imp("voice-search\\.css"));
quitarImport("app/layout.tsx", imp("expedientes-archivo\\.css"));
const tw = leer("app/tailwind.css");
if (!tw.includes('@import "./styles.css" layer(legacy);')) throw new Error("tailwind.css no importa styles.css como esperaba");
writeFileSync("app/tailwind.css", tw.replace('@import "./styles.css" layer(legacy);', '@import "./base.css" layer(legacy);'));
console.log("CSS consolidado en app/base.css");

// Los comentarios de configuración que nombraban styles.css.
function reemplazar(ruta, pares) {
  let t = leer(ruta);
  for (const [a, b] of pares) {
    if (!t.includes(a)) { console.log(`  (no encuentro «${a.slice(0, 40)}» en ${ruta})`); continue; }
    t = t.split(a).join(b);
  }
  writeFileSync(ruta, t);
}
reemplazar("app/tailwind.css", [
  ["La app tiene ~11 300 líneas de CSS propio en app/styles.css del que dependen", "La app llegó a tener ~11 300 líneas de CSS propio (hoy solo queda app/base.css) del que dependían"],
  ["styles.css), no valores hardcodeados", "base.css), no valores hardcodeados"],
]);
reemplazar("app/workspace.css", [
  ["legacy de styles.css", "legacy de base.css"],
  ["Los usan styles.css y", "Los usan base.css y"],
]);
