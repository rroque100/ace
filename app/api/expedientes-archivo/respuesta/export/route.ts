import { NextResponse } from "next/server";
import { getOfficeFilter, requireUser } from "@/lib/auth";
import { entitiesMatch } from "@/lib/entity-utils";
import { buildRespuestaDocx } from "@/lib/respuesta-generator";
import { buildRespuestaPdf } from "@/lib/respuesta-pdf";
import { downloadStorageObject, supabaseRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function slugify(asunto: string): string {
  return (
    asunto
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "respuesta"
  );
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const {
      format = "docx",
      tipoDocumento = "",
      oficinaId,
      entity,
      nroOficio,
      destinatario,
      cargoDestinatario,
      lugar,
      referencia,
      asunto,
      cuerpo,
      // baseLegal se ignora intencionalmente: la base legal NO se incluye
      // en el documento descargado. Solo se uso como contexto para que
      // la IA redactara el cuerpo. El usuario la ve en la UI (BorradorEditor).
      remitente,
      cargoRemitente,
    } = body;

    // En la CARTA el asunto es opcional (modelo epistolar peruano).
    const isCarta = String(tipoDocumento).toUpperCase().includes("CARTA");
    if (!cuerpo || (!asunto && !isCarta)) {
      return NextResponse.json({ error: "Faltan datos obligatorios: asunto y cuerpo." }, { status: 400 });
    }

    const slug = slugify(asunto ?? "");
    const hoy = new Date().toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });

    // Validar que la oficina pertenece al usuario (evita fuga de membrete ajeno).
    const officeFilter = getOfficeFilter(auth.user);
    if (officeFilter && oficinaId) {
      type OfiRow = { id: string; nombre: string | null; entidad: string | null };
      const [ofi] = await supabaseRest<OfiRow[]>(
        `expedientes_oficinas?id=eq.${encodeURIComponent(oficinaId)}&select=id,nombre,entidad&limit=1`,
      ).catch(() => [] as OfiRow[]);
      const allowed = ofi && (entitiesMatch(ofi.nombre, auth.user.entity) || entitiesMatch(ofi.entidad, auth.user.entity));
      if (!allowed) {
        return NextResponse.json({ error: "No tienes acceso a esta oficina" }, { status: 403 });
      }
    }

    // "Lugar" (ciudad institucional): "Challhuahuacho, 6 de julio de 2026".
    const ciudad = typeof lugar === "string" && lugar.trim() ? lugar.trim() : "";
    const fecha = ciudad ? `${ciudad}, ${hoy}` : hoy;
    // REF.: numero del documento anterior al que se responde (opcional).
    const ref = typeof referencia === "string" && referencia.trim() ? referencia.trim() : "";

    // ── PDF sobre la hoja membretada de la OFICINA ──
    if (format === "pdf") {
      let letterheadBytes: Uint8Array | null = null;
      let ofiResponsable = "";
      let ofiCargo = "";
      let ofiEntidad = "";
      try {
        const [ofi] = await supabaseRest<
          Array<{
            membrete_path: string | null;
            membrete_bucket: string | null;
            responsable_nombre: string | null;
            responsable_cargo: string | null;
            entidad: string | null;
          }>
        >(
          `expedientes_oficinas?id=eq.${oficinaId}&select=membrete_path,membrete_bucket,responsable_nombre,responsable_cargo,entidad`,
        );
        if (ofi) {
          ofiResponsable = ofi.responsable_nombre ?? "";
          ofiCargo = ofi.responsable_cargo ?? "";
          ofiEntidad = ofi.entidad ?? "";
          if (ofi.membrete_path && ofi.membrete_bucket) {
            const blob = await downloadStorageObject(ofi.membrete_bucket, ofi.membrete_path);
            letterheadBytes = new Uint8Array(await blob.arrayBuffer());
          }
        }
      } catch {
        letterheadBytes = null; // sin membrete: PDF en blanco
      }

      const pdfBytes = await buildRespuestaPdf({
        letterheadBytes,
        entityName: ofiEntidad || entity?.name || "",
        nroOficio: nroOficio ?? "",
        fecha,
        destinatario: destinatario ?? "",
        cargoDestinatario: cargoDestinatario ?? "",
        asunto: asunto ?? "",
        cuerpo,
        referencia: ref,
        remitente: remitente || ofiResponsable || "",
        cargoRemitente: cargoRemitente || ofiCargo || "",
      });

      await writeAuditLog({
        action: "respuesta.export",
        actorReference: auth.user.email ?? auth.user.id,
        details: { nroOficio, asunto, format: "pdf", membrete: Boolean(letterheadBytes) },
        entityType: "respuesta",
        module: "expedientes-archivo",
      });

      return new Response(new Uint8Array(pdfBytes), {
        headers: {
          "Content-Disposition": `attachment; filename="respuesta-${slug}.pdf"`,
          "Content-Type": "application/pdf",
        },
      });
    }

    // ── DOCX con membrete de texto ──
    // Enriquecer entity con los datos completos de entity_settings (address,
    // executingUnit) que el cliente no tiene. Fallback al body si la BD falla.
    type EntityRow = { name: string | null; ruc: string | null; address: string | null; executing_unit: string | null };
    let fullEntity = {
      name: entity?.name ?? "",
      ruc: entity?.ruc ?? "",
      address: entity?.address ?? "",
      executingUnit: entity?.executingUnit ?? "",
    };
    try {
      const [row] = await supabaseRest<EntityRow[]>(
        "entity_settings?id=eq.default&select=name,ruc,address,executing_unit&limit=1",
      );
      if (row) {
        fullEntity = {
          name: fullEntity.name || row.name || "",
          ruc: fullEntity.ruc || row.ruc || "",
          address: row.address || fullEntity.address,
          executingUnit: row.executing_unit || fullEntity.executingUnit,
        };
      }
    } catch {
      // Continuar con lo que el cliente envió.
    }

    if (!fullEntity.name) {
      return NextResponse.json({ error: "Para .docx indica el nombre de la entidad (membrete)." }, { status: 400 });
    }

    const buffer = await buildRespuestaDocx({
      entity: fullEntity,
      nroOficio: nroOficio ?? `${isCarta ? "CARTA" : "OFICIO"} N° ___ -${new Date().getFullYear()}`,
      destinatario: destinatario ?? "[DESTINATARIO]",
      cargoDestinatario: cargoDestinatario ?? "",
      lugar: ciudad,
      referencia: ref,
      asunto: asunto ?? "",
      cuerpo,
      remitente: remitente ?? entity?.name ?? "",
      cargoRemitente: cargoRemitente ?? "",
      tipoDocumento: String(tipoDocumento),
    });

    await writeAuditLog({
      action: "respuesta.export",
      actorReference: auth.user.email ?? auth.user.id,
      details: { nroOficio, asunto, format: "docx" },
      entityType: "respuesta",
      module: "expedientes-archivo",
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Disposition": `attachment; filename="respuesta-${slug}.docx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo exportar el documento" },
      { status: 500 },
    );
  }
}
