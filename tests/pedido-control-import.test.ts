import { describe, expect, it } from "vitest";
import {
  agruparPedidosControl,
  itemsDePedidoControl,
  itemsDelPedido,
  mapPedidoControlToNecesidad,
  type SigaPedidoControlRow,
  type SigaPedidoItemControlRow,
} from "@/lib/pedido-control-import";

const PEDIDO_BASE: SigaPedidoControlRow = {
  ano_eje: "2026",
  area: "SUB GERENCIA DE EJECUCION DE INVERSIONES Y MANTENIMIENTO",
  centro_costo: "01051102",
  concepto: "INGRESO POR ADQ. PIZARRAS Y JUEGOS RECREATIVOS SEGUN O/C N° 1100",
  cui: "2464895",
  fecha: "2026-05-25",
  meta: "136",
  nro_pedido: "1388",
  nro_pedido_siga: "001388",
  tipo_bien: "B",
};

const ITEMS_BASE: SigaPedidoItemControlRow[] = [
  { cantidad: 2, codigo: "746421520001", descripcion: "CAMA DE MADERA", precio_ref: 900, secuencia: 1, unidad: "UNIDAD" },
  { cantidad: 2, codigo: "746473050158", descripcion: "PIZARRA ACRILICA", precio_ref: 398, secuencia: 2, unidad: "UNIDAD" },
];

describe("mapPedidoControlToNecesidad", () => {
  it("mapea la cabecera del pedido a los campos de la necesidad", () => {
    const out = mapPedidoControlToNecesidad(PEDIDO_BASE, ITEMS_BASE);
    expect(out.nombre).toBe(PEDIDO_BASE.concepto);
    expect(out.tipoObjeto).toBe("bienes");
    expect(out.areaUsuaria).toBe(PEDIDO_BASE.area);
    expect(out.centroCosto).toBe(PEDIDO_BASE.centro_costo);
    expect(out.metaPresupuestal).toBe("136");
    expect(out.cui).toBe("2464895");
    expect(out.anioFiscal).toBe(2026);
    expect(out.fechaRequerida).toBe("2026-05-25");
    expect(out.nroPedido).toBe("1388");
  });

  it("tipo_bien 'S' clasifica como servicios; cualquier otro valor cae a bienes", () => {
    expect(mapPedidoControlToNecesidad({ ...PEDIDO_BASE, tipo_bien: "S" }, ITEMS_BASE).tipoObjeto).toBe("servicios");
    expect(mapPedidoControlToNecesidad({ ...PEDIDO_BASE, tipo_bien: null }, ITEMS_BASE).tipoObjeto).toBe("bienes");
  });

  it("suma el monto estimado a partir del precio_ref de cada ítem (única fuente con precio)", () => {
    const out = mapPedidoControlToNecesidad(PEDIDO_BASE, ITEMS_BASE);
    // 2*900 + 2*398 = 2596
    expect(out.montoEstimado).toBe(2596);
  });

  it("sin precio_ref no inventa un monto", () => {
    const sinPrecio = ITEMS_BASE.map((it) => ({ ...it, precio_ref: null }));
    const out = mapPedidoControlToNecesidad(PEDIDO_BASE, sinPrecio);
    expect(out.montoEstimado).toBeUndefined();
  });

  it("arma el desagregado con código, unidad, cantidad y costo por ítem", () => {
    const items = itemsDePedidoControl(ITEMS_BASE);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      cantidad: 2,
      codigoCatalogo: "746421520001",
      costoTotal: 1800,
      costoUnitario: 900,
      descripcion: "CAMA DE MADERA",
      nro: 1,
      unidadMedida: "UNIDAD",
    });
  });

  it("rellena proyectoInversion desde siga_consolidado cuando hay espec_tecnicas", () => {
    const out = mapPedidoControlToNecesidad(PEDIDO_BASE, ITEMS_BASE, { espec_tecnicas: "MEJORAMIENTO DEL SERVICIO DE..." });
    expect(out.proyectoInversion).toBe("MEJORAMIENTO DEL SERVICIO DE...");
  });

  it("sin consolidado (o con espec_tecnicas null) no inventa el proyecto", () => {
    expect(mapPedidoControlToNecesidad(PEDIDO_BASE, ITEMS_BASE).proyectoInversion).toBeUndefined();
    expect(mapPedidoControlToNecesidad(PEDIDO_BASE, ITEMS_BASE, { espec_tecnicas: null }).proyectoInversion).toBeUndefined();
  });
});

// Caso real: el N° de pedido "1838" corresponde a DOS pedidos sin relación
// (un bien "SERVIDOR" y un servicio "SEGURO COMPLEMENTARIO..."), verificado
// contra el proyecto "control". nro_pedido solo no basta para separarlos.
describe("nro_pedido no único: separar pedidos que comparten número", () => {
  const PEDIDO_BIEN: SigaPedidoControlRow = { ...PEDIDO_BASE, area: "GERENCIA DE SERVICIOS MUNICIPALES", concepto: "ADQUISICION DE SERVIDOR", nro_pedido: "1838", tipo_bien: "B" };
  const PEDIDO_SERVICIO: SigaPedidoControlRow = { ...PEDIDO_BASE, area: "GERENCIA DE DESARROLLO SOCIAL", concepto: "SERVICIO DE SEGURO", cui: "2660398", meta: "99", nro_pedido: "1838", tipo_bien: "S" };
  const ITEM_BIEN: SigaPedidoItemControlRow = { ano_eje: "2026", cantidad: 1, codigo: "740892000001", descripcion: "SERVIDOR", precio_ref: 80000, secuencia: 1, tipo_bien: "B", unidad: "UNIDAD" };
  const ITEM_SERVICIO: SigaPedidoItemControlRow = { ano_eje: "2026", cantidad: 1054.63, codigo: "850100070006", descripcion: "SEGURO", precio_ref: 1, secuencia: 1, tipo_bien: "S", unidad: "SERVICIO" };

  it("agruparPedidosControl deduplica por (tipo_bien, ano_eje), sin descartar pedidos genuinamente distintos", () => {
    const grupos = agruparPedidosControl([PEDIDO_BIEN, PEDIDO_SERVICIO]);
    expect(grupos).toHaveLength(2);
    // Una repetición exacta (misma fila dos veces) sí se deduplica.
    expect(agruparPedidosControl([PEDIDO_BIEN, PEDIDO_BIEN])).toHaveLength(1);
  });

  it("itemsDelPedido separa las líneas de cada pedido, no las mezcla", () => {
    const todas = [ITEM_BIEN, ITEM_SERVICIO];
    expect(itemsDelPedido(todas, PEDIDO_BIEN)).toEqual([ITEM_BIEN]);
    expect(itemsDelPedido(todas, PEDIDO_SERVICIO)).toEqual([ITEM_SERVICIO]);
  });

  it("el mapeo de cada grupo no arrastra el nombre/ítems del otro", () => {
    const necesidadBien = mapPedidoControlToNecesidad(PEDIDO_BIEN, itemsDelPedido([ITEM_BIEN, ITEM_SERVICIO], PEDIDO_BIEN));
    expect(necesidadBien.nombre).toBe("ADQUISICION DE SERVIDOR");
    expect(necesidadBien.tipoObjeto).toBe("bienes");
    expect(necesidadBien.items).toHaveLength(1);
    expect(necesidadBien.items?.[0].descripcion).toBe("SERVIDOR");
  });
});
