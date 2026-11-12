// Retoques a mano tras la migración: lo que la herramienta no resuelve.
import { readFileSync, writeFileSync } from "node:fs";
const leer = (r) => readFileSync(r, "utf8");
function cambiar(ruta, pares) {
  let t = leer(ruta);
  for (const [a, b] of pares) {
    const antes = t;
    t = typeof a === "string" ? t.replace(a, b) : t.replace(a, b);
    if (t === antes) throw new Error(`no encuentro en ${ruta}: ${String(a).slice(0, 70)}`);
  }
  writeFileSync(ruta, t);
}
// 1. Visor PDF: reglas compuestas (`.pdfViewerContent.searchPdfPanel .pdfViewerControls`).
cambiar("app/components/pdf-cite-viewer-estilos.ts", [["export const S = {\n", `export const S = {
  // Migrado a mano: eran reglas compuestas (\`.pdfViewerContent.searchPdfPanel .pdfViewerControls\`) que la herramienta no
  // resuelve. Centrado y panel lateral son cadenas separadas, no dos utilidades que compiten (top-1/2 frente a top-0): entre
  // utilidades del mismo peso el desempate lo da Tailwind, no el orden del CSS original. \`pdfViewerContent\` sigue en el DOM
  // como marcador: la regla de modo oscuro de workspace.css lo nombra.
  pdfViewerContent: "pdfViewerContent fixed z-40 grid grid-rows-[auto_1fr] gap-2.5 border border-line bg-panel p-3.5",
  pdfViewerCentrado: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(900px,calc(100vw-24px))] h-[min(86vh,900px)] rounded-2xl shadow-[0_24px_70px_rgba(23,32,51,0.18)]",
  pdfViewerLateral: "top-0 right-0 bottom-0 left-auto w-[min(58vw,900px)] max-[720px]:w-screen max-w-none h-dvh max-h-dvh rounded-none shadow-[-12px_0_40px_rgba(0,0,0,0.13)]",
  pdfViewerControls: "flex items-center gap-2 text-[13px] font-bold text-muted",
`]]);
cambiar("app/components/pdf-cite-viewer.tsx", [
  ['className={`pdfViewerContent${sidePanel ? " searchPdfPanel" : ""}`}', 'className={`${S.pdfViewerContent} ${sidePanel ? S.pdfViewerLateral : S.pdfViewerCentrado}`}'],
  ['<div className="pdfViewerControls">', '<div className={`${S.pdfViewerControls}${sidePanel ? " flex-wrap" : ""}`}>'],
]);
cambiar("app/base.css", [
  [/\/\* ===== Visor PDF con citas \(Fase 3\) ===== \*\/\r?\n\.pdfViewerContent \{[\s\S]*?\}\r?\n\r?\n\.pdfViewerControls \{[\s\S]*?\}\r?\n\r?\n/, ""],
  [/\.pdfViewerContent \{\r?\n  border-color: var\(--line\);\r?\n  border-radius: 16px;\r?\n  box-shadow:[^\n]*\r?\n\}\r?\n\r?\n/, ""],
  [/\.pdfViewerContent\.searchPdfPanel \{[^\n]*\n@media\(max-width:720px\) \{\n \.pdfViewerContent\.searchPdfPanel \{ width:100vw; \}\n\}\n\.pdfViewerContent\.searchPdfPanel \.pdfViewerControls \{ flex-wrap:wrap; \}\n/, ""],
]);
// 2. Lectura de normas: `[label&:not()]` vacío (Tailwind no lo compila y tumbaba next dev con un 500).
cambiar("app/components/norm-article-reading-estilos.ts", [
  [' [div_&]:[label&:not()]:grid [div_&]:[label&:not()]:gap-1.5"', '"'],
  ["  normReadingContinuous:", `  // La regla original era \`.normReadingSettings>div>label:not(.normReadingContinuous) { display:grid; gap:6px }\`: daba la
  // rejilla a las OTRAS etiquetas del panel. La migración la colgó de esta clase con un \`:not()\` vacío, que Tailwind no sabe
  // compilar y tumbaba \`next dev\` con un 500. Ahora va en la etiqueta de espaciado (normReadingAjuste).
  normReadingAjuste: "grid gap-1.5",
  normReadingContinuous:`],
]);
cambiar("app/components/norm-article-reading.tsx", [["<label>Espaciado<select", "<label className={S.normReadingAjuste}>Espaciado<select"]]);
// 3. Variantes `fuera-tw*`: las usan las utilidades que vienen del CSS heredado para lo que el reset de `.tw` anulaba.
cambiar("app/tailwind.css", [[
  '@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));',
  `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

/* Lo que el reset acotado de \`.tw\` (capa tw-base, más abajo) anula: los bordes de cualquier elemento, y el fondo, el color y
   la fuente de botones y campos. El CSS heredado vivía en una capa por DEBAJO de ese reset, así que dentro de un \`.tw\` sus
   bordes no se veían y fuera sí. Al pasarlo a utilidades (que van por ENCIMA del reset) se conserva esa regla con estas
   variantes: \`fuera-tw:border\` solo se aplica fuera de un \`.tw\`. Es el navegador quien lo decide, elemento a elemento, porque
   hay \`.tw\` anidados y una regla \`.padre a\` puede alcanzar enlaces dentro de un \`.tw\` aunque \`.padre\` esté fuera.
   \`:where()\` no suma especificidad: la cascada entre utilidades no cambia. Las genera scripts/migrar-a-tailwind.mjs. */
@custom-variant fuera-tw (&:where(:not(.tw, .tw *)));
@custom-variant fuera-tw-boton (&:where(:not(.tw button)));
@custom-variant fuera-tw-texto (&:where(:not(.tw button, .tw input, .tw select, .tw textarea)));

/* \`legado:\` mete la utilidad en la subcapa \`utilities.legado\`. Lo que venía del CSS heredado (la antigua styles.css) estaba en
   una capa POR DEBAJO de las utilidades: una regla \`.historyTabs button { color: … }\` perdía frente al \`text-ink\` que el botón
   llevaba escrito, tuviera la especificidad que tuviera. Dentro de la capa \`utilities\`, lo que va en una subcapa pierde frente a
   lo que no: las utilidades escritas a mano siguen ganando y, entre sí, las heredadas se ordenan por especificidad como antes.
   Quitar el prefijo de una cadena es decidir que esa regla ya es «de primera»: hacerlo componente a componente, mirándolo. */
@custom-variant legado { @layer legado { @slot; } }`,
]]);
// 4. Buscador de Normas: su `[&_input]:border-0!` (ya estaba así en main) ganaba porque la regla general de legal-workspace.css
//    (`.legalWorkspace :is(input:not([type=checkbox]):not([type=radio]),select) { border … }`) iba sin capa y SIN `!important`:
//    pierde frente a cualquier `!` en una capa. Migrada, esa regla lleva `!` y, con más especificidad, le ganaba (el campo de
//    búsqueda salió con borde). Se iguala el selector y se le suma un escalón.
cambiar("app/components/normative-browser-estilos.ts", [[
  "[&_input]:border-0!",
  "[html_&]:[&_input:not([type='checkbox']):not([type='radio'])]:border-0!",
]]);
console.log("retoques manuales aplicados");
