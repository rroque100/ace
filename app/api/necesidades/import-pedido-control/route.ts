import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCapability } from "@/lib/auth";
import { controlSupabaseRest } from "@/lib/control-supabase";
import {
  agruparPedidosControl,
  itemsDelPedido,
  mapPedidoControlToNecesidad,
  type SigaConsolidadoRow,
  type SigaPedidoControlRow,
  type SigaPedidoItemControlRow,
} from "@/lib/pedido-control-import";
import type { PedidoNecesidadImport } from "@/lib/pedido-compra-import";
import { supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ nroPedido: z.string().trim().min(1).max(20) });

const PEDIDO_SELECT = "ano_eje,area,centro_costo,concepto,cui,fecha,meta,nro_pedido,nro_pedido_siga,tipo_bien";
const ITEM_SELECT = "ano_eje,cantidad,codigo,descripcion,precio_ref,secuencia,tipo_bien,unidad";

// POST /api/necesidades/import-pedido-control → segunda forma de "Importar
// pedido": en vez de subir el .xlsx del SIGA, se escribe el N° de pedido y se
// busca en `siga_pedido`/`siga_pedido_item` del proyecto "control" (otra app
// del usuario, ver lib/control-supabase.ts). Misma forma de respuesta que
// /api/necesidades/import-pedido, para que el modal de "Nueva necesidad" la
// use sin distinguir de dónde vino el dato — incluida la revisión en lote
// cuando `items` trae más de uno: aquí pasa cuando el N° de pedido en
// realidad corresponde a VARIOS pedidos sin relación (ver la nota en
// lib/pedido-control-import.ts sobre nro_pedido no ser único por sí solo).
export async function POST(request: Request) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) return auth.error;

  const payload = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Escribe un N° de pedido." }, { status: 400 });
  }
  const nroPedido = payload.data.nroPedido;

  try {
    const [pedidosRaw, todasLasLineas] = await Promise.all([
      controlSupabaseRest<SigaPedidoControlRow[]>(
        `siga_pedido?nro_pedido=eq.${encodeURIComponent(nroPedido)}&select=${PEDIDO_SELECT}`,
      ),
      controlSupabaseRest<SigaPedidoItemControlRow[]>(
        `siga_pedido_item?nro_pedido=eq.${encodeURIComponent(nroPedido)}&select=${ITEM_SELECT}&order=secuencia.asc`,
      ),
    ]);

    if (pedidosRaw.length === 0) {
      return NextResponse.json({ error: `No se encontró el pedido N° ${nroPedido}.` }, { status: 404 });
    }
    // Casi siempre 1 solo grupo; más de uno cuando el N° de pedido coincide
    // entre pedidos sin relación (distinto tipo_bien/año) — se tratan como
    // pedidos separados, no se fusionan.
    const grupos = agruparPedidosControl(pedidosRaw);
    const multiplesGrupos = grupos.length > 1;

    const items: PedidoNecesidadImport[] = [];
    // Solo se persiste si hay ítems reales: evita filas vacías en pedidos_siga
    // para un pedido encontrado pero sin líneas.
    const filasParaPersistir: Array<{ anio_fiscal: number | null; crudo: unknown; secuencia: string }> = [];

    for (const pedido of grupos) {
      const lineasDelGrupo = itemsDelPedido(todasLasLineas, pedido);
      if (lineasDelGrupo.length === 0) continue;

      // El proyecto (Invierte.pe) no vive en siga_pedido: se busca aparte en
      // siga_consolidado, acotado también por tipo_bien para no traer el
      // consolidado de OTRO pedido que casualmente comparta número.
      const consolidados = await controlSupabaseRest<SigaConsolidadoRow[]>(
        `siga_consolidado?pedidos_match=cs.%7B${encodeURIComponent(nroPedido)}%7D&tipo_bien=eq.${encodeURIComponent(pedido.tipo_bien ?? "")}&select=espec_tecnicas&limit=1`,
      ).catch(() => [] as SigaConsolidadoRow[]);

      const item = mapPedidoControlToNecesidad(pedido, lineasDelGrupo, consolidados[0] ?? null);
      items.push(item);

      // Con un solo grupo, la secuencia queda igual que antes (compatible con
      // lo ya archivado); con varios, se prefija por tipo_bien para que dos
      // pedidos distintos con el mismo nro_pedido/año no choquen en la clave
      // (nro_pedido, secuencia, anio_fiscal) de pedidos_siga y se sobrescriban.
      const prefijo = multiplesGrupos ? `${(pedido.tipo_bien ?? "X").toUpperCase()}-` : "";
      lineasDelGrupo.forEach((linea, i) => {
        filasParaPersistir.push({
          anio_fiscal: item.anioFiscal ?? null,
          crudo: { item: linea, pedido },
          secuencia: `${prefijo}${linea.secuencia ?? i + 1}`,
        });
      });
    }

    if (items.length === 0) {
      return NextResponse.json({ error: `El pedido N° ${nroPedido} no tiene ítems.` }, { status: 422 });
    }

    // Persistencia en pedidos_siga (propia de ACE), igual que el import por
    // archivo: mismo upsert idempotente, para que el origen del dato quede
    // trazado sin importar por qué camino entró.
    let pedidoGuardado = false;
    if (filasParaPersistir.length > 0) {
      try {
        await supabaseUserRest(auth.user.accessToken, "pedidos_siga?on_conflict=nro_pedido,secuencia,anio_fiscal", {
          body: JSON.stringify(
            filasParaPersistir.map((f) => ({ ...f, nro_pedido: nroPedido, owner_id: auth.user.id })),
          ),
          headers: { Prefer: "resolution=merge-duplicates" },
          method: "POST",
        });
        pedidoGuardado = true;
      } catch {
        pedidoGuardado = false;
      }
    }

    // `count` es el total de ítems reales (informativo, para el aviso de la
    // UI); puede diferir de `todasLasLineas.length` si hubo líneas huérfanas
    // (tipo_bien/año que no calzó con ningún pedido de la cabecera).
    const count = items.reduce((sum, it) => sum + (it.items?.length ?? 0), 0);

    return NextResponse.json({ count, items, pedidoGuardado });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo consultar el pedido." },
      { status: 500 },
    );
  }
}
