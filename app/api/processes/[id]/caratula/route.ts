import { NextResponse } from "next/server";
import { archivarFormato, FORMATOS_ARCHIVABLES, MIME_DOCX } from "@/lib/archivar-formato";
import { idsDeRutaInvalidos, requireUser } from "@/lib/auth";
import { construirCaratula } from "@/lib/caratula-expediente";
import { resumenDelExpediente, type HitosDelExpediente } from "@/lib/expediente-columnas";
import { objectTypeLabel, processStatusLabel, processTypeLabel } from "@/lib/legal-taxonomy";
import { slugify } from "@/lib/slugify";
import { supabaseUserRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProcesoCaratula = {
  nomenclature: string;
  entity: string | null;
  object_type: string;
  procedure_type: string | null;
  status: string;
  valor_estimado: number | null;
  amount: number | null;
  moneda: string | null;
  necesidad_id: string | null;
  hitos: HitosDelExpediente;
  certificacion_presupuestal: string | null;
  formula_reajuste: string | null;
  garantias_adelantos: string | null;
  modalidad_ejecucion: string | null;
  requisitos_calificacion: string | null;
  sistema_contratacion: string | null;
  tipo_evaluador_perfil: string | null;
  tipo_interaccion_mercado: string | null;
  autoridad_aprobacion: string | null;
  doc_aprobacion_expediente: string | null;
};

type NecesidadCaratula = {
  codigo: string | null;
  area_usuaria: string | null;
  meta_presupuestal: string | null;
};

// GET /api/processes/[id]/caratula
//
// Portada del expediente en .docx: las decisiones registradas, en una página.
//
// El panel de resumen sirve en pantalla, pero entregarle el expediente a la AGA
// para que lo apruebe —o enseñárselo a quien audita— pide papel. Sin esto, quien
// lo recibe tiene que abrir la aplicación y recorrer cinco acordeones.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const malos = idsDeRutaInvalidos(id);
  if (malos) return malos;
  try {
    const [proceso] = await supabaseUserRest<ProcesoCaratula[]>(
      auth.user.accessToken,
      `procurement_processes?id=eq.${id}&select=nomenclature,entity,object_type,procedure_type,status,` +
        `valor_estimado,amount,moneda,necesidad_id,hitos,certificacion_presupuestal,formula_reajuste,` +
        `garantias_adelantos,modalidad_ejecucion,requisitos_calificacion,sistema_contratacion,` +
        `tipo_evaluador_perfil,tipo_interaccion_mercado,autoridad_aprobacion,doc_aprobacion_expediente`,
    );
    if (!proceso) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    // El área usuaria y la meta viven en la necesidad, no en el expediente: sin
    // ellas la carátula no dice de quién es la contratación.
    let necesidad: NecesidadCaratula | null = null;
    if (proceso.necesidad_id) {
      const filas = await supabaseUserRest<NecesidadCaratula[]>(
        auth.user.accessToken,
        `necesidades?id=eq.${proceso.necesidad_id}&select=codigo,area_usuaria,meta_presupuestal`,
      ).catch(() => []);
      necesidad = filas[0] ?? null;
    }

    const buffer = await construirCaratula({
      areaUsuaria: necesidad?.area_usuaria ?? null,
      codigoNecesidad: necesidad?.codigo ?? null,
      elaboradoPor: [auth.user.nombreCompleto, auth.user.cargo].filter(Boolean).join(" — ") || auth.user.email,
      entidad: proceso.entity,
      estado: processStatusLabel(proceso.status),
      fechaEmision: new Date().toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
      metaPresupuestal: necesidad?.meta_presupuestal ?? null,
      moneda: proceso.moneda,
      nomenclatura: proceso.nomenclature,
      objeto: objectTypeLabel(proceso.object_type),
      procedimiento: proceso.procedure_type
        ? processTypeLabel(proceso.procedure_type) ?? proceso.procedure_type
        : null,
      // Manda el valor estimado que fija A5; el importe suelto es el respaldo.
      valorEstimado: proceso.valor_estimado ?? proceso.amount,
      resumen: resumenDelExpediente(proceso, proceso.hitos ?? null),
    });

    const filename = `Caratula-Expediente-${slugify(proceso.nomenclature || id)}.docx`;
    await archivarFormato({
      accessToken: auth.user.accessToken,
      actorReference: auth.user.email ?? auth.user.id,
      contenido: new Uint8Array(buffer),
      fileName: filename,
      formato: FORMATOS_ARCHIVABLES["EXP|caratula"],
      mimeType: MIME_DOCX,
      ownerId: auth.user.id,
      processId: id,
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": MIME_DOCX,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la carátula." },
      { status: 500 },
    );
  }
}
