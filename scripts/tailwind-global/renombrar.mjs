// Tras --todo: una entrada `x_fueraTw` sin su gemela `x` (dentro de .tw) se llama simplemente `x`. El sufijo solo sirve para
// distinguir las dos variantes cuando una clase vive en los dos sitios.
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
const GEN = "Generado por scripts/migrar-a-tailwind.mjs";
const fich = (d) => readdirSync(d).flatMap((n) => { const r = `${d}/${n}`; return statSync(r).isDirectory() ? fich(r) : [r]; });
const todos = fich("app").filter((r) => /\.(tsx|ts)$/.test(r));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ident = (k) => /^[A-Za-z_$][\w$]*$/.test(k);
const ref = (o, k) => (ident(k) ? `${o}.${k}` : `${o}[${JSON.stringify(k)}]`);
let total = 0;
for (const mod of todos.filter((r) => /(-estilos|estilos-comunes)\.ts$/.test(r))) {
  let t = readFileSync(mod, "utf8");
  if (!t.includes(GEN)) continue;
  const claves = [...t.matchAll(/^\s{2}("[^"]+"|[A-Za-z_$][\w$]*): /gm)].map((m) => m[1].replace(/^"|"$/g, ""));
  const set = new Set(claves);
  const renombrar = claves.filter((k) => k.endsWith("_fueraTw") && !set.has(k.slice(0, -8)));
  if (!renombrar.length) continue;
  const comun = mod.endsWith("estilos-comunes.ts");
  const o = comun ? "C" : "S";
  const consumidores = comun ? todos : [mod.replace(/-estilos\.ts$/, ".tsx")].filter((c) => existsSync(c));
  for (const k of renombrar) {
    const n = k.slice(0, -8);
    const decl = new RegExp(`^(\\s{2})(?:"${esc(k)}"|${esc(k)}): `, "m");
    t = t.replace(decl, `$1${ident(n) ? n : JSON.stringify(n)}: `);
  }
  writeFileSync(mod, t);
  for (const c of consumidores) {
    let s = readFileSync(c, "utf8");
    const antes = s;
    for (const k of renombrar) {
      const n = k.slice(0, -8);
      s = s.replace(new RegExp(`\\b${o}\\.${esc(k)}\\b|\\b${o}\\[${esc(JSON.stringify(k))}\\]`, "g"), ref(o, n));
    }
    if (s !== antes) writeFileSync(c, s);
  }
  total += renombrar.length;
}
console.log(`${total} entradas sin el sufijo _fueraTw`);
