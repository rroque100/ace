// Checklist de admisibilidad de la DEC (P3).
//
// El avance de obligatorios de la ficha orienta al ÁREA USUARIA mientras formula.
// Pero la DEC, al recibir el requerimiento, hace su propia verificación de
// admisibilidad antes de dar conforme (Art. 44 / 72) y no tenía dónde dejarla:
// era un criterio en la cabeza de quien revisa, no un registro trazable. Este
// catálogo fija los puntos que la DEC marca; el estado se guarda por necesidad.
//
// Es un APOYO trazable, no un candado: no bloquea el "Conforme". La decisión y su
// responsabilidad siguen siendo de la DEC; el checklist deja constancia de qué
// revisó.


export type AdmisibilidadItem = {
  key: string;
  label: string;
  baseLegal: string;
};

/** Puntos de admisibilidad que la DEC verifica sobre el requerimiento. */
export const ADMISIBILIDAD_ITEMS: readonly AdmisibilidadItem[] = [
  { key: "finalidad", label: "Finalidad pública clara y vinculada a la función de la entidad", baseLegal: "Art. 44.1" },
  { key: "objeto_eett", label: "Objeto y EETT/TDR definidos y suficientes para contratar", baseLegal: "Art. 44.10 · 126" },
  { key: "cantidades", label: "Cantidades, unidades y metas coherentes con la necesidad", baseLegal: "Art. 44" },
  { key: "requisitos", label: "Requisitos de calificación proporcionales y no restrictivos", baseLegal: "Art. 44.2.b · 72" },
  { key: "condiciones", label: "Condiciones de contratación completas (plazo, pago, entrega)", baseLegal: "Art. 44.2" },
  { key: "lugar", label: "Lugar de entrega o prestación indicado", baseLegal: "Art. 44.2" },
  { key: "presupuesto", label: "Datos presupuestales y certificación de crédito", baseLegal: "Art. 48 · Ley 32069" },
  { key: "sin_direccionamiento", label: "Sin direccionamiento ni condiciones que restrinjan la competencia", baseLegal: "Art. 44.6" },
  { key: "cmn", label: "Incluida y coherente con el CMN/PAC", baseLegal: "Art. 46.1 · Ley 32069 (PMBSO)" },
] as const;


/** Estado de un punto: marcado o no, con una nota opcional de la DEC. */
export type AdmisibilidadEstadoItem = { ok: boolean; nota?: string };

/** Estado completo del checklist de una necesidad: { [key]: { ok, nota } }. */
export type AdmisibilidadEstado = Record<string, AdmisibilidadEstadoItem>;

/** Cuántos puntos están marcados sobre el total del catálogo. */
export function contarAdmisibilidad(estado: AdmisibilidadEstado | null | undefined): {
  done: number;
  total: number;
} {
  const total = ADMISIBILIDAD_ITEMS.length;
  if (!estado) return { done: 0, total };
  let done = 0;
  for (const item of ADMISIBILIDAD_ITEMS) {
    if (estado[item.key]?.ok) done += 1;
  }
  return { done, total };
}
