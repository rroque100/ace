import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { necesidadCreateSchema } from "@/lib/necesidades";

/**
 * El recorrido pedido SIGA → pedidos_siga → necesidad tiene tres eslabones que
 * pueden romperse EN SILENCIO (el patrón de toda la sesión): el import que no
 * persiste, el schema que tira la referencia y el POST que no vincula.
 */
describe("persistencia del pedido SIGA", () => {
  it("el import escribe el pedido íntegro en pedidos_siga", () => {
    const src = readFileSync("app/api/necesidades/import-pedido/route.ts", "utf8");
    expect(src).toContain("pedidos_siga?on_conflict=nro_pedido,secuencia,anio_fiscal");
    // Y el fallo NO es silencioso: la respuesta lo declara.
    expect(src).toContain("pedidoGuardado");
    // El crudo no pasea por el navegador: se persiste en el servidor.
    expect(src).toContain("itemsSinCrudo");
  });

  it("el schema acepta la referencia del pedido sin exigirla", () => {
    // Son transitorios: viajan en el POST para vincular, no son columnas.
    const conRef = necesidadCreateSchema.safeParse({
      nombre: "ADQUISICIÓN DE SERVIDOR",
      nroPedido: "001838",
      pedidoSecuencia: "1",
      tipoArea: "area_usuaria",
      tipoObjeto: "bienes",
    });
    expect(conRef.success).toBe(true);
    const sinRef = necesidadCreateSchema.safeParse({
      nombre: "ADQUISICIÓN DE SERVIDOR",
      tipoArea: "area_usuaria",
      tipoObjeto: "bienes",
    });
    expect(sinRef.success).toBe(true);
  });

  it("el POST de necesidades vincula la fila del pedido", () => {
    const src = readFileSync("app/api/necesidades/route.ts", "utf8");
    // Solo la fila AÚN sin vincular: no se le roba el vínculo a otra necesidad.
    expect(src).toContain("necesidad_id=is.null");
    expect(src).toContain("data.nroPedido");
  });

  it("el cliente envía la referencia en las dos vías de alta", () => {
    const src = readFileSync("app/components/necesidad-list.tsx", "utf8");
    const envios = src.match(/pedidoSecuencia: secuencia/g) ?? [];
    expect(envios.length, "createBatch y createNecesidad deben enviarla").toBe(2);
  });
});
