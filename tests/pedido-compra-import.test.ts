import { describe, expect, it } from "vitest";
import {
  type PedidoNecesidadImport,
  agruparPedidosPorNecesidad,
  clasificarTipoColumnaT,
  mapPedidoRowToNecesidad,
  resolveFuenteSiga,
} from "@/lib/pedido-compra-import";

// Fila real del pedido de compra 4786.XLS (SIGA · Municipalidad de Challhuahuacho).
const fila4786 = {
  grupo_bien: "74",
  clase_bien: "08",
  familia_bien: "9200",
  item_bien: "0001",
  centro_costo: "01051401",
  nombre_depend: "GERENCIA DE SERVICIOS MUNICIPALES Y GESTION AMBIENTAL",
  apellido_paterno: "JIMENEZ",
  apellido_materno: "ORIHUELA",
  nombres: "JUAN",
  fecha_pedido: "22/04/2026 11:44:55.283",
  cant_solicitada: "1",
  unidad_medida: "112",
  nombre_item: "SERVIDOR",
  nro_pedido: "001838",
  secuencia: "1",
  motivo_pedido: "ADQUISICION DE SERVIDOR",
  abreviatura: "UNIDAD",
  funcion: "03",
  programa: "006",
  sub_programa: "0010",
  act_proy: "2661009",
  componente: "6000008",
  moneda: "S/.",
  clasificador: "2.6. 3 2. 3 1",
  nombre_tarea: "186 MEJORAMIENTO Y AMPLIACION DE LOS SERVICIOS EN CHALLHUAHUACHO",
  fuente_fto: "18",
  fuente_financ_agregada: "5",
  sec_func: "186",
};

describe("mapPedidoRowToNecesidad (pedido de compra SIGA)", () => {
  const r = mapPedidoRowToNecesidad(fila4786);

  it("extrae nombre, objeto y área usuaria", () => {
    expect(r.nombre).toBe("ADQUISICION DE SERVIDOR");
    expect(r.tipoObjeto).toBe("bienes");
    expect(r.areaUsuaria).toBe("GERENCIA DE SERVICIOS MUNICIPALES Y GESTION AMBIENTAL");
  });

  it("compone el código de catálogo SIN guiones y la cadena funcional CON ellos", () => {
    // El código CUBSO se teclea y se busca junto (grupo+clase+familia+ítem); la
    // cadena funcional, en cambio, se lee y se cita por segmentos.
    expect(r.codigoCatalogo).toBe("740892000001");
    expect(r.cadenaFuncional).toBe("03-006-0010-2661009-6000008");
  });

  it("lleva motivo_pedido (col. S) a la descripción de catálogo", () => {
    // Es el texto con el que el área usuaria describe lo que pide. Antes se
    // tomaba de `nombre_item` (col. P), que ya alimenta el detalle y el código:
    // la ficha acababa repitiendo la misma frase en dos campos.
    expect(r.descripcionCatalogo).toBe("ADQUISICION DE SERVIDOR");
    expect(r.descripcionDetallada).toBe("SERVIDOR");
    expect(r.descripcionCatalogo).not.toBe(r.descripcionDetallada);
  });

  it("lleva fuente_fto (col. V) al rubro, y su nombre resuelto a la fuente", () => {
    expect(r.rubro).toBe("18");
    expect(r.fuenteFinanciamiento).toBeTruthy();
    expect(r.fuenteFinanciamiento).not.toBe("18");
  });

  it("lleva cant_solicitada (col. N) al monto estimado", () => {
    // En el export del SIGA no hay columna de precio: en los servicios esa cifra
    // son soles, no unidades.
    expect(r.montoEstimado).toBe(r.cantidad);
    expect(typeof r.montoEstimado).toBe("number");
  });

  it("extrae cantidad, unidad, centro de costo y responsable", () => {
    expect(r.cantidad).toBe(1);
    expect(r.unidadMedida).toBe("UNIDAD");
    expect(r.centroCosto).toBe("01051401");
    // Orden natural: nombres + apellido paterno + apellido materno.
    expect(r.responsable).toBe("JUAN JIMENEZ ORIHUELA");
    expect(r.descripcionDetallada).toBe("SERVIDOR");
  });

  it("parsea la fecha del pedido y deriva el año fiscal", () => {
    expect(r.fechaRequerida).toBe("2026-04-22");
    expect(r.anioFiscal).toBe(2026);
  });

  it("normaliza la moneda y guarda la referencia del pedido", () => {
    expect(r.moneda).toBe("PEN");
    expect(r.nroPedido).toBe("001838");
    expect(r.summary).toContain("001838");
    expect(r.proyectoInversion).toContain("MEJORAMIENTO");
  });

  it("el resumen dice «compra» para bienes y «servicio» para servicios", () => {
    expect(mapPedidoRowToNecesidad(fila4786, "bienes").summary).toBe("Pedido de compra SIGA N° 001838.");
    expect(mapPedidoRowToNecesidad(fila4786, "servicios").summary).toBe("Pedido de servicio SIGA N° 001838.");
  });

  it("resuelve fuente de financiamiento (rubro SIGA) y meta presupuestal", () => {
    expect(r.fuenteFinanciamiento).toBe("Canon y Sobrecanon, Regalías, Renta de Aduanas y Participaciones");
    expect(r.metaPresupuestal).toBe("186");
  });

  it("omite campos ausentes en vez de poner cadenas vacías", () => {
    const vacio = mapPedidoRowToNecesidad({ motivo_pedido: "COMPRA X" });
    expect(vacio.nombre).toBe("COMPRA X");
    expect(vacio.areaUsuaria).toBeUndefined();
    expect(vacio.cantidad).toBeUndefined();
    expect(vacio.fechaRequerida).toBeUndefined();
  });
});

describe("clasificarTipoColumnaT (columna T: UNIDAD/SERVICIO)", () => {
  it("UNIDAD (u otra unidad física) → bienes", () => {
    expect(clasificarTipoColumnaT("UNIDAD")).toBe("bienes");
    expect(clasificarTipoColumnaT("KG")).toBe("bienes");
  });

  it("SERVICIO / SERVICIOS → servicios", () => {
    expect(clasificarTipoColumnaT("SERVICIO")).toBe("servicios");
    expect(clasificarTipoColumnaT("servicios")).toBe("servicios");
    expect(clasificarTipoColumnaT("SERVICIO.")).toBe("servicios");
  });

  it("no confunde textos largos que contienen 'servicios' (palabra exacta)", () => {
    expect(clasificarTipoColumnaT("GERENCIA DE SERVICIOS MUNICIPALES")).toBe("bienes");
  });

  it("si la columna T viene vacía, cae a la abreviatura de unidad", () => {
    expect(clasificarTipoColumnaT("", "SERVICIO")).toBe("servicios");
    expect(clasificarTipoColumnaT("", "UNIDAD")).toBe("bienes");
  });
});

describe("mapPedidoRowToNecesidad respeta el tipo clasificado", () => {
  it("usa el tipo pasado (servicios) en vez del fallback bienes", () => {
    const r = mapPedidoRowToNecesidad({ motivo_pedido: "SERVICIO DE VIGILANCIA" }, "servicios");
    expect(r.tipoObjeto).toBe("servicios");
  });
});

describe("agruparPedidosPorNecesidad (un pedido → una necesidad)", () => {
  const item = (over: Partial<PedidoNecesidadImport>): PedidoNecesidadImport => ({
    nombre: "ADQUISICION DE EQUIPOS",
    tipoObjeto: "bienes",
    nroPedido: "001838",
    ...over,
  });

  it("fusiona varios ítems del mismo pedido en una sola necesidad", () => {
    const grupos = agruparPedidosPorNecesidad([
      item({ descripcionDetallada: "SERVIDOR", cantidad: 1, unidadMedida: "UNIDAD", secuencia: "1", areaUsuaria: "TI" }),
      item({ descripcionDetallada: "MONITOR", cantidad: 2, unidadMedida: "UNIDAD", secuencia: "2" }),
    ]);
    expect(grupos).toHaveLength(1);
    const g = grupos[0];
    expect(g.nroPedido).toBe("001838");
    expect(g.tipoObjeto).toBe("bienes");
    // El detalle enumera ambos ítems.
    expect(g.descripcionDetallada).toContain("1. SERVIDOR");
    expect(g.descripcionDetallada).toContain("2. MONITOR");
    // Sin secuencia: el POST vincula TODAS las filas del pedido a la necesidad.
    expect(g.secuencia).toBeUndefined();
    // Toma datos de cabecera del primer ítem con valor.
    expect(g.areaUsuaria).toBe("TI");
    expect(g.summary).toContain("2 ítems");
  });

  it("la cantidad y la unidad van al cuadro de ítems, NO a la cabecera", () => {
    // Totalizar en la cabecera era una ficción: sumar bolsas con varillas no da
    // nada. Cada prestación lleva la suya en el desagregado.
    const [g] = agruparPedidosPorNecesidad([
      item({ descripcionDetallada: "CEMENTO", cantidad: 500, unidadMedida: "BOLSA", secuencia: "1" }),
      item({ descripcionDetallada: "FIERRO", cantidad: 300, unidadMedida: "VARILLA", secuencia: "2" }),
    ]);
    expect(g.cantidad).toBeUndefined();
    expect(g.unidadMedida).toBeUndefined();
    expect(g.items).toHaveLength(2);
    expect(g.items?.[0]).toMatchObject({ cantidad: 500, nro: 1, unidadMedida: "BOLSA" });
    expect(g.items?.[1]).toMatchObject({ cantidad: 300, nro: 2, unidadMedida: "VARILLA" });
  });

  it("tampoco totaliza cuando la unidad es la misma", () => {
    // Antes este era justo el caso que sí se sumaba (1 unidad + 2 unidades = 3).
    const [g] = agruparPedidosPorNecesidad([
      item({ descripcionDetallada: "SERVIDOR", cantidad: 1, unidadMedida: "UNIDAD", secuencia: "1" }),
      item({ descripcionDetallada: "MONITOR", cantidad: 2, unidadMedida: "UNIDAD", secuencia: "2" }),
    ]);
    expect(g.cantidad).toBeUndefined();
    expect(g.unidadMedida).toBeUndefined();
  });

  it("un pedido de una sola línea también se desagrega", () => {
    const [g] = agruparPedidosPorNecesidad([
      item({ descripcionDetallada: "SERVIDOR", cantidad: 1, unidadMedida: "UNIDAD", secuencia: "1" }),
    ]);
    expect(g.items).toHaveLength(1);
    expect(g.items?.[0]).toMatchObject({ descripcion: "SERVIDOR", nro: 1 });
  });

  it("un ítem único no se altera (mantiene su secuencia)", () => {
    const grupos = agruparPedidosPorNecesidad([item({ secuencia: "1" })]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].secuencia).toBe("1");
  });

  it("separa bienes y servicios del mismo pedido, y pedidos distintos", () => {
    const grupos = agruparPedidosPorNecesidad([
      item({ nroPedido: "A", tipoObjeto: "bienes", descripcionDetallada: "X" }),
      item({ nroPedido: "A", tipoObjeto: "bienes", descripcionDetallada: "Y" }),
      item({ nroPedido: "A", tipoObjeto: "servicios", descripcionDetallada: "Z" }),
      item({ nroPedido: "B", tipoObjeto: "bienes", descripcionDetallada: "W" }),
    ]);
    // A-bienes, A-servicios, B-bienes → 3 necesidades.
    expect(grupos).toHaveLength(3);
    expect(grupos.filter((g) => g.nroPedido === "A")).toHaveLength(2);
  });
});

describe("resolveFuenteSiga (clasificador MEF)", () => {
  it("mapea rubros conocidos", () => {
    expect(resolveFuenteSiga("18", "5")).toBe("Canon y Sobrecanon, Regalías, Renta de Aduanas y Participaciones");
    expect(resolveFuenteSiga("07", "5")).toBe("Fondo de Compensación Municipal");
    expect(resolveFuenteSiga("8", "5")).toBe("Impuestos Municipales"); // normaliza "8" → "08"
  });

  it("cae a la fuente agregada si el rubro no está mapeado", () => {
    expect(resolveFuenteSiga("99", "1")).toBe("Recursos Ordinarios");
    expect(resolveFuenteSiga("", "2")).toBe("Recursos Directamente Recaudados");
  });

  it("devuelve undefined si nada mapea", () => {
    expect(resolveFuenteSiga("99", "9")).toBeUndefined();
    expect(resolveFuenteSiga("", "")).toBeUndefined();
  });
});

describe("qué columna del pedido alimenta cada campo", () => {
  // Fila real del 1301.XLS: un servicio con motivo y nombre de ítem distintos.
  const fila1301 = {
    abreviatura: "SERVICIO",
    cant_solicitada: "500000",
    clase_bien: "08",
    familia_bien: "9200",
    fuente_fto: "18",
    grupo_bien: "74",
    item_bien: "0001",
    motivo_pedido: "SERVICIO E INSTALACION DE ESTRUCTURAS METALICAS",
    nombre_item: "CONFECCION E INSTALACION DE ESTRUCTURAS",
    nro_pedido: "001301",
    secuencia: "1",
  };
  const r = mapPedidoRowToNecesidad(fila1301);

  it("col. S (motivo_pedido) → descripción de catálogo", () => {
    expect(r.descripcionCatalogo).toBe("SERVICIO E INSTALACION DE ESTRUCTURAS METALICAS");
  });

  it("col. P (nombre_item) → detalle, no descripción de catálogo", () => {
    expect(r.descripcionDetallada).toBe("CONFECCION E INSTALACION DE ESTRUCTURAS");
    expect(r.descripcionCatalogo).not.toBe(r.descripcionDetallada);
  });

  it("el código de catálogo va sin separadores y llega a cada ítem", () => {
    // Es el código que se teclea y se busca en el CUBSO, y ahora la tabla de
    // ítems lo muestra en su propia columna, delante de la descripción.
    expect(r.codigoCatalogo).toBe("74089200 0001".replace(" ", ""));
    const [necesidad] = agruparPedidosPorNecesidad([r]);
    expect(necesidad.items?.[0]?.codigoCatalogo).toBe(r.codigoCatalogo);
  });
});
