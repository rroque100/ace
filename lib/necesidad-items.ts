/**
 * Desagregado del requerimiento en ítems (sección 3.2 de las Bases) y las
 * consecuencias que la norma hace derivar de esa lista.
 *
 * Tres reglas, cada una con su artículo. Ninguna decide por el usuario: las tres
 * calculan lo que la norma dice y dejan el juicio donde la norma lo pone.
 */

import { evaluarAgrupamientoPorItems, type VeredictoAgrupamiento } from "./umbral-contrato-menor";

export type NecesidadItem = {
  id?: string;
  nro: number;
  descripcion: string;
  codigoCatalogo?: string | null;
  unidadMedida?: string | null;
  cantidad?: number | null;
  costoUnitario?: number | null;
  costoTotal?: number | null;
  /** Solo cuando difiere del objeto de la necesidad (Art. 52.1.b). */
  tipoObjeto?: string | null;
  /** Paquete al que pertenece (Art. 52.1.a). Nulo = sin empaquetar. */
  nroPaquete?: number | null;
  /**
   * Descripción del objeto contractual del paquete. Igual en todos los ítems del
   * mismo paquete: el servidor la normaliza al guardar.
   */
  descripcionPaquete?: string | null;
};

export type Paquete = {
  nro: number;
  items: NecesidadItem[];
  /** Suma de los ítems del paquete: es lo que se contrata como un solo objeto. */
  monto: number | null;
  /** El objeto contractual único que forman (Art. 52.1.a). */
  descripcion: string;
};

/** Redondeo a céntimos. Sumar decimales sin esto arrastra 0.000000001. */
function aCentimos(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Importe de un ítem: el declarado manda sobre el producto.
 *
 * El SIGA entrega importes ya redondeados que no siempre reproducen
 * cantidad × unitario. Recalcular por encima del dato del pedido cambiaría
 * cifras que el área usuaria no escribió.
 */
export function importeItem(item: NecesidadItem): number | null {
  if (typeof item.costoTotal === "number" && Number.isFinite(item.costoTotal)) {
    return aCentimos(item.costoTotal);
  }
  const { cantidad, costoUnitario } = item;
  if (
    typeof cantidad === "number" &&
    Number.isFinite(cantidad) &&
    typeof costoUnitario === "number" &&
    Number.isFinite(costoUnitario)
  ) {
    return aCentimos(cantidad * costoUnitario);
  }
  return null;
}

/**
 * REGLA 1 — Art. 52.1.b: cada ítem debe superar el tope del contrato menor.
 * Se delega en el módulo del umbral, que es quien conoce las 8 UIT.
 */
export function evaluarAgrupamiento(
  items: NecesidadItem[],
  uitValor: number | null | undefined,
): VeredictoAgrupamiento {
  return evaluarAgrupamientoPorItems(
    items.map((i) => ({ costoTotal: importeItem(i), nro: i.nro })),
    uitValor,
  );
}

/**
 * REGLA 2 — Art. 53.3: en los procedimientos según relación de ítems, lotes o
 * tramos "la cuantía de la contratación se establece por la sumatoria de los
 * valores de cada uno".
 *
 * `null` con la lista vacía —no 0—: sin ítems la cuantía no es cero, es que
 * todavía no se ha desagregado, y un 0 se guardaría como si fuera un importe.
 */
export function cuantiaPorSumatoria(items: NecesidadItem[]): number | null {
  if (items.length === 0) return null;
  const importes = items.map(importeItem);
  if (importes.every((i) => i === null)) return null;
  return aCentimos(importes.reduce<number>((acc, i) => acc + (i ?? 0), 0));
}

export type DiscrepanciaCuantia = {
  sumatoria: number;
  declarado: number;
  diferencia: number;
};

/**
 * ¿El monto estimado escrito a mano contradice la suma de los ítems?
 *
 * No se corrige solo: el monto declarado puede venir del PAC y la diferencia ser
 * el dato interesante. Se señala para que alguien decida.
 */
export function discrepanciaCuantia(
  items: NecesidadItem[],
  montoDeclarado: number | null | undefined,
): DiscrepanciaCuantia | null {
  const sumatoria = cuantiaPorSumatoria(items);
  if (sumatoria === null) return null;
  if (typeof montoDeclarado !== "number" || !Number.isFinite(montoDeclarado)) return null;
  const diferencia = aCentimos(montoDeclarado - sumatoria);
  // Tolerancia de un céntimo: el redondeo de importes del SIGA no es una
  // contradicción que merezca avisar.
  if (Math.abs(diferencia) <= 0.01) return null;
  return { declarado: aCentimos(montoDeclarado), diferencia, sumatoria };
}

export type ObjetoSugerido = {
  objeto: string;
  /** Importe acumulado de las prestaciones de ese objeto. */
  monto: number;
  /** Hay más de un objeto en juego: es cuando el Art. 44.10 se aplica de verdad. */
  hayVarios: boolean;
};

/**
 * REGLA 3 — Art. 44.10: "En el caso de contrataciones que involucren diversos
 * tipos de prestaciones, el objeto se determina en función a la prestación que
 * represente el mayor costo, siempre que no desvirtúe la naturaleza de la
 * contratación."
 *
 * Devuelve una SUGERENCIA, no una imposición: esa última condición —que no
 * desvirtúe la naturaleza— es un juicio, y el artículo la deja al criterio de
 * quien formula. Se acumula por objeto, no se toma el ítem más caro suelto: lo
 * que compara la norma son las prestaciones por tipo.
 */
export function objetoSugerido(
  items: NecesidadItem[],
  objetoNecesidad: string | null | undefined,
): ObjetoSugerido | null {
  const porObjeto = new Map<string, number>();
  for (const item of items) {
    // Un ítem sin objeto propio hereda el de la necesidad (el caso corriente).
    const objeto = (item.tipoObjeto ?? objetoNecesidad ?? "").trim();
    if (!objeto) continue;
    const importe = importeItem(item);
    if (importe === null) continue;
    porObjeto.set(objeto, aCentimos((porObjeto.get(objeto) ?? 0) + importe));
  }
  if (porObjeto.size === 0) return null;

  const ordenados = [...porObjeto.entries()].sort((a, b) => b[1] - a[1]);
  const [objeto, monto] = ordenados[0]!;
  return { hayVarios: porObjeto.size > 1, monto, objeto };
}

/**
 * Agrupa los ítems por paquete (Art. 52.1.a), en orden de número de paquete.
 *
 * Los que no llevan paquete quedan fuera: no es lo mismo "sin empaquetar" que
 * "paquete 0". Un requerimiento puede tener parte empaquetada y parte suelta.
 */
export function agruparPorPaquete(items: NecesidadItem[]): Paquete[] {
  const mapa = new Map<number, NecesidadItem[]>();
  for (const item of items) {
    const nro = item.nroPaquete;
    if (typeof nro !== "number" || !Number.isFinite(nro)) continue;
    mapa.set(nro, [...(mapa.get(nro) ?? []), item]);
  }
  return [...mapa.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([nro, itemsDelPaquete]) => ({
      // La primera no vacía: al guardar quedan todas iguales, pero mientras se
      // edita puede haberse escrito solo en una fila.
      descripcion: itemsDelPaquete.map((i) => (i.descripcionPaquete ?? "").trim()).find(Boolean) ?? "",
      items: itemsDelPaquete,
      monto: cuantiaPorSumatoria(itemsDelPaquete),
      nro,
    }));
}

/**
 * Deja la descripción del paquete igual en todos sus ítems.
 *
 * El dato es del PAQUETE pero se guarda en cada ítem (ver la migración): esto es
 * lo que impide que dos filas del mismo paquete acaben diciendo cosas distintas.
 * Se aplica en el servidor al guardar y en el cliente al escribir.
 */
export function normalizarDescripcionPaquete(items: NecesidadItem[]): NecesidadItem[] {
  const porPaquete = new Map<number, string>();
  for (const item of items) {
    const nro = item.nroPaquete;
    if (typeof nro !== "number" || !Number.isFinite(nro)) continue;
    const desc = (item.descripcionPaquete ?? "").trim();
    if (desc && !porPaquete.has(nro)) porPaquete.set(nro, desc);
  }
  return items.map((item) => {
    const nro = item.nroPaquete;
    if (typeof nro !== "number" || !Number.isFinite(nro)) {
      // Un ítem que sale del paquete no se lleva su descripción.
      return { ...item, descripcionPaquete: null };
    }
    return { ...item, descripcionPaquete: porPaquete.get(nro) ?? null };
  });
}

export type FilaCuadro = {
  item: NecesidadItem;
  /** Filas que abarca la celda del paquete; 0 = esta fila no la dibuja. */
  filasPaquete: number;
  paquete: Paquete | null;
};

/**
 * Orden de pintado del cuadro: los ítems de un paquete quedan CONTIGUOS y la
 * primera fila del grupo lleva la celda combinada.
 *
 * Sin reordenar, combinar es imposible: una celda no puede abarcar filas
 * salteadas. Los sueltos van al final, después de los paquetes.
 */
export function filasParaCuadro(items: NecesidadItem[]): FilaCuadro[] {
  const filas: FilaCuadro[] = [];
  for (const paquete of agruparPorPaquete(items)) {
    paquete.items.forEach((item, i) => {
      filas.push({ filasPaquete: i === 0 ? paquete.items.length : 0, item, paquete });
    });
  }
  for (const item of itemsSinPaquete(items)) {
    filas.push({ filasPaquete: 0, item, paquete: null });
  }
  return filas;
}

/** Ítems que no pertenecen a ningún paquete. */
export function itemsSinPaquete(items: NecesidadItem[]): NecesidadItem[] {
  return items.filter((i) => typeof i.nroPaquete !== "number" || !Number.isFinite(i.nroPaquete));
}

/**
 * Un paquete de un solo ítem no es un paquete.
 *
 * El Art. 52.1.a define el paquete como la agrupación de VARIOS bienes o
 * servicios en un mismo objeto contractual. Con uno solo no se agrupa nada: o
 * sobra el paquete, o falta meterle el resto de sus ítems.
 */
export function paquetesDeUnSoloItem(items: NecesidadItem[]): number[] {
  return agruparPorPaquete(items)
    .filter((p) => p.items.length === 1)
    .map((p) => p.nro);
}

/**
 * Ítems sin código de catálogo cuando el procedimiento lo exige.
 *
 * La Subasta Inversa Electrónica se convoca sobre bienes o servicios COMUNES que
 * cuentan con ficha técnica del Listado (Art. 95 del Reglamento): sin el código
 * no hay ficha que referenciar. La exigencia estaba en el campo de cabecera de la
 * ficha, que solo admitía UN código para toda la necesidad; al pasar el código a
 * cada ítem, se comprueba por ítem. Devuelve los `nro` que lo tienen vacío, y
 * lista vacía en cualquier otro procedimiento.
 */
export function itemsSinCodigoCatalogo(
  items: NecesidadItem[],
  tipoProceso: string | null | undefined,
): number[] {
  if ((tipoProceso ?? "").trim() !== "Subasta Inversa Electrónica") return [];
  return items.filter((it) => !(it.codigoCatalogo ?? "").trim()).map((it) => it.nro);
}

/**
 * Renumera 1..n conservando el orden recibido.
 *
 * El `nro` es único por necesidad en la base y además se imprime y se cita
 * ("ítem 3 declarado desierto"), así que tras insertar o borrar en medio hay que
 * rehacerlo entero.
 */
export function renumerar(items: NecesidadItem[]): NecesidadItem[] {
  return items.map((item, i) => ({ ...item, nro: i + 1 }));
}
