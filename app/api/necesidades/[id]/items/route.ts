import { NextResponse } from "next/server";
import { requireCapability, requireUser } from "@/lib/auth";
import { normalizarDescripcionPaquete } from "@/lib/necesidad-items";
import { necesidadItemsSchema, type NecesidadItemRow } from "@/lib/necesidades";
import { esIdSeguro, supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SELECT =
  "id,necesidad_id,nro,descripcion,codigo_catalogo,unidad_medida,cantidad,costo_unitario,costo_total,tipo_objeto,nro_paquete,descripcion_paquete";

// Desagregado del requerimiento (sección 3.2 de las Bases). Es la lista sobre la
// que después se decide el agrupamiento en la estrategia (Art. 52), pero el modo
// —paquete o relación de ítems— NO se guarda aquí: lo sustenta la DEC en A4
// (Art. 52.2), y mezclarlo confundiría quién decide qué.
//
// `necesidad_items` tiene RLS escopada por la necesidad padre, así que se accede
// con el JWT del usuario: el enforcement es RLS, respaldado por el gate de
// capacidad `necesidad.manage` para escribir.

/** Número o `null`; PostgREST devuelve los `numeric` como texto. */
function aNumero(valor: number | string | null): number | null {
  if (valor === null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function aItem(row: NecesidadItemRow) {
  return {
    cantidad: aNumero(row.cantidad),
    codigoCatalogo: row.codigo_catalogo,
    costoTotal: aNumero(row.costo_total),
    costoUnitario: aNumero(row.costo_unitario),
    descripcion: row.descripcion,
    id: row.id,
    nro: row.nro,
    descripcionPaquete: row.descripcion_paquete,
    nroPaquete: row.nro_paquete,
    tipoObjeto: row.tipo_objeto,
    unidadMedida: row.unidad_medida,
  };
}

// GET /api/necesidades/[id]/items
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  if (!esIdSeguro(id)) {
    return NextResponse.json({ error: "Id inválido", items: [] }, { status: 400 });
  }

  try {
    const rows = await supabaseUserRest<NecesidadItemRow[]>(
      auth.user.accessToken,
      `necesidad_items?necesidad_id=eq.${id}&select=${SELECT}&order=nro.asc`,
    );
    return NextResponse.json({ items: rows.map(aItem) });
  } catch (error) {
    console.error("[necesidades/items] no se pudieron cargar:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudieron cargar los ítems",
        items: [],
      },
      { status: 500 },
    );
  }
}

// PUT /api/necesidades/[id]/items — reemplaza la lista completa.
//
// Reemplazo y no CRUD por fila: la sección 3.2 se edita como un cuadro y se
// guarda de una vez. Además el `nro` se renumera 1..n en el servidor, y con
// altas y bajas sueltas dos filas podrían pedir el mismo número.
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("necesidad.manage");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  if (!esIdSeguro(id)) {
    return NextResponse.json({ error: "Id inválido" }, { status: 400 });
  }

  const parsed = necesidadItemsSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    // Se nombra el ÍTEM y el CAMPO que falla en vez de un «Solicitud inválida»
    // seco: con un cuadro de varias filas, saber que es «Ítem 3 · descripción»
    // es la diferencia entre corregirlo en 5 s y mirar todo el cuadro a ciegas.
    // El path de Zod es ["items", índice, campo].
    const issue = parsed.error.issues[0];
    const idx = typeof issue?.path?.[1] === "number" ? issue.path[1] + 1 : null;
    const campo = issue?.path?.[2] ? String(issue.path[2]) : null;
    const ubic = idx ? `Ítem ${idx}${campo ? ` · ${campo}` : ""}: ` : "";
    return NextResponse.json(
      {
        details: parsed.error.flatten(),
        error: `Hay un ítem inválido en el cuadro (3.2). ${ubic}${
          issue?.message ?? "revisa cantidades/costos (no negativos) y que la descripción tenga al menos 2 caracteres"
        }`,
      },
      { status: 400 },
    );
  }

  try {
    const [necesidad] = await supabaseUserRest<Array<{ id: string }>>(
      auth.user.accessToken,
      `necesidades?id=eq.${id}&select=id`,
    );
    if (!necesidad) {
      return NextResponse.json({ error: "Necesidad no encontrada" }, { status: 404 });
    }

    // La descripción del paquete se guarda en cada ítem, así que se iguala aquí
    // antes de escribir: es lo que impide que dos filas del mismo paquete acaben
    // diciendo cosas distintas si se editó solo una.
    const normalizados = normalizarDescripcionPaquete(
      parsed.data.items.map((item) => ({
        ...item,
        descripcion: item.descripcion,
        nro: item.nro ?? 0,
      })),
    );

    const filas = normalizados.map((item, i) => ({
      cantidad: item.cantidad ?? null,
      codigo_catalogo: item.codigoCatalogo ?? null,
      costo_total: item.costoTotal ?? null,
      costo_unitario: item.costoUnitario ?? null,
      descripcion: item.descripcion,
      descripcion_paquete: item.descripcionPaquete ?? null,
      // El paquete lo elige el usuario y NO se renumera: agrupar los ítems 1 y 4
      // en el paquete 2 es una decisión, no un orden.
      nro: i + 1,
      nro_paquete: item.nroPaquete ?? null,
      tipo_objeto: item.tipoObjeto ?? null,
      unidad_medida: item.unidadMedida ?? null,
    }));

    // Borrar y reinsertar (no conciliar) porque el `nro` es único por necesidad:
    // renumerar sobre las filas vivas chocaría con el índice a mitad de camino
    // (el ítem 2 no puede pasar a 1 mientras el 1 exista). La función SQL hace
    // ambos pasos en una sola transacción — si el INSERT falla, el DELETE se
    // revierte con él, así el cuadro nunca queda vacío por un fallo a mitad de
    // camino. Si el SQL aún no se aplicó (función ausente), se cae al
    // DELETE+INSERT de siempre: mismo riesgo que antes, no uno nuevo.
    let rows: NecesidadItemRow[];
    try {
      rows = await supabaseUserRest<NecesidadItemRow[]>(
        auth.user.accessToken,
        "rpc/necesidad_items_replace",
        { body: JSON.stringify({ p_necesidad_id: id, p_items: filas }), method: "POST" },
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      const funcionAusente = /necesidad_items_replace|PGRST202|Could not find the function/i.test(msg);
      if (!funcionAusente) throw error;
      await supabaseUserRest(
        auth.user.accessToken,
        `necesidad_items?necesidad_id=eq.${id}`,
        { method: "DELETE" },
      );
      if (filas.length > 0) {
        await supabaseUserRest(auth.user.accessToken, "necesidad_items", {
          body: JSON.stringify(filas.map((f) => ({ ...f, necesidad_id: id }))),
          method: "POST",
        });
      }
      rows = await supabaseUserRest<NecesidadItemRow[]>(
        auth.user.accessToken,
        `necesidad_items?necesidad_id=eq.${id}&select=${SELECT}&order=nro.asc`,
      );
    }

    await writeAuditLog({
      action: "necesidad.items.replace",
      actorReference: auth.user.email ?? auth.user.id,
      details: { total: filas.length },
      entityId: id,
      entityType: "necesidad",
      module: "necesidades",
    });

    return NextResponse.json({ items: rows.map(aItem) });
  } catch (error) {
    console.error("[necesidades/items] no se pudieron guardar:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron guardar los ítems" },
      { status: 500 },
    );
  }
}
