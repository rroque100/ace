import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/auth";
import { agruparPedidosPorNecesidad, parsePedidoCompra } from "@/lib/pedido-compra-import";
import { supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/necesidades/import-pedido → recibe un Pedido de Compra del SIGA
// (.xls/.xlsx) y devuelve los datos mapeados a Necesidad (una por ítem) para
// prellenar el formulario de registro. No persiste nada: el usuario revisa y guarda.
export async function POST(request: Request) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) return auth.error;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Adjunta el archivo del pedido de compra." }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo supera los 5 MB." }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // `filas` = una por ítem (línea del SIGA); se persisten íntegras en
    // pedidos_siga. `grupos` = una por pedido (nro_pedido + tipo): un pedido con
    // varios ítems es UNA sola necesidad (→ un solo expediente).
    let filas;
    try {
      filas = parsePedidoCompra(buffer);
    } catch {
      return NextResponse.json(
        { error: "No se pudo leer el archivo. Verifica que sea un pedido de compra del SIGA (.xls/.xlsx)." },
        { status: 422 },
      );
    }
    const items = agruparPedidosPorNecesidad(filas);

    if (filas.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron ítems en el pedido. ¿Es el formato correcto del SIGA?" },
        { status: 422 },
      );
    }

    // Persistir el pedido ÍNTEGRO (las 47 columnas del export) en pedidos_siga.
    //
    // El mapeo de arriba usa ~19 columnas; las demás no se tiran: actuaciones
    // preparatorias irá tomando las que necesite sin reimportar el archivo, y
    // la fila cruda es la prueba del origen de los datos de la ficha. El upsert
    // por (nro_pedido, secuencia, anio_fiscal) hace la importación idempotente:
    // re-subir el mismo archivo no duplica.
    let pedidoGuardado = false;
    // Se persiste por ÍTEM (todas las secuencias), no por grupo: así pedidos_siga
    // conserva las 47 columnas de cada línea del pedido.
    const filasPedido = filas
      .filter((item) => item.nroPedido)
      .map((item) => ({
        anio_fiscal: item.anioFiscal ? Number(item.anioFiscal) : null,
        crudo: item.crudo ?? {},
        nro_pedido: item.nroPedido,
        owner_id: auth.user.id,
        secuencia: item.secuencia ?? "1",
      }));
    if (filasPedido.length > 0) {
      try {
        await supabaseUserRest(auth.user.accessToken, "pedidos_siga?on_conflict=nro_pedido,secuencia,anio_fiscal", {
          body: JSON.stringify(filasPedido),
          headers: { Prefer: "resolution=merge-duplicates" },
          method: "POST",
        });
        pedidoGuardado = true;
      } catch {
        // El import sigue siendo útil sin la persistencia, pero el fallo NO es
        // silencioso: se reporta en la respuesta y la UI lo enseña.
        pedidoGuardado = false;
      }
    }

    // Sin el `crudo` en la respuesta: ya está persistido en el servidor y no
    // tiene sentido pasear 47 columnas por el formulario del navegador. Se
    // devuelven los GRUPOS (una necesidad por pedido); `count` es el nº de ítems.
    const itemsSinCrudo = items.map(({ crudo: _crudo, ...rest }) => rest);
    return NextResponse.json({
      count: filas.length,
      grupos: items.length,
      items: itemsSinCrudo,
      pedidoGuardado,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo importar el pedido de compra." },
      { status: 500 },
    );
  }
}
