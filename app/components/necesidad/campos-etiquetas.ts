import { FICHA_SECCIONES } from "@/lib/necesidad-ficha-secciones";

/**
 * api del campo -> su etiqueta visible. Lo usan el guardado (para nombrar el
 * campo que falta), el aviso de borrador local y el traslado desde el EETT/TDR,
 * que a partir de ahora viven en ficheros distintos: derivarlo dos veces seria
 * arriesgarse a que un dia dieran nombres distintos del mismo campo.
 */
export const CAMPO_LABEL: Record<string, string> = (() => {
  const m: Record<string, string> = { nombre: "Nombre de la contratación", summary: "Resumen / descripción" };
  for (const s of FICHA_SECCIONES) for (const f of s.fields) m[f.api] = f.label;
  return m;
})();
