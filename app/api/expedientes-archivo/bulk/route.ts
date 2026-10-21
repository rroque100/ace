import { NextResponse } from "next/server";
import { canAccessArchivoRow, getArchivoScopeLevel, requireDecOrAreaUsuaria } from "@/lib/auth";
import {
  ARCHIVO_COLORES,
  normalizeCatalogValue,
  normalizeContenedorTipo,
} from "@/lib/expedientes-archivo";
import { getSupabaseServerConfig, supabaseRest, writeAuditLog } from "@/lib/supabase-server";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type BulkBody = {
  ids: string[];
  action: "update" | "markForDisposal";
  updates?: Record<string, unknown>;
};

function asString(body: Record<string, unknown>, key: string, max = 500): string | null {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

export async function POST(request: Request) {
  try {
    const auth = await requireDecOrAreaUsuaria();
    if ("error" in auth) {
      return auth.error;
    }

    const rl = checkRateLimit(
      getRateLimitKey(request, auth.user.id, "bulk"),
      RATE_LIMITS.bulk,
    );
    if (!rl.allowed) {
      return rateLimitResponse(rl);
    }

    getSupabaseServerConfig();

    const body = (await request.json()) as BulkBody;
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: "Falta lista de IDs" }, { status: 400 });
    }
    if (body.ids.length > 200) {
      return NextResponse.json({ error: "Máximo 200 expedientes por operación" }, { status: 400 });
    }
    if (body.action !== "update" && body.action !== "markForDisposal") {
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
    }

    let updates: Record<string, unknown> = {};

    if (body.action === "markForDisposal") {
      updates = {
        status: "error",
        error_message: "Marcado para baja por el usuario",
        metadata: { pendingDisposal: true, markedAt: new Date().toISOString() },
      };
    } else {
      const src = body.updates ?? {};
      const textFields: Record<string, string> = {
        oficina: "oficina",
        nroEstante: "nro_estante",
        nroPiso: "nro_piso",
        nroLocal: "nro_local",
        nroArchivador: "nro_archivador",
        nroPaquete: "nro_paquete",
        colorArchivador: "color_archivador",
        tipoAlmacenamiento: "tipo_almacenamiento",
        observaciones: "observaciones",
      };
      for (const [formKey, dbKey] of Object.entries(textFields)) {
        const v = asString(src, formKey);
        if (v !== null) updates[dbKey] = v;
      }
      const tipoAlm = normalizeContenedorTipo(src.tipoAlmacenamiento);
      if (tipoAlm) updates.tipo_almacenamiento = tipoAlm;
      const color = normalizeCatalogValue(src.colorArchivador, ARCHIVO_COLORES);
      if (color) updates.color_archivador = color;
      if (typeof src.empastado === "boolean") updates.empastado = src.empastado;
      else if (src.empastado === "si" || src.empastado === "true") updates.empastado = true;
      else if (src.empastado === "no" || src.empastado === "false") updates.empastado = false;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    const inList = body.ids.map((id) => `"${id}"`).join(",");

    if (getArchivoScopeLevel(auth.user) !== "all") {
      const targets = await supabaseRest<Array<{ id: string; oficina: string | null; oficina_id: string | null; uploaded_by: string | null }>>(
        `expedientes_archivo?id=in.(${inList})&select=id,oficina,oficina_id,uploaded_by`,
      );
      const unauthorized = targets.filter(
        (t) => !canAccessArchivoRow(auth.user, { oficina: t.oficina, oficinaId: t.oficina_id, owner: t.uploaded_by }),
      );
      if (unauthorized.length > 0 || targets.length !== body.ids.length) {
        return NextResponse.json(
          { error: "No tienes acceso a todos los expedientes seleccionados" },
          { status: 403 },
        );
      }
    }

    if (!auth.user.isAdmin && "oficina" in updates) {
      delete updates.oficina;
    }

    await supabaseRest(`expedientes_archivo?id=in.(${inList})`, {
      body: JSON.stringify(updates),
      method: "PATCH",
    });

    await writeAuditLog({
      action: body.action === "markForDisposal" ? "expedientes.bulkDisposal" : "expedientes.bulkUpdate",
      actorReference: auth.user.email ?? auth.user.id,
      details: { count: body.ids.length, fields: Object.keys(updates) },
      entityType: "expediente_archivo",
      module: "expedientes-archivo",
    });

    return NextResponse.json({ updated: body.ids.length, fields: Object.keys(updates) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo aplicar la operación masiva" },
      { status: 500 },
    );
  }
}
