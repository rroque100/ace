// Estilos de pdf-cite-viewer.tsx en utilidades de Tailwind. Generado por scripts/migrar-a-tailwind.mjs a partir de las
// reglas CSS que tenía el componente; una cadena por clase, con el mismo nombre que tenía.
export const S = {
  // Migrado a mano: eran reglas compuestas (`.pdfViewerContent.searchPdfPanel .pdfViewerControls`) que la herramienta no
  // resuelve. Centrado y panel lateral son cadenas separadas, no dos utilidades que compiten (top-1/2 frente a top-0): entre
  // utilidades del mismo peso el desempate lo da Tailwind, no el orden del CSS original. `pdfViewerContent` sigue en el DOM
  // como marcador: la regla de modo oscuro de workspace.css lo nombra.
  pdfViewerContent: "pdfViewerContent fixed z-40 grid grid-rows-[auto_1fr] gap-2.5 border border-line bg-panel p-3.5",
  pdfViewerCentrado: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(900px,calc(100vw-24px))] h-[min(86vh,900px)] rounded-2xl shadow-[0_24px_70px_rgba(23,32,51,0.18)]",
  pdfViewerLateral: "top-0 right-0 bottom-0 left-auto w-[min(58vw,900px)] max-[720px]:w-screen max-w-none h-dvh max-h-dvh rounded-none shadow-[-12px_0_40px_rgba(0,0,0,0.13)]",
  pdfViewerControls: "flex items-center gap-2 text-[13px] font-bold text-muted",
  pdfViewerStage: "legado:p-3 legado:overflow-auto legado:grid legado:[place-items:center] legado:rounded-[8px] legado:bg-info-soft legado:fuera-tw:border legado:fuera-tw:border-line",
  pdfCanvasWrap: "legado:relative legado:leading-[0] legado:[&_canvas]:shadow-[0_6px_20px_rgba(15,_23,_42,_0.14)]",
  pdfHighlight: "legado:absolute legado:[background:rgba(241,_196,_15,_0.42)] legado:rounded-[2px] legado:[mix-blend-mode:multiply] legado:pointer-events-none",
  pdfHint: "legado:py-[0.55rem] legado:px-[0.7rem] legado:absolute legado:left-3.5 legado:bottom-3.5 legado:max-w-[min(420px,_calc(100%_-_28px))] legado:rounded-[8px] legado:[background:color-mix(in_srgb,_var(--panel)_94%,_transparent)] legado:shadow-[var(--shadow-sm)] legado:text-[color:var(--text-muted)] legado:text-[0.82rem] legado:leading-[1.35] legado:fuera-tw:border legado:fuera-tw:border-[color:var(--border)]",
} as const;
