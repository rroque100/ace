// Estilo compartido de las tablas-editor del Formato de Estrategia (proveedores
// consultados, integrantes del panel evaluador, cronograma de roles). Migrado de
// la clase `.provTabla` de styles.css: la tabla y sus celdas/campos se estilan por
// selectores hijo. Los <input>/<select>/<textarea> nativos conservan su aspecto
// global (radio 10 / alto 40); aquí solo se les da el ancho completo de la celda.
export const PROV_TABLA =
  "flex flex-col gap-2 [&_table]:w-full [&_table]:border-collapse " +
  "[&_th]:px-1.5 [&_th]:pt-1 [&_th]:pb-1.5 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-semibold [&_th]:text-muted " +
  "[&_td]:px-[3px] [&_td]:py-0.5 [&_input]:w-full [&_select]:w-full [&_textarea]:w-full [&_textarea]:resize-y";

export const PROV_VACIA = "m-0 text-[12px] text-muted";
export const PROV_QUITAR = "flex cursor-pointer p-1 text-muted hover:text-danger";
