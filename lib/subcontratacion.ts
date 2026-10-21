/**
 * Apartado g) del requerimiento: subcontratación.
 *
 * El modelo del OECE es explícito en que se incluye **solo uno** de dos
 * supuestos, nunca los dos ni ambos a la vez:
 *
 *   1. Se permite hasta el 40% del monto del contrato vigente (Art. 108), y las
 *      bases pueden especificar qué prestaciones esenciales quedan excluidas.
 *   2. Se prohíbe la subcontratación de las prestaciones objeto del contrato.
 *
 * A esos dos supuestos se suma «No corresponde», para dejar constancia expresa
 * de que el apartado no aplica a esta contratación —en vez de dejarlo en blanco,
 * que se lee como un olvido—.
 *
 * El Art. 108.1 añade una condición que el literal del modelo NO recoge: la
 * prohibición procede «de así haberse evaluado en la estrategia de contratación,
 * con el sustento correspondiente». Prohibir no es gratis —hay que sustentarlo—,
 * y por eso aquí el sustento es parte del dato y no una nota al margen.
 *
 * Se guarda en la columna de texto que ya existía; el editor compone al escribir
 * y vuelve a leer al abrir, como el resto de cuadros de la ficha.
 */

export type ModalidadSubcontratacion = "permitida" | "prohibida" | "no_corresponde";

export type Subcontratacion = {
  modalidad: ModalidadSubcontratacion | null;
  /** Prestaciones esenciales excluidas (solo cuando se permite). */
  prestacionesExcluidas: string;
  /** Sustento de la prohibición (solo cuando se prohíbe). Lo exige el Art. 108.1. */
  sustento: string;
};

export const TEXTO_PERMITIDA =
  "El contratista puede subcontratar hasta un máximo del 40% del monto del contrato vigente, " +
  "de conformidad con lo dispuesto en el artículo 108 del Reglamento.";

const PRESTACIONES =
  "Se consideran prestaciones esenciales que no pueden ser materia de subcontratación las siguientes:";

export const TEXTO_PROHIBIDA =
  "Se encuentra prohibida la subcontratación de las prestaciones objeto del contrato.";

export const TEXTO_NO_CORRESPONDE = "No corresponde.";

const SUSTENTO = "Sustento de la prohibición (Art. 108.1):";

export function parseSubcontratacion(texto: string | null | undefined): Subcontratacion {
  const vacio: Subcontratacion = { modalidad: null, prestacionesExcluidas: "", sustento: "" };
  if (!texto || !texto.trim()) return vacio;

  const lineas = texto.split(/\r?\n/);
  const contiene = (frase: string) => lineas.some((l) => l.trim() === frase);

  const tras = (marca: string) => {
    const i = lineas.findIndex((l) => l.trim() === marca);
    return i < 0 ? "" : lineas.slice(i + 1).join("\n").trim();
  };

  if (contiene(TEXTO_NO_CORRESPONDE)) {
    return { modalidad: "no_corresponde", prestacionesExcluidas: "", sustento: "" };
  }
  if (contiene(TEXTO_PROHIBIDA)) {
    return { modalidad: "prohibida", prestacionesExcluidas: "", sustento: tras(SUSTENTO) };
  }
  if (contiene(TEXTO_PERMITIDA)) {
    return { modalidad: "permitida", prestacionesExcluidas: tras(PRESTACIONES), sustento: "" };
  }
  // Texto escrito a mano antes de que existiera el cuadro: no se interpreta la
  // modalidad —adivinarla seria peor que no saberla— pero no se pierde.
  return { ...vacio, prestacionesExcluidas: texto.trim() };
}

export function componerSubcontratacion(datos: Subcontratacion): string {
  if (datos.modalidad === "no_corresponde") return TEXTO_NO_CORRESPONDE;
  if (datos.modalidad === "prohibida") {
    const partes = [TEXTO_PROHIBIDA];
    const sustento = datos.sustento.trim();
    if (sustento) partes.push("", SUSTENTO, sustento);
    return partes.join("\n");
  }
  if (datos.modalidad === "permitida") {
    const partes = [TEXTO_PERMITIDA];
    const excluidas = datos.prestacionesExcluidas.trim();
    if (excluidas) partes.push("", PRESTACIONES, excluidas);
    return partes.join("\n");
  }
  // Sin modalidad elegida solo sobrevive lo que hubiera escrito a mano.
  return datos.prestacionesExcluidas.trim();
}

/**
 * ¿Falta el sustento de una prohibición?
 *
 * No bloquea el guardado —la ficha es un borrador que se completa por pasos—,
 * pero el Art. 108.1 no admite prohibir sin sustentarlo, y sin este aviso el
 * apartado sale a las bases con una restricción que nadie justificó.
 */
export function faltaSustentoProhibicion(datos: Subcontratacion): boolean {
  return datos.modalidad === "prohibida" && !datos.sustento.trim();
}
