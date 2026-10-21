import { NextResponse } from "next/server";
import { z } from "zod";
import { cuantiaDeA5 } from "@/lib/anexo1-interaccion";
import { cronogramaRequerimientosDetalle } from "@/lib/actuaciones-preparatorias";
import { idsDeRutaInvalidos, requireCapability, requireUser } from "@/lib/auth";
import { columnasDesdeHito } from "@/lib/expediente-columnas";
import { faltaParaAprobar } from "@/lib/expediente-contenido";
import { type HitoEstado, type HitosMap, isHitoCode } from "@/lib/procurement-fases";
import { supabaseRest, supabaseUserRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProcessHitosRow = { id: string; hitos: HitosMap | null; valor_estimado: number | null };

const patchSchema = z.object({
  code: z.string().trim().min(1).max(8),
  status: z.enum(["pendiente", "en_curso", "hecho", "na"]).optional(),
  responsible: z.string().trim().max(160).optional().or(z.literal("")),
  documentId: z.string().uuid().optional().or(z.literal("")).or(z.null()),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  // Payload estructurado del formulario del paso (se fusiona, no se reemplaza).
  data: z.record(z.string(), z.unknown()).optional().or(z.null()),
});

// GET /api/processes/[id]/hitos → estado persistido de los hitos del expediente.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;
  try {
    const rows = await supabaseUserRest<ProcessHitosRow[]>(
      auth.user.accessToken,
      `procurement_processes?id=eq.${id}&select=id,hitos`,
    );
    if (!rows[0]) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ hitos: rows[0].hitos ?? {} });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar los hitos" },
      { status: 500 },
    );
  }
}

// PATCH /api/processes/[id]/hitos → actualiza un hito (merge en el jsonb).
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCapability("expediente.manage");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;
  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Solicitud invalida", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  if (!isHitoCode(data.code)) {
    return NextResponse.json({ error: `Hito desconocido: ${data.code}` }, { status: 400 });
  }

  try {
    const rows = await supabaseUserRest<ProcessHitosRow[]>(
      auth.user.accessToken,
      `procurement_processes?id=eq.${id}&select=id,hitos,valor_estimado`,
    );
    if (!rows[0]) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    const current: HitosMap = rows[0].hitos ?? {};
    const previous: HitoEstado = current[data.code] ?? { status: "pendiente" };
    const nowIso = new Date().toISOString();

    const next: HitoEstado = {
      ...previous,
      updatedAt: nowIso,
    };
    if (data.status !== undefined) {
      next.status = data.status;
      // doneAt se fija al completar y se limpia si deja de estar "hecho".
      next.doneAt = data.status === "hecho" ? previous.doneAt || nowIso : null;
    }
    if (data.responsible !== undefined) next.responsible = data.responsible || null;
    if (data.documentId !== undefined) next.documentId = data.documentId || null;
    if (data.notes !== undefined) next.notes = data.notes || null;
    if (data.data !== undefined) {
      // Fusiona el payload del formulario con lo ya guardado (no reemplaza todo).
      next.data = data.data ? { ...(previous.data ?? {}), ...data.data } : null;
    }

    const updated: HitosMap = { ...current, [data.code]: next };

    // Puerta de aprobación del expediente (Art. 54.2), reforzada en el servidor.
    // El formulario ya deshabilita el botón, pero eso es solo la vista: aquí se
    // impide de verdad marcar A8 como "hecho" mientras falte cualquier literal del
    // 54.2 (o el 54.3 del CMN). El pacBienesServicios (para la coherencia A2↔A5
    // del 125.2) sale de la ficha de la entidad; si no está, esa comprobación no
    // bloquea, pero los literales del contenido sí.
    if (data.code === "A8" && next.status === "hecho") {
      const inst = await supabaseRest<{ pac_monto_bienes_servicios: number | null }[]>(
        "entity_settings?id=eq.default&select=pac_monto_bienes_servicios&limit=1",
      ).catch(() => []);
      const falta = faltaParaAprobar(
        updated,
        rows[0].valor_estimado ?? null,
        inst[0]?.pac_monto_bienes_servicios ?? null,
      );
      if (falta.length > 0) {
        return NextResponse.json(
          {
            error:
              "No se puede aprobar el expediente: aún falta contenido que exige el Art. 54.2 del Reglamento.",
            falta: falta.map((f) => ({ literal: f.literal, etiqueta: f.etiqueta, paso: f.paso })),
          },
          { status: 409 },
        );
      }
    }

    // Construye el body del PATCH combinando todas las escrituras que tocan la
    // misma fila del expediente. Antes eran tres PATCH separados con
    // .catch(() => undefined) en los dos últimos: si el primero (hitos) tenia
    // exito pero el segundo (columnas de resumen) o el tercero (valor_estimado
    // de A5) fallaban, el expediente quedaba incongruente —el jsonb decia
    // "hecho" pero la ficha no se actualizaba, y para A5 el valor estimado se
    // perdia afectando el calculo de la linea de corte A2 (Art. 125) y el
    // Formato 1—.
    //
    // PostgREST traduce un PATCH a un solo UPDATE SQL atomico por fila, asi que
    // combinar las tres escrituras nos da transaccionalidad real sin RPC ni
    // migracion. Si el PATCH falla, el catch externo lo propaga como 500 y el
    // cliente puede reintentar.
    const patchBody: Record<string, unknown> = { hitos: updated };

    // Las columnas de resumen del expediente (la ficha del detalle) se alimentan
    // del paso que es DUEÑO de cada dato: A3 el requerimiento, A4 la estrategia,
    // A7 la certificacion, A8 la aprobacion. Nunca al reves, y nunca desde un
    // formulario propio: el paso es lo que se firma y se exporta.
    //
    // Se calcula sobre `next.data` —lo ya fusionado— y no sobre el payload: el
    // autoguardado manda campos sueltos, y con el parcial una columna que el
    // usuario no toco en ese guardado se quedaria sin actualizar.
    //
    // Solo se añaden las que TIENEN valor: un campo que el usuario aun no lleno
    // no debe borrar lo que ya hubiera en la columna. Vaciar un dato es una
    // decision, y se toma en el paso, no de rebote al autoguardar un formulario
    // a medias.
    const columnas = columnasDesdeHito(data.code, next.data ?? null);
    Object.assign(patchBody, columnas);

    // A5 es el DUEÑO de la cuantia: el Art. 47.1 pone "actualizar la cuantia de
    // la contratacion considerada en el PAC del CMN" entre los fines de la
    // interaccion con el mercado. Antes se calculaba solo para imprimirla en el
    // Anexo N° 1 y se tiraba, asi que `valor_estimado` quedaba en null y con el
    // se caia todo lo que depende de la cifra: la linea de corte de A2
    // (Art. 125.2) no se podia calcular —y la cuantia acababa respondida a
    // mano—, el Formato 1 salia sin cuantia y nadie comparaba la certificacion
    // de A7 contra el valor real.
    //
    // Se calcula sobre `next.data` (lo ya fusionado) y no sobre el payload: el
    // autoguardado manda campos sueltos, y con el parcial la cuantia saldria de
    // una tabla de proveedores incompleta.
    //
    // Sin cifra no se añade al body: borrar el valor estimado porque aun no hay
    // proveedores en la tabla seria perder un dato que ya estaba.
    if (data.code === "A5") {
      const cuantia = cuantiaDeA5(next.data);
      if (cuantia != null) {
        patchBody.valor_estimado = cuantia;
      }
    }

    await supabaseUserRest(auth.user.accessToken, `procurement_processes?id=eq.${id}`, {
      body: JSON.stringify(patchBody),
      method: "PATCH",
    });

    // Notification: when A2 (segmentación) is marked "hecho", log a notification event.
    // El cronograma de presentación de requerimientos (Art. 42.2) va en el
    // mensaje y en `details.cronograma`: la Guía (sección I) dice que la DEC
    // comunica a las áreas usuarias las fechas estimadas, así que la
    // notificación debe llevarlas, no solo anunciar que "está listo".
    if (data.code === "A2" && next.status === "hecho" && previous.status !== "hecho") {
      const cronograma = cronogramaRequerimientosDetalle(next.data?.cronogramaItems);
      await writeAuditLog({
        action: "fase1.cronograma_listo",
        actorReference: auth.user.email ?? auth.user.id,
        details: {
          message: cronograma.mensaje,
          cronograma: cronograma.filas,
          code: "A2",
        },
        entityId: id,
        entityType: "procurement_process",
      });
    }

    await writeAuditLog({
      action: "process.hito.update",
      actorReference: auth.user.email ?? auth.user.id,
      details: { code: data.code, status: next.status },
      entityId: id,
      entityType: "procurement_process",
    });

    return NextResponse.json({ hitos: updated, notificado: data.code === "A2" && next.status === "hecho" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar el hito" },
      { status: 500 },
    );
  }
}
