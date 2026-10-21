/**
 * Reglas que deciden QUE campos ve el area usuaria en la ficha del
 * requerimiento: cuales aplican, cuales son obligatorios, cuales exige el modelo
 * del proceso, en que orden se muestran y cuanto se ha completado.
 *
 * Vivian dentro de `necesidad-detail.tsx`, declaradas como funciones del cuerpo
 * del render que cerraban sobre el estado del componente. Eran puras de verdad
 * —solo dependen de los ejes (objeto + proceso), del modelo y de si hay valor—
 * pero nada lo decia, y no se podian probar sin montar React. Aqui reciben esos
 * ejes en un objeto explicito y quedan cubiertas por un suite de Node.
 *
 * El componente conserva sus funciones con el mismo nombre y firma, delegando en
 * estas; asi el centenar de referencias del JSX no se toca.
 */
import type { Necesidad } from "./necesidades";
import {
  campoAplica,
  campoObligatorio,
  FICHA_SECCIONES,
  type FichaField,
  type FichaSection,
} from "./necesidad-ficha-secciones";
import type { ObjetoFilter } from "./procesos-seleccion";

/**
 * Los ejes que deciden que ficha se pinta, en un solo objeto.
 *
 * `objetosEfectivos` se deriva de proceso + objeto (`objetosEfectivosDe`) y se
 * pasa ya calculado para no recomputarlo en cada predicado. `exigidosModelo` son
 * los campos que el PDF-modelo del procedimiento declara exigidos; `hayItems`
 * dice si el requerimiento esta desagregado en items (desactiva la exigencia de
 * los campos que describen UNA prestacion, cuyo dato vive en cada item).
 */
export type EjesFicha = {
  proceso: string;
  objeto: ObjetoFilter | "";
  objetosEfectivos: ObjetoFilter[];
  exigidosModelo: ReadonlySet<string>;
  hayItems: boolean;
};

/**
 * Obligatorio incondicional + condicional por objeto (`obligatorioPara`) +
 * condicional por procedimiento (`obligatorioEnProceso`). Con el requerimiento
 * desagregado, los campos de UNA prestacion (`noExigibleConItems`) dejan de
 * exigirse: el dato vive en cada item. Manda sobre cualquier otro criterio.
 */
export function esCampoObligatorio(field: FichaField, ejes: EjesFicha): boolean {
  if (field.noExigibleConItems && ejes.hayItems) return false;
  return campoObligatorio(field, ejes.objetosEfectivos, ejes.proceso);
}

/**
 * Campos que APLICAN al objeto y al procedimiento actuales. Los `oculto` (p. ej.
 * Centro de costo) quedan fuera: no se muestran ni se validan, su valor lo aporta
 * su gemelo desde el payload.
 */
export function camposAplicables(fields: FichaField[], ejes: EjesFicha): FichaField[] {
  return fields.filter((f) => !f.oculto && campoAplica(f, ejes.objetosEfectivos, ejes.proceso));
}

/**
 * UNICA definicion de «exigible»: lo que la ficha declara obligatorio MAS lo que
 * el PDF-modelo del procedimiento anade. El modelo SUMA, no resta.
 */
export function esCampoExigible(field: FichaField, ejes: EjesFicha): boolean {
  return (
    campoObligatorio(field, ejes.objetosEfectivos, ejes.proceso) || ejes.exigidosModelo.has(field.api)
  );
}

/** ¿El campo tiene un valor capturado en el FORMULARIO en edicion? */
export function tieneValorEnForm(fichaForm: Record<string, string>, field: FichaField): boolean {
  const v = fichaForm[field.api];
  return v !== undefined && v !== null && String(v).trim() !== "" && v !== "false";
}

/** ¿El campo tiene un valor GUARDADO en la necesidad (vista de lectura)? */
export function tieneValorGuardado(necesidad: Necesidad | null, field: FichaField): boolean {
  const v = necesidad?.[field.col];
  return v !== null && v !== undefined && String(v).trim() !== "" && v !== false;
}

/** Prioridad de orden: obligatorio (0) → recomendado (1) → opcional (2). */
export function prioridadDeCampo(f: FichaField, ejes: EjesFicha): number {
  return esCampoObligatorio(f, ejes) ? 0 : f.recomendado ? 1 : 2;
}

/**
 * Campos a mostrar en una seccion segun el modo (obligatorios vs todos).
 *
 * Los SUBGRUPOS no se reordenan: son los apartados a), b), c)… del modelo
 * oficial, y su orden es el del documento que se va a firmar. Dentro de cada
 * subgrupo si manda la prioridad (obligatorio primero); `sort` es estable, asi
 * que a igual prioridad se conserva la secuencia de las Bases.
 *
 * Con `mostrarTodos` se devuelven todos. Sin el, con MODELO cargado manda el
 * modelo (obligatorio | exigido | ya-relleno); sin modelo, el criterio por
 * objeto (obligatorio | recomendado | ya-relleno). En ambos casos se conserva lo
 * ya rellenado: ocultar un dato que alguien escribio seria hacerlo desaparecer.
 * Los acompañantes (`juntoA`) entran con su pareja, no por su cuenta.
 */
export function camposVisiblesDeSeccion(
  section: FichaSection,
  ejes: EjesFicha,
  opts: { mostrarTodos: boolean; tieneValor: (f: FichaField) => boolean },
): { visibles: FichaField[]; ocultosOpcionales: number } {
  const declarados = camposAplicables(section.fields, ejes);
  const posSubgrupo = new Map<string, number>();
  declarados.forEach((f, idx) => {
    const clave = f.subgrupo ?? "";
    if (!posSubgrupo.has(clave)) posSubgrupo.set(clave, idx);
  });
  const all = [...declarados].sort((a, b) => {
    const sa = posSubgrupo.get(a.subgrupo ?? "") ?? 0;
    const sb = posSubgrupo.get(b.subgrupo ?? "") ?? 0;
    return sa !== sb ? sa - sb : prioridadDeCampo(a, ejes) - prioridadDeCampo(b, ejes);
  });
  if (opts.mostrarTodos) {
    return { visibles: all, ocultosOpcionales: 0 };
  }
  const visibles =
    ejes.exigidosModelo.size > 0
      ? all.filter((f) => esCampoObligatorio(f, ejes) || ejes.exigidosModelo.has(f.api) || opts.tieneValor(f))
      : all.filter((f) => esCampoObligatorio(f, ejes) || f.recomendado || opts.tieneValor(f));
  const apisVisibles = new Set(visibles.map((f) => f.api));
  const conAcompanantes = all.filter(
    (f) => apisVisibles.has(f.api) || (f.juntoA ? apisVisibles.has(f.juntoA) : false),
  );
  return { visibles: conAcompanantes, ocultosOpcionales: all.length - conAcompanantes.length };
}

/**
 * Todos los campos EXIGIBLES del proceso actual (objeto + procedimiento),
 * respetando el `mostrarPara` de la seccion. El modelo SUMA: la lista del PDF
 * marca lo que ese procedimiento exige DE MAS, nunca degrada un obligatorio que
 * la ficha —y con ella la norma— ya declara.
 */
export function obligatoriosDelProceso(ejes: EjesFicha): FichaField[] {
  const items: FichaField[] = [];
  for (const section of FICHA_SECCIONES) {
    if (section.mostrarPara && !(ejes.objeto && section.mostrarPara.includes(ejes.objeto as ObjetoFilter))) {
      continue;
    }
    for (const f of section.fields) {
      if (f.oculto || !campoAplica(f, ejes.objetosEfectivos, ejes.proceso)) continue;
      if (esCampoExigible(f, ejes)) items.push(f);
    }
  }
  return items;
}

/**
 * Avance del requerimiento: UN numero para toda la pantalla. `hecho` decide de
 * donde sale el valor —del formulario en edicion, del dato guardado en lectura—;
 * nunca QUE se cuenta, para que la cabecera, el panel y la barra no discrepen.
 */
export function avanceDeObligatorios(
  campos: FichaField[],
  hecho: (f: FichaField) => boolean,
): { done: number; faltan: number; pct: number; total: number } {
  const total = campos.length;
  const done = campos.filter(hecho).length;
  return { done, faltan: total - done, pct: total > 0 ? Math.round((done / total) * 100) : 0, total };
}
