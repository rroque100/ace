import { NextResponse } from "next/server";
import { archivarFormato, FORMATOS_ARCHIVABLES, MIME_DOCX } from "@/lib/archivar-formato";
import { idsDeRutaInvalidos, requireUser } from "@/lib/auth";
import { buildAnuncioFuturoDocx, datosAnuncioFuturo } from "@/lib/anuncio-futuro-docx";
import { objectTypeLabel } from "@/lib/legal-taxonomy";
import type { HitosMap } from "@/lib/procurement-fases";
import { slugify } from "@/lib/slugify";
import { supabaseRest, supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProcesoRow = {
  id: string;
  nomenclature: string;
  object_type: string | null;
  entity: string | null;
  hitos: HitosMap | null;
};

type EntitySettingsRow = { name: string | null; city: string | null };

// Ciudad y denominación de la entidad (Configuración). Service-role a propósito:
// entity_settings solo es visible para admins por RLS, pero el anuncio lo genera
// cualquier usuario con acceso al expediente. Son datos institucionales que de
// todos modos se imprimen en el documento.
async function getEntidad(): Promise<EntitySettingsRow | null> {
  const rows = await supabaseRest<EntitySettingsRow[]>(
    "entity_settings?id=eq.default&select=name,city&limit=1",
  ).catch(() => []);
  return rows[0] ?? null;
}

// GET /api/processes/[id]/fase1/anuncio-docx
// Genera el Anuncio de Contratación Futura (paso A10, Art. 43) en .docx con lo
// capturado en el expediente.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;

  try {
    const rows = await supabaseUserRest<ProcesoRow[]>(
      auth.user.accessToken,
      `procurement_processes?id=eq.${id}&select=id,nomenclature,object_type,entity,hitos`,
    );
    const proceso = rows[0];
    if (!proceso) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    const hitos = proceso.hitos ?? {};
    if (!hitos.A10) {
      return NextResponse.json(
        { error: "Guarda el paso A10 (Anuncio de contratación futura) antes de generar el documento." },
        { status: 409 },
      );
    }
    const a10 = (hitos.A10.data ?? {}) as Record<string, unknown>;

    const entidadRow = await getEntidad();
    const entidad = proceso.entity?.trim() || entidadRow?.name?.trim() || "La entidad contratante";
    const objetoLabel = proceso.object_type ? objectTypeLabel(proceso.object_type) : null;

    const input = datosAnuncioFuturo(a10, {
      entidad,
      ciudad: entidadRow?.city ?? null,
      nomenclatura: proceso.nomenclature,
      objetoLabel,
      hoy: new Date().toISOString().slice(0, 10),
    });

    const buffer = await buildAnuncioFuturoDocx({
      ...input,
      elaboradoPor: [auth.user.nombreCompleto, auth.user.cargo].filter(Boolean).join(" — ") || auth.user.email,
    });
    const filename = `Anuncio-Contratacion-Futura-${slugify(proceso.nomenclature || "expediente")}.docx`;

    const archivable = FORMATOS_ARCHIVABLES["A10|anuncio"];
    if (archivable) {
      await archivarFormato({
        accessToken: auth.user.accessToken,
        actorReference: auth.user.email ?? auth.user.id,
        contenido: new Uint8Array(buffer),
        fileName: filename,
        formato: archivable,
        mimeType: MIME_DOCX,
        ownerId: auth.user.id,
        processId: id,
      });
    }

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": MIME_DOCX,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el anuncio" },
      { status: 500 },
    );
  }
}
