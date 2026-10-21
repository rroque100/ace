// Import de un Pedido de Compra a una Necesidad, buscando por N° de pedido en
// `siga_pedido`/`siga_pedido_item` del proyecto "control" (una app externa del
// usuario — ver lib/control-supabase.ts) en vez de subir el archivo .xlsx del
// SIGA (lib/pedido-compra-import.ts).
//
// Es una fuente DISTINTA con columnas DISTINTAS (esa tabla ya viene resumida
// del export original, no son las mismas 47 columnas), así que el mapeo es
// propio — pero el TIPO de salida es el mismo `PedidoNecesidadImport` que ya
// usa el import por archivo, para que el resto del flujo (el modal, el
// desagregado en ítems, crear la necesidad) sea idéntico sin importar de
// dónde vino el dato.
//
// A diferencia del export .xlsx —que NO trae precio por línea—, aquí
// `precio_ref` sí da un costo unitario real: es la única fuente de las dos que
// puede calcular el monto estimado sin que el usuario lo teclee.

import type { PedidoItem, PedidoNecesidadImport } from "./pedido-compra-import";

export type SigaPedidoControlRow = {
  ano_eje: string | number | null;
  area: string | null;
  centro_costo: string | null;
  concepto: string | null;
  cui: string | null;
  fecha: string | null;
  meta: string | null;
  nro_pedido: string;
  nro_pedido_siga?: string | null;
  tipo_bien: string | null;
};

// El N° de pedido NO es único por sí solo en esta fuente: dos pedidos
// distintos y sin relación (áreas, meta, CUI y concepto diferentes) pueden
// compartir el mismo `nro_pedido` si son de distinto `tipo_bien` — se
// comprobó con datos reales (N° 1838: un pedido de bienes "SERVIDOR" y uno de
// servicios "SEGURO COMPLEMENTARIO..." completamente distintos). Por eso
// `tipo_bien`/`ano_eje` viajan también en el ítem: son la clave real
// (nro_pedido, tipo_bien, ano_eje) para separar las líneas de cada pedido, no
// solo `nro_pedido`.
export type SigaPedidoItemControlRow = {
  ano_eje?: string | number | null;
  cantidad: number | string | null;
  codigo: string | null;
  descripcion: string | null;
  precio_ref: number | string | null;
  secuencia?: number | string | null;
  tipo_bien?: string | null;
  unidad: string | null;
};

// De `siga_consolidado`: lo que puede aportar el nombre/descripción del
// proyecto que el pedido no trae. `espec_tecnicas` es el texto libre más
// cercano a eso; puede venir null (no todo pedido tiene un consolidado con
// ese dato relleno) — en ese caso no se rellena `proyectoInversion`, no se
// inventa.
export type SigaConsolidadoRow = { espec_tecnicas: string | null };

function txt(v: unknown): string {
  return String(v ?? "").trim();
}

function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// tipo_bien de `siga_pedido`: "B" (bien) visto en datos reales; "S" para
// servicio por analogía con el resto del sistema. Cualquier otro valor cae a
// "bienes" — mismo criterio por defecto que el import por archivo.
function tipoObjetoDeControl(tipoBien: string | null): PedidoNecesidadImport["tipoObjeto"] {
  return txt(tipoBien).toUpperCase() === "S" ? "servicios" : "bienes";
}

function sustantivoPedido(tipoObjeto: PedidoNecesidadImport["tipoObjeto"]): "compra" | "servicio" {
  return tipoObjeto === "servicios" ? "servicio" : "compra";
}

/**
 * Filtra, de TODAS las líneas devueltas para un `nro_pedido`, solo las que
 * pertenecen a ESTE pedido concreto (mismo tipo_bien y año fiscal). Sin esto,
 * dos pedidos sin relación que comparten número se mezclaban en una sola
 * necesidad — ver la nota en `SigaPedidoItemControlRow`.
 */
export function itemsDelPedido(
  todasLasLineas: SigaPedidoItemControlRow[],
  pedido: SigaPedidoControlRow,
): SigaPedidoItemControlRow[] {
  return todasLasLineas.filter(
    (row) =>
      txt(row.tipo_bien).toUpperCase() === txt(pedido.tipo_bien).toUpperCase() &&
      txt(row.ano_eje) === txt(pedido.ano_eje),
  );
}

/**
 * Agrupa las filas de `siga_pedido` que comparten `nro_pedido` en pedidos
 * REALMENTE distintos (por tipo_bien + año fiscal). Casi siempre devuelve un
 * solo grupo; cuando devuelve más de uno, el llamador debe tratarlos como
 * pedidos separados (mismo criterio que ya usa la UI para un archivo .xlsx
 * con varios pedidos: se listan para que el usuario elija, no se fusionan).
 */
export function agruparPedidosControl(pedidos: SigaPedidoControlRow[]): SigaPedidoControlRow[] {
  const vistos = new Set<string>();
  const out: SigaPedidoControlRow[] = [];
  for (const p of pedidos) {
    const clave = `${txt(p.tipo_bien).toUpperCase()}||${txt(p.ano_eje)}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push(p);
  }
  return out;
}

/** Convierte los ítems de `siga_pedido_item` al desagregado del requerimiento. */
export function itemsDePedidoControl(rows: SigaPedidoItemControlRow[]): PedidoItem[] {
  return rows.map((row, i) => {
    const cantidad = num(row.cantidad);
    const precio = num(row.precio_ref);
    const item: PedidoItem = { descripcion: txt(row.descripcion), nro: i + 1 };
    const codigo = txt(row.codigo);
    if (codigo) item.codigoCatalogo = codigo;
    const unidad = txt(row.unidad);
    if (unidad) item.unidadMedida = unidad;
    if (cantidad !== undefined) item.cantidad = cantidad;
    // Único de las dos fuentes que trae precio por línea: el .xlsx del SIGA no
    // lo tiene (ver la nota en pedido-compra-import.ts:itemsDePedido).
    if (precio !== undefined) {
      item.costoUnitario = precio;
      if (cantidad !== undefined) item.costoTotal = Math.round(cantidad * precio * 100) / 100;
    }
    return item;
  });
}

/** Mapea un pedido de `siga_pedido` + sus líneas de `siga_pedido_item` a una Necesidad. */
export function mapPedidoControlToNecesidad(
  pedido: SigaPedidoControlRow,
  itemRows: SigaPedidoItemControlRow[],
  consolidado?: SigaConsolidadoRow | null,
): PedidoNecesidadImport {
  const tipoObjeto = tipoObjetoDeControl(pedido.tipo_bien);
  const nroPedido = txt(pedido.nro_pedido);
  const items = itemsDePedidoControl(itemRows);

  const out: PedidoNecesidadImport = {
    items,
    nombre: txt(pedido.concepto),
    nroPedido,
    tipoObjeto,
  };

  const areaUsuaria = txt(pedido.area);
  if (areaUsuaria) out.areaUsuaria = areaUsuaria;
  const centroCosto = txt(pedido.centro_costo);
  if (centroCosto) out.centroCosto = centroCosto;
  const metaPresupuestal = txt(pedido.meta);
  if (metaPresupuestal) out.metaPresupuestal = metaPresupuestal;
  const cui = txt(pedido.cui);
  if (cui) out.cui = cui;
  const proyectoInversion = txt(consolidado?.espec_tecnicas);
  if (proyectoInversion) out.proyectoInversion = proyectoInversion;
  const anioFiscal = num(pedido.ano_eje);
  if (anioFiscal !== undefined) out.anioFiscal = anioFiscal;
  // `fecha` ya viene en formato ISO ("2026-05-25") en esta fuente, a diferencia
  // del export .xlsx del SIGA (que trae "22/04/2026 11:44:55" y necesita
  // parsePedidoCompra/parseFechaSiga).
  const fecha = txt(pedido.fecha);
  if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) out.fechaRequerida = fecha.slice(0, 10);

  // Único de las dos fuentes que puede calcular el monto sin que el usuario lo
  // teclee (ver itemsDePedidoControl): se suman los costoTotal con precio.
  const montos = items.map((i) => i.costoTotal).filter((m): m is number => typeof m === "number");
  if (montos.length > 0) {
    out.montoEstimado = Math.round(montos.reduce((a, b) => a + b, 0) * 100) / 100;
  }

  if (nroPedido) {
    out.summary =
      items.length > 1
        ? `Pedido de ${sustantivoPedido(tipoObjeto)} SIGA N° ${nroPedido} (${items.length} ítems), importado de control.`
        : `Pedido de ${sustantivoPedido(tipoObjeto)} SIGA N° ${nroPedido}, importado de control.`;
  }

  return out;
}
