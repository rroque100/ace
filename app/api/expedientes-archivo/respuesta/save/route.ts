import { NextResponse } from "next/server";
import { requireDecOrAreaUsuaria } from "@/lib/auth";
import { isTipoDocumento } from "@/lib/document-number";
import { entitiesMatch } from "@/lib/entity-utils";
import { supabaseRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function text(value: unknown, max = 4000): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

// POST /api/expedientes-archivo/respuesta/save
// Guarda/archiva una respuesta generada. Si assignNumber, asigna el correlativo
// de la oficina de forma atomica (funcion SQL rpc/expedientes_next_doc_number).
export async function POST(request: Request) {
  const auth = await requireDecOrAreaUsuaria();
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    if (!text(body.cuerpo)) {
      return NextResponse.json(
        { error: "Falta el cuerpo de la respuesta" },
        { status: 400 },
      );
    }

    const tipoDocumento = isTipoDocumento(body.tipoDocumento) ? body.tipoDocumento : null;
    const oficinaId = typeof body.oficinaId === "string" && body.oficinaId ? body.oficinaId : null;

    // Non-admin: la oficina es obligatoria para garantizar el scope.
    // Sin oficinaId no se puede validar el scope → rechazar.
    if (!auth.user.isAdmin && !oficinaId) {
      return NextResponse.json(
        { error: "Debes seleccionar una oficina para guardar la respuesta." },
        { status: 400 },
      );
    }
    // Non-admin: solo puede emitir con SU oficina (por oficina_id del perfil o
    // por match de nombre/entidad con su entity).
    if (!auth.user.isAdmin && oficinaId) {
      type OfiRow = { id: string; nombre: string | null; entidad: string | null };
      const [oficina] = await supabaseRest<OfiRow[]>(
        `expedientes_oficinas?id=eq.${encodeURIComponent(oficinaId)}&select=id,nombre,entidad&limit=1`,
      ).catch(() => [] as OfiRow[]);
      const allowed =
        oficina &&
        (oficina.id === auth.user.oficinaId ||
          entitiesMatch(oficina.nombre, auth.user.entity) ||
          entitiesMatch(oficina.entidad, auth.user.entity));
      if (!allowed) {
        return NextResponse.json(
          { error: "No tienes acceso a esta oficina" },
          { status: 403 },
        );
      }
    }

    const anioRaw = body.anio;
    const anio = Number.isFinite(Number(anioRaw)) ? Number(anioRaw) : new Date().getFullYear();

    let nroOficio = text(body.nroOficio, 120);
    // Aviso al cliente cuando se pidió número y no se pudo dar: un documento sin
    // numerar no se puede emitir, así que el silencio aquí es peor que el fallo.
    let numeracionError: string | null = null;
    if (body.assignNumber && oficinaId && tipoDocumento) {
      // El correlativo pertenece al ejercicio del DOCUMENTO, no al del reloj del
      // servidor: un oficio con fecha del año pasado toma la serie de ese año.
      const assigned = await supabaseRest<string | null>("rpc/expedientes_next_doc_number", {
        body: JSON.stringify({ p_oficina: oficinaId, p_tipo: tipoDocumento, p_year: anio }),
        method: "POST",
      }).catch((err: unknown) => {
        // Este `catch` mantuvo oculto durante semanas que la función fallaba con
        // 42P10 y que ningún documento llegaba a numerarse.
        numeracionError = err instanceof Error ? err.message : "No se pudo asignar el correlativo";
        console.error("[respuesta/save] fallo al asignar correlativo:", err);
        return null;
      });
      if (typeof assigned === "string" && assigned.trim()) {
        nroOficio = assigned.trim();
      } else if (!numeracionError) {
        numeracionError = "La numeración no devolvió ningún correlativo";
      }
    }

    const payload: Record<string, unknown> = {
      anio,
      antecedente_id: text(body.antecedenteId, 60),
      antecedentes: Array.isArray(body.antecedentes) ? body.antecedentes : [],
      asunto: text(body.asunto, 500),
      base_legal: Array.isArray(body.baseLegal) ? body.baseLegal : [],
      cuerpo: text(body.cuerpo, 20000),
      cargo_destinatario: text(body.cargoDestinatario, 200),
      destinatario: text(body.destinatario, 300),
      documento_texto: text(body.documentoTexto, 20000),
      entity: body.entity && typeof body.entity === "object" ? body.entity : {},
      expediente_id:
        typeof body.expedienteId === "string" && body.expedienteId ? body.expedienteId : null,
      length: text(body.length, 20),
      nro_oficio: nroOficio,
      oficina_id: oficinaId,
      remitente: text(body.remitente, 300),
      tipo_documento: tipoDocumento,
      token_usage: body.tokenUsage && typeof body.tokenUsage === "object" ? body.tokenUsage : null,
      tone: text(body.tone, 20),
      created_by: auth.user.id,
    };

    // Si antecedente_id aun no existe en la BD (SQL respuesta-archivo-tables.sql
    // pendiente), reintenta sin esa columna para no bloquear el guardado.
    const [saved] = await supabaseRest<Array<{ id: string }>>(
      "expedientes_respuestas?select=id",
      { body: JSON.stringify(payload), method: "POST" },
    ).catch((err) => {
      if (err instanceof Error && /antecedente_id/i.test(err.message)) {
        const { antecedente_id: _omit, ...rest } = payload;
        return supabaseRest<Array<{ id: string }>>(
          "expedientes_respuestas?select=id",
          { body: JSON.stringify(rest), method: "POST" },
        );
      }
      throw err;
    });

    await writeAuditLog({
      action: "respuesta.save",
      actorReference: auth.user.email ?? auth.user.id,
      details: { nroOficio: payload.nro_oficio, asunto: payload.asunto },
      entityId: saved?.id,
      entityType: "respuesta",
      module: "expedientes-archivo",
    });

    // La respuesta se guarda igual aunque la numeración falle —perder el
    // borrador sería peor—, pero el cliente se entera para poder avisar.
    return NextResponse.json(
      { id: saved?.id ?? null, nroOficio, numeracionError },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la respuesta" },
      { status: 500 },
    );
  }
}
