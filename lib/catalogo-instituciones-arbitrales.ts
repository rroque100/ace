// Catálogo de instituciones arbitrales de la entidad (Configuración → Institución
// Arbitral).
//
// Distinto del serializador de texto de `lib/instituciones-arbitrales.ts` (que
// compone el apartado i) del requerimiento): esto es el CATÁLOGO administrable de
// instituciones que la entidad admite, con su Id, nombre y RUC. El Art. 332.1
// exige inscripción vigente en el REGAJU para designarlas en el convenio arbitral.
//
// Se guarda como un array JSONB en la fila `default` de entity_settings, igual que
// los feriados: catálogo pequeño y global, no particionado por año ni expediente.

import { validateRUC } from "./utils";

export type InstitucionArbitralCatalogo = {
  /** Correlativo estable dentro del catálogo (el "Id" que se muestra). */
  id: number;
  nombre: string;
  ruc: string;
};

/** ¿El RUC es válido para el catálogo? Vacío se admite (queda por consignar). */
export function rucCatalogoValido(ruc: string): boolean {
  const v = ruc.trim();
  return v === "" || validateRUC(v);
}

/**
 * Normaliza el valor guardado a una lista limpia: descarta lo que no es objeto o
 * no tiene nombre (la clave real), recorta espacios y garantiza un `id`
 * correlativo único (reasignándolo si falta o choca). Determinista y sin red,
 * para que sirva igual en la API y en los tests.
 */
export function parseCatalogoInstituciones(raw: unknown): InstitucionArbitralCatalogo[] {
  if (!Array.isArray(raw)) return [];
  const out: InstitucionArbitralCatalogo[] = [];
  let maxId = 0;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const nombre = typeof r.nombre === "string" ? r.nombre.trim() : "";
    if (!nombre) continue; // sin nombre no hay institución que registrar
    const ruc = typeof r.ruc === "string" ? r.ruc.trim() : "";
    let id = typeof r.id === "number" && Number.isInteger(r.id) && r.id > 0 ? r.id : 0;
    if (id === 0 || out.some((x) => x.id === id)) id = maxId + 1;
    maxId = Math.max(maxId, id);
    out.push({ id, nombre, ruc });
  }
  return out.sort((a, b) => a.id - b.id);
}

/** Siguiente correlativo libre para una nueva institución. */
export function siguienteIdCatalogo(lista: InstitucionArbitralCatalogo[]): number {
  return lista.reduce((max, i) => Math.max(max, i.id), 0) + 1;
}
