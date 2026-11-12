// Estilos de audit-explorer.tsx en utilidades de Tailwind. Generado por scripts/migrar-a-tailwind.mjs a partir de las
// reglas CSS que tenía el componente; una cadena por clase, con el mismo nombre que tenía.
export const S = {
  auditFilter: "legado:inline-flex legado:items-center legado:gap-1.5 legado:text-muted legado:[&_select]:py-0 legado:[&_select]:px-2.5 legado:[&_select]:fuera-tw:border legado:[&_select]:fuera-tw-texto:[font-family:inherit] legado:[&_select]:fuera-tw-texto:[font-size:inherit] legado:[&_select]:fuera-tw-texto:[font-weight:inherit] legado:[&_select]:fuera-tw-texto:[font-style:inherit] legado:[&_select]:fuera-tw-texto:leading-[inherit] legado:[&_select]:min-h-10 legado:[&_select]:rounded-[10px] legado:[&_select]:bg-panel legado:[&_select]:fuera-tw:border-line-strong legado:[&_select]:fuera-tw-texto:text-ink",
  auditRow_auditRowButton: "legado:py-[9px] legado:px-1 legado:grid legado:grid-cols-[minmax(0,_1.6fr)_minmax(0,_1fr)_minmax(0,_1fr)_minmax(0,_1.2fr)] legado:gap-2.5 legado:items-center legado:fuera-tw:border-b-line legado:fuera-tw-texto:text-[12px] legado:w-full legado:text-left legado:fuera-tw:border-0 legado:fuera-tw-boton:bg-transparent legado:fuera-tw-boton:cursor-pointer legado:max-[720px]:grid-cols-[1fr_1fr] legado:rounded-[13px] legado:hover:fuera-tw-boton:bg-brand-soft",
  // Bloque de código oscuro (azul casi negro con texto casi blanco en el CSS original). La migración llevó fondo y texto al mismo token
  // (`info`) y el JSON del registro no se leía. `ink` + `on-brand` se leen en claro y en oscuro (en oscuro el bloque se aclara).
  auditDetails: "legado:p-3 legado:m-0 legado:overflow-auto legado:max-h-[240px] legado:rounded-[8px] legado:bg-ink legado:text-on-brand legado:text-[12px] legado:leading-[1.5]",
} as const;
