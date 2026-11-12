// Retoques tras `migrar-a-tailwind.mjs --todo`: clases que el código devolvía desde una función y que la herramienta no ve.
import { readFileSync, writeFileSync } from "node:fs";
function retocar(ruta, cambios) {
  let t = readFileSync(ruta, "utf-8");
  for (const [de, a] of cambios) {
    if (!t.includes(de)) throw new Error(`no encuentro en ${ruta}: ${de.slice(0, 60)}`);
    t = t.replace(de, a);
  }
  writeFileSync(ruta, t);
}
retocar("app/components/eval-dashboard.tsx", [
  ['if (score >= 0.75) return "scoreGood";', "if (score >= 0.75) return S.scoreGood;"],
  ['if (score >= 0.45) return "scoreMid";', 'if (score >= 0.45) return "";'],
  ['return "scoreBad";', "return S.scoreBad;"],
]);
console.log("retoques aplicados");
