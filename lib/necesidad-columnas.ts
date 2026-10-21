// Conversión ficha (camelCase) ↔ columna (snake_case) de `necesidades`.
//
// El PATCH y el POST mapeaban los ~60 campos A MANO, campo por campo. Ese es el
// patrón que rompió tres veces en una sola jornada: se añadía un campo al
// schema y a la UI, se guardaba "con éxito", y nunca llegaba a la columna
// porque nadie lo añadió también a la lista manual —silencioso, porque un
// campo ausente no es un error—. Pasó con `nombre`, con `cui` y con `year`.
//
// La relación es 1:1: `tipoObjeto → tipo_objeto`, `anioFiscal → anio_fiscal`.
// Derivar la columna del nombre elimina la lista manual y, con ella, toda esta
// clase de bug: un campo nuevo en el schema llega solo a su columna.

import { necesidadCreateSchema } from "./necesidades";

/** camelCase → snake_case. `anioFiscal` → `anio_fiscal`. */
export function aColumna(campo: string): string {
  return campo.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

/**
 * Campos del schema que NO son columnas de `necesidades`.
 *
 * - `status`: lo gobierna la máquina de estados (transicion), no un PATCH suelto.
 * - `nroPedido` / `pedidoSecuencia`: referencia al pedido SIGA; se usan para
 *   vincular la fila de `pedidos_siga`, no se guardan en `necesidades`.
 * - `tipoArea`: se mapea aparte porque su valor se normaliza.
 */
export const CAMPOS_NO_COLUMNA = new Set(["status", "nroPedido", "pedidoSecuencia"]);

/**
 * Construye el patch (columna → valor) desde los datos ya validados del schema.
 *
 * Solo incluye las claves PRESENTES en `data`: en un PATCH parcial, un campo
 * ausente no debe pisar la columna con null. El POST, que envía todo, obtiene
 * el registro completo igual.
 */
export function construirColumnas(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(data)) {
    if (CAMPOS_NO_COLUMNA.has(campo)) continue;
    // "" → null: una columna text no debe guardar cadena vacía.
    out[aColumna(campo)] = valor === "" ? null : valor;
  }
  return out;
}

/** Todas las columnas que la ficha puede escribir (para el `select=` de lectura). */
export function columnasSelect(): string[] {
  const shape = necesidadCreateSchema.shape as Record<string, unknown>;
  return Object.keys(shape)
    .filter((k) => !CAMPOS_NO_COLUMNA.has(k))
    .map(aColumna);
}
