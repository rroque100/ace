import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { buildContratoCpDocx, buildContratoCpPdf, type ContratoCpInput } from "@/lib/contrato-cp";
import { slugify } from "@/lib/slugify";
import { writeAuditLog } from "@/lib/supabase-server";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  formato: z.enum(["docx", "pdf"]).default("docx"),
  numeroContrato: z.string().trim().max(120).optional(),
  proceso: z.object({
    nomenclatura: z.string().trim().max(200).default(""),
    denominacion: z.string().trim().max(600).default(""),
    entidadNombre: z.string().trim().max(200).default(""),
    entidadRuc: z.string().trim().max(20).default(""),
    entidadDomicilio: z.string().trim().max(300).default(""),
    fechaBuenaPro: z.string().trim().max(60).optional(),
    entidadRepresentante: z.string().trim().max(200).optional(),
    entidadRepresentanteDni: z.string().trim().max(30).optional(),
    entidadRepresentanteCargo: z.string().trim().max(120).optional(),
  }),
  postor: z.object({
    razonSocial: z.string().trim().max(250).default(""),
    ruc: z.string().trim().max(20).default(""),
    domicilio: z.string().trim().max(300).default(""),
    partidaRegistral: z.string().trim().max(60).optional(),
    asiento: z.string().trim().max(60).optional(),
    ciudadRegistro: z.string().trim().max(120).optional(),
    representante: z.string().trim().max(200).default(""),
    docTipo: z.string().trim().max(40).optional(),
    docNumero: z.string().trim().max(30).optional(),
    poderPartida: z.string().trim().max(60).optional(),
    poderAsiento: z.string().trim().max(60).optional(),
    poderCiudad: z.string().trim().max(120).optional(),
    correo: z.string().trim().max(200).optional(),
  }),
  contrato: z.object({
    monto: z.string().trim().max(80).default(""),
    formaPago: z.string().trim().max(300).optional(),
    lugarEntrega: z.string().trim().max(400).optional(),
    plazoEntrega: z.string().trim().max(200).optional(),
    inicioPlazo: z.string().trim().max(300).optional(),
    cronograma: z.array(z.object({
      paquete: z.string().trim().max(20).default(""),
      descripcion: z.string().trim().max(300).default(""),
      marca: z.string().trim().max(100).default(""),
      unidad: z.string().trim().max(60).default(""),
      cantidad: z.string().trim().max(40).default(""),
    })).max(100).default([]),
    preciosUnitarios: z.array(z.object({
      concepto: z.string().trim().max(300).default(""),
      marca: z.string().trim().max(100).default(""),
      unidad: z.string().trim().max(60).default(""),
      cantidad: z.string().trim().max(40).default(""),
      precioUnitario: z.string().trim().max(40).default(""),
      precioTotal: z.string().trim().max(40).default(""),
    })).max(50).optional(),
    preciosTotalGeneral: z.string().trim().max(40).optional(),
    viciosOcultosAnios: z.string().trim().max(40).optional(),
    institucionArbitral: z.string().trim().max(250).optional(),
    recepcionArea: z.string().trim().max(200).optional(),
    conformidadArea: z.string().trim().max(200).optional(),
    plazoConformidadDias: z.string().trim().max(40).optional(),
    ciudadFirma: z.string().trim().max(120).optional(),
    fechaFirma: z.string().trim().max(60).optional(),
  }),
});

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const rl = checkRateLimit(getRateLimitKey(request, auth.user.id, "contratos-cp-generar"), RATE_LIMITS.aiSearch);
    if (!rl.allowed) return rateLimitResponse(rl);

    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { formato, ...rest } = parsed.data;
    const input = rest as ContratoCpInput;
    if (!input.proceso.denominacion && !input.proceso.nomenclatura) {
      return NextResponse.json(
        { error: "Completa los datos del proceso (nomenclatura y objeto)." },
        { status: 400 },
      );
    }

    if (!input.proceso.entidadRepresentante) {
      type EntityMgr = { manager_full_name?: string | null; manager_dni?: string | null; manager_position?: string | null };
      const { supabaseRest } = await import("@/lib/supabase-server");
      const rows = await supabaseRest<EntityMgr[]>(
        "entity_settings?id=eq.default&select=manager_full_name,manager_dni,manager_position&limit=1",
      ).catch(() => [] as EntityMgr[]);
      const mgr = rows?.[0];
      if (mgr) {
        input.proceso.entidadRepresentante = mgr.manager_full_name ?? undefined;
        input.proceso.entidadRepresentanteDni = mgr.manager_dni ?? undefined;
        input.proceso.entidadRepresentanteCargo = mgr.manager_position ?? undefined;
      }
    }

    const buffer = formato === "pdf" ? await buildContratoCpPdf(input) : await buildContratoCpDocx(input);

    await writeAuditLog({
      action: "contratos.cp.generar",
      actorReference: auth.user.email ?? auth.user.id,
      details: { nomenclatura: input.proceso.nomenclatura, contratista: input.postor.razonSocial, formato },
      entityType: "contrato_cp",
      module: "contratos",
    }).catch(() => undefined);

    const slug = slugify(input.proceso.nomenclatura || input.proceso.denominacion);
    const contentType = formato === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="contrato-cp-${slug}.${formato}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el contrato" },
      { status: 500 },
    );
  }
}
