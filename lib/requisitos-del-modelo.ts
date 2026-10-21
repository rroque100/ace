import type { TipoRequisitoArt72 } from "./requisitos-calificacion";

/**
 * Qué requisitos de calificación declara el PDF-modelo del procedimiento.
 *
 * La ficha ofrece los CINCO tipos del Art. 72.3 a todas las necesidades por
 * igual, y los modelos declaran entre cero y cuatro según el objeto y el
 * procedimiento: los de obras nunca traen capacidad legal, el procedimiento no
 * competitivo no trae ninguno, y la capacidad económica no aparece en ninguno de
 * los quince cargados.
 *
 * Esto NO oculta tipos: el Art. 72.3 los permite todos y la entidad puede
 * sustentar uno que su formato no liste. Lo que hace es DECIR cuál pide el
 * formato, igual que la ficha ya marca «exige el proceso» en los campos.
 *
 * Se busca solo donde puede haber un título —letra o numeración delante y
 * mayúsculas— y no en cualquier parte del documento. Buscar la frase suelta daba
 * falsos positivos de los gordos: varios modelos citan «capacidad legal» en una
 * nota que dice que ese dato NO va en esta sección.
 */

/** Patrón del título de cada tipo, tal como aparece en los formatos del OECE. */
const TITULOS: ReadonlyArray<{ frase: string; tipo: TipoRequisitoArt72 }> = [
  { frase: String.raw`CAPACIDAD\s+LEGAL`, tipo: "capacidad_legal" },
  { frase: String.raw`CAPACIDAD\s+T[ÉE]CNICA(?:\s+Y\s+PROFESIONAL)?`, tipo: "capacidad_tecnica" },
  { frase: String.raw`EXPERIENCIA\s+DEL\s+POSTOR`, tipo: "experiencia_postor" },
  { frase: String.raw`(?:CONDICIONES\s+DE\s+)?PARTICIPACI[ÓO]N\s+(?:DE\s+POSTORES\s+)?EN\s+CONSORCIO`, tipo: "consorcio" },
  { frase: String.raw`CAPACIDAD\s+ECON[ÓO]MICA`, tipo: "capacidad_economica" },
];

/**
 * Delante del título hay una letra —«a)», «b.»— o una numeración —«3.5.1»—.
 * Es lo que distingue un apartado de una frase dentro de un párrafo.
 */
function comoTitulo(frase: string): RegExp {
  return new RegExp(String.raw`(?:^|\n|\s)(?:[a-j][.)]|\d(?:\.\d{1,2}){0,3}\.?)\s{0,4}` + frase, "i");
}

/** Los tipos que este modelo declara como apartado. */
export function tiposDelModelo(texto: string): Set<TipoRequisitoArt72> {
  const out = new Set<TipoRequisitoArt72>();
  for (const { frase, tipo } of TITULOS) {
    if (comoTitulo(frase).test(texto)) out.add(tipo);
  }
  return out;
}

/** Lista ordenada y estable, para viajar por la API. */
export function tiposDelModeloComoLista(texto: string): TipoRequisitoArt72[] {
  const encontrados = tiposDelModelo(texto);
  return TITULOS.filter((t) => encontrados.has(t.tipo)).map((t) => t.tipo);
}
