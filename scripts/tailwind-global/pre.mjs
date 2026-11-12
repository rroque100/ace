// Retoques al código ORIGINAL antes de `migrar-a-tailwind.mjs --todo`: clases que el código arma o pasa por prop y que la
// herramienta no ve en un `className`. Se reescriben como condiciones explícitas para que se migren como las demás.
import { readFileSync, writeFileSync } from "node:fs";
function retocar(ruta, cambios) {
  let t = readFileSync(ruta, "utf-8");
  for (const [de, a] of cambios) {
    const antes = t;
    t = typeof de === "string" ? t.split(de).join(a) : t.replace(de, a);
    if (t === antes) console.log(`  (sin cambio en ${ruta}: ${String(de).slice(0, 60)})`);
  }
  writeFileSync(ruta, t);
}

retocar("app/components/fase-panel.tsx", [
  ["className={`faseToast faseToast-${toast.kind}`}", 'className={toast.kind === "success" ? "faseToast faseToast-success" : toast.kind === "error" ? "faseToast faseToast-error" : "faseToast"}'],
]);
retocar("app/components/flujo-stepper.tsx", [
  ["className={`flujoRama flujoRama-${rama.tipo}`}", 'className={rama.tipo === "anulada" ? "flujoRama flujoRama-anulada" : "flujoRama"}'],
]);
retocar("app/components/coherencia-necesidad.tsx", [
  ["className={`cohNecCard cohNecCard-${t.nivel}`}", 'className={t.nivel === "stop" ? "cohNecCard cohNecCard-stop" : "cohNecCard"}'],
]);
retocar("app/components/chat-history.tsx", [
  ["className={confidenceClass(confidence)}", 'className={confidence === "alta" ? "confidencePill high" : confidence === "media" ? "confidencePill medium" : "confidencePill low"}'],
  [/function confidenceClass\([^)]*\) \{[\s\S]*?\r?\n\}\r?\n\r?\n/, ""],
]);

// Las vistas previa de hoja ensanchan la tarjeta del modal y su cuerpo: antes colgaba de `.anexo1Preview .modalBody` en el CSS.
retocar("app/components/modal-shell.tsx", [
  [
    "export function ModalShell",
    "// Vistas previa de hoja (tablas de ~10 columnas): casi pantalla completa; el cuerpo crece y la hoja deja su propio scroll.\n" +
      'export const TARJETA_HOJA = "w-[min(1260px,86vw)]! h-[96vh]! max-h-[96vh]! [&_.modalBody]:flex-1 [&_.modalBody]:min-h-0 [&_.hojaPreview]:max-h-none [&_.hojaPreview]:overflow-visible";\n\n' +
      "export function ModalShell",
  ],
]);
for (const f of ["anexo1-preview-modal", "anexo2-preview-modal", "checklist-bases-preview-modal", "certificacion-preview-modal", "comite-preview-modal", "estrategia-preview-modal"]) {
  retocar(`app/components/${f}.tsx`, [
    ['import { ModalShell } from "./modal-shell";', 'import { ModalShell, TARJETA_HOJA } from "./modal-shell";'],
    ['claseTarjeta="anexo1Preview"', "claseTarjeta={TARJETA_HOJA}"],
    ['claseTarjeta="certificacionPreview"', "claseTarjeta={TARJETA_HOJA}"],
  ]);
}
// Los sitios que devolvían «confidencePill high|medium|low» desde una función.
const cond = (v) => `${v} === "alta" ? "confidencePill high" : ${v} === "media" ? "confidencePill medium" : "confidencePill low"`;
for (const f of ["document-analyzer", "normative-compare"]) {
  retocar(`app/components/${f}.tsx`, [
    [/className=\{confidenceClass\(([\w.?]+)\)\}/g, (_, v) => `className={${cond(v)}}`],
    [/function confidenceClass\([^)]*\) \{[\s\S]*?\r?\n\}\r?\n\r?\n/, ""],
  ]);
}

console.log("retoques previos aplicados");
