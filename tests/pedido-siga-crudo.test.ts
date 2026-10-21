import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePedidoCompra } from "@/lib/pedido-compra-import";

/** El pedido real del expediente: SIGA N° 001838 (ADQUISICIÓN DE SERVIDOR). */
const buf = readFileSync("./actuaciones-preparatorias/4786.XLS");

describe("pedido de compra del SIGA", () => {
  it("lee el .XLS antiguo del SIGA (BIFF2)", () => {
    // Es un Excel 2 BIFF2: exceljs no lo abre, xlsx sí.
    const items = parsePedidoCompra(buf);
    expect(items).toHaveLength(1);
    expect(items[0].nroPedido).toBe("001838");
  });

  it("conserva las 47 columnas del export, no solo las que mapea", () => {
    // El mapeo usa 19. Las otras 28 no se tiran: el módulo de actuaciones
    // preparatorias irá tomando las que necesite, y sin esto habría que
    // reimportar el archivo cada vez.
    const [item] = parsePedidoCompra(buf);
    expect(Object.keys(item.crudo ?? {})).toHaveLength(47);
    // Dos que hoy nadie usa, para que conste que se guardan igual. El crudo
    // conserva el TIPO que da el SIGA: `sec_ejec` viene numérico y
    // `codigo_tarea` como texto. No se normaliza a propósito — es el original.
    expect(item.crudo?.sec_ejec).toBe(300308);
    expect(item.crudo?.codigo_tarea).toBe(391);
  });

  it("identifica la línea: un pedido puede traer varios ítems", () => {
    const [item] = parsePedidoCompra(buf);
    expect(item.nroPedido).toBe("001838");
    expect(item.secuencia).toBe("1");
  });

  it("mapea lo que la ficha necesita", () => {
    const [item] = parsePedidoCompra(buf);
    expect(item.nombre).toBe("ADQUISICION DE SERVIDOR");
    expect(item.tipoObjeto).toBe("bienes");
    expect(item.centroCosto).toBe("01051401");
    // El CUI del formato firmado sale de aquí, dentro de la cadena funcional.
    expect(item.cadenaFuncional).toContain("2661009");
    // Y la fuente que obligó a tratar el canon como recursos determinados.
    expect(item.fuenteFinanciamiento).toContain("Canon");
  });
});
