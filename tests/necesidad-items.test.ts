import { describe, expect, it } from "vitest";
import {
  agruparPorPaquete,
  cuantiaPorSumatoria,
  discrepanciaCuantia,
  evaluarAgrupamiento,
  importeItem,
  filasParaCuadro,
  itemsSinCodigoCatalogo,
  itemsSinPaquete,
  type NecesidadItem,
  objetoSugerido,
  normalizarDescripcionPaquete,
  paquetesDeUnSoloItem,
  renumerar,
} from "@/lib/necesidad-items";

const item = (p: Partial<NecesidadItem> & { nro: number }): NecesidadItem => ({
  descripcion: `Ítem ${p.nro}`,
  ...p,
});

const UIT = 5350; // umbral del contrato menor: 42,800

describe("importeItem", () => {
  it("el importe declarado manda sobre cantidad × unitario", () => {
    // El SIGA entrega importes ya redondeados; recalcular cambiaría una cifra
    // que el área usuaria no escribió.
    const i = item({ cantidad: 3, costoTotal: 100, costoUnitario: 33.33, nro: 1 });
    expect(importeItem(i)).toBe(100);
  });

  it("sin importe declarado lo calcula", () => {
    expect(importeItem(item({ cantidad: 3, costoUnitario: 33.33, nro: 1 }))).toBe(99.99);
  });

  it("sin datos suficientes no inventa un cero", () => {
    expect(importeItem(item({ nro: 1 }))).toBeNull();
    expect(importeItem(item({ cantidad: 3, nro: 1 }))).toBeNull();
  });
});

describe("cuantiaPorSumatoria (Art. 53.3)", () => {
  it("suma los ítems", () => {
    const suma = cuantiaPorSumatoria([
      item({ costoTotal: 50_000, nro: 1 }),
      item({ costoTotal: 43_000.55, nro: 2 }),
    ]);
    expect(suma).toBe(93_000.55);
  });

  it("sin ítems devuelve null, no 0", () => {
    // Un 0 se guardaría como si fuera un importe; lo que pasa es que aún no se
    // ha desagregado el requerimiento.
    expect(cuantiaPorSumatoria([])).toBeNull();
    expect(cuantiaPorSumatoria([item({ nro: 1 })])).toBeNull();
  });

  it("no arrastra error de coma flotante", () => {
    const suma = cuantiaPorSumatoria([
      item({ costoTotal: 0.1, nro: 1 }),
      item({ costoTotal: 0.2, nro: 2 }),
    ]);
    expect(suma).toBe(0.3);
  });
});

describe("discrepanciaCuantia", () => {
  it("avisa cuando el monto escrito no cuadra con la suma", () => {
    const d = discrepanciaCuantia([item({ costoTotal: 100, nro: 1 })], 150);
    expect(d).toEqual({ declarado: 150, diferencia: 50, sumatoria: 100 });
  });

  it("tolera un céntimo de redondeo", () => {
    expect(discrepanciaCuantia([item({ costoTotal: 100, nro: 1 })], 100.01)).toBeNull();
    expect(discrepanciaCuantia([item({ costoTotal: 100, nro: 1 })], 100.02)).not.toBeNull();
  });

  it("no se pronuncia si falta alguno de los dos", () => {
    expect(discrepanciaCuantia([], 150)).toBeNull();
    expect(discrepanciaCuantia([item({ costoTotal: 100, nro: 1 })], null)).toBeNull();
  });
});

describe("evaluarAgrupamiento (Art. 52.1.b)", () => {
  it("procede si todos superan el tope", () => {
    const v = evaluarAgrupamiento(
      [item({ costoTotal: 50_000, nro: 1 }), item({ costoTotal: 45_000, nro: 2 })],
      UIT,
    );
    expect(v.estado).toBe("procede");
  });

  it("nombra los ítems que están por debajo", () => {
    const v = evaluarAgrupamiento(
      [item({ costoTotal: 50_000, nro: 1 }), item({ costoTotal: 9_000, nro: 2 })],
      UIT,
    );
    expect(v).toMatchObject({ estado: "no_procede", nrosPorDebajo: [2] });
  });

  it("usa el importe calculado cuando no hay total declarado", () => {
    const v = evaluarAgrupamiento([item({ cantidad: 10, costoUnitario: 6_000, nro: 1 })], UIT);
    expect(v.estado).toBe("procede");
  });
});

describe("objetoSugerido (Art. 44.10)", () => {
  it("acumula POR OBJETO, no toma el ítem más caro suelto", () => {
    // Un solo ítem de obras de 60k frente a dos de bienes de 40k cada uno: el
    // objeto es bienes (80k), aunque el ítem más caro sea el de obras.
    const s = objetoSugerido(
      [
        item({ costoTotal: 60_000, nro: 1, tipoObjeto: "obras" }),
        item({ costoTotal: 40_000, nro: 2, tipoObjeto: "bienes" }),
        item({ costoTotal: 40_000, nro: 3, tipoObjeto: "bienes" }),
      ],
      null,
    );
    expect(s).toEqual({ hayVarios: true, monto: 80_000, objeto: "bienes" });
  });

  it("los ítems sin objeto propio heredan el de la necesidad", () => {
    const s = objetoSugerido([item({ costoTotal: 10, nro: 1 })], "servicios");
    expect(s).toEqual({ hayVarios: false, monto: 10, objeto: "servicios" });
  });

  it("marca cuándo hay un solo objeto: ahí el Art. 44.10 no decide nada", () => {
    const s = objetoSugerido(
      [
        item({ costoTotal: 10, nro: 1, tipoObjeto: "bienes" }),
        item({ costoTotal: 20, nro: 2, tipoObjeto: "bienes" }),
      ],
      null,
    );
    expect(s?.hayVarios).toBe(false);
  });

  it("sin objeto ni en el ítem ni en la necesidad, no sugiere", () => {
    expect(objetoSugerido([item({ costoTotal: 10, nro: 1 })], null)).toBeNull();
    expect(objetoSugerido([], "bienes")).toBeNull();
  });
});

describe("agruparPorPaquete (Art. 52.1.a)", () => {
  const lista = [
    item({ costoTotal: 100, nro: 1, nroPaquete: 2 }),
    item({ costoTotal: 200, nro: 2 }),
    item({ costoTotal: 300, nro: 3, nroPaquete: 1 }),
    item({ costoTotal: 400, nro: 4, nroPaquete: 2 }),
  ];

  it("agrupa por número de paquete y suma cada uno", () => {
    expect(agruparPorPaquete(lista)).toEqual([
      { descripcion: "", items: [lista[2]], monto: 300, nro: 1 },
      { descripcion: "", items: [lista[0], lista[3]], monto: 500, nro: 2 },
    ]);
  });

  it("lleva la descripción del paquete, tomada del primer ítem que la tenga", () => {
    const [p] = agruparPorPaquete([
      item({ nro: 1, nroPaquete: 1 }),
      item({ descripcionPaquete: "Equipamiento informático", nro: 2, nroPaquete: 1 }),
    ]);
    expect(p?.descripcion).toBe("Equipamiento informático");
  });

  it("los sueltos NO caen en un paquete 0", () => {
    // "Sin empaquetar" no es un paquete: un requerimiento puede tener parte
    // agrupada y parte suelta.
    expect(agruparPorPaquete(lista).some((p) => p.nro === 0)).toBe(false);
    expect(itemsSinPaquete(lista).map((i) => i.nro)).toEqual([2]);
  });

  it("señala los paquetes de un solo ítem", () => {
    // El Art. 52.1.a agrupa VARIOS: con uno solo no se agrupa nada.
    expect(paquetesDeUnSoloItem(lista)).toEqual([1]);
    expect(paquetesDeUnSoloItem([])).toEqual([]);
  });

  it("sin ningún paquete, no inventa grupos", () => {
    expect(agruparPorPaquete([item({ nro: 1 })])).toEqual([]);
  });
});

describe("normalizarDescripcionPaquete", () => {
  it("propaga la descripción a todos los ítems del paquete", () => {
    const r = normalizarDescripcionPaquete([
      item({ descripcionPaquete: "Equipamiento informático", nro: 1, nroPaquete: 1 }),
      item({ nro: 2, nroPaquete: 1 }),
      item({ nro: 3, nroPaquete: 2, descripcionPaquete: "Obra civil" }),
    ]);
    expect(r.map((i) => i.descripcionPaquete)).toEqual([
      "Equipamiento informático",
      "Equipamiento informático",
      "Obra civil",
    ]);
  });

  it("un ítem que sale del paquete no se lleva la descripción", () => {
    const r = normalizarDescripcionPaquete([
      item({ descripcionPaquete: "Equipamiento", nro: 1, nroPaquete: null }),
    ]);
    expect(r[0]?.descripcionPaquete).toBeNull();
  });

  it("gana la primera no vacía, no la primera a secas", () => {
    const r = normalizarDescripcionPaquete([
      item({ descripcionPaquete: "   ", nro: 1, nroPaquete: 1 }),
      item({ descripcionPaquete: "Obra civil", nro: 2, nroPaquete: 1 }),
    ]);
    expect(r.every((i) => i.descripcionPaquete === "Obra civil")).toBe(true);
  });
});

describe("filasParaCuadro", () => {
  const lista = [
    item({ nro: 1, nroPaquete: 2 }),
    item({ nro: 2 }),
    item({ nro: 3, nroPaquete: 1 }),
    item({ nro: 4, nroPaquete: 2 }),
  ];

  it("pone contiguos los ítems del paquete y los sueltos al final", () => {
    // Sin reordenar no se puede combinar: una celda no abarca filas salteadas.
    expect(filasParaCuadro(lista).map((f) => f.item.nro)).toEqual([3, 1, 4, 2]);
  });

  it("solo la primera fila del grupo dibuja la celda combinada", () => {
    const f = filasParaCuadro(lista);
    expect(f.map((x) => x.filasPaquete)).toEqual([1, 2, 0, 0]);
  });

  it("los sueltos no llevan paquete", () => {
    const suelto = filasParaCuadro(lista).find((f) => f.item.nro === 2);
    expect(suelto?.paquete).toBeNull();
    expect(suelto?.filasPaquete).toBe(0);
  });

  it("no pierde ni duplica ítems", () => {
    expect(filasParaCuadro(lista)).toHaveLength(lista.length);
  });
});

describe("renumerar", () => {
  it("rehace 1..n conservando el orden", () => {
    const r = renumerar([item({ nro: 7 }), item({ nro: 2 }), item({ nro: 5 })]);
    expect(r.map((i) => i.nro)).toEqual([1, 2, 3]);
  });

  it("no pierde el resto de los datos", () => {
    const r = renumerar([item({ costoTotal: 99, descripcion: "Cemento", nro: 4 })]);
    expect(r[0]).toMatchObject({ costoTotal: 99, descripcion: "Cemento", nro: 1 });
  });
});

describe("itemsSinCodigoCatalogo · la ficha técnica del Listado (Art. 95)", () => {
  const item = (nro: number, codigoCatalogo?: string): NecesidadItem => ({
    descripcion: `ítem ${nro}`,
    nro,
    ...(codigoCatalogo === undefined ? {} : { codigoCatalogo }),
  });
  const SIE = "Subasta Inversa Electrónica";

  it("señala los ítems sin código cuando se anticipa Subasta Inversa", () => {
    expect(itemsSinCodigoCatalogo([item(1, "410100070019"), item(2), item(3, "")], SIE)).toEqual([2, 3]);
  });

  it("no dice nada si todos lo llevan", () => {
    expect(itemsSinCodigoCatalogo([item(1, "410100070019")], SIE)).toEqual([]);
  });

  it("un código en blanco no cuenta como código", () => {
    expect(itemsSinCodigoCatalogo([item(1, "   ")], SIE)).toEqual([1]);
  });

  it("en cualquier otro procedimiento el código es opcional", () => {
    // Fuera de la Subasta Inversa es un dato de catálogo del SIGA, no un requisito.
    for (const proc of ["Licitación Pública para bienes", "Comparación de Precios", "", null, undefined]) {
      expect(itemsSinCodigoCatalogo([item(1), item(2)], proc)).toEqual([]);
    }
  });
});
