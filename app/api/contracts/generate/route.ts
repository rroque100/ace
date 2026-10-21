import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { type ClauseReference, buildContractDocx } from "@/lib/contract-generator";
import { getSettingsCatalog } from "@/lib/settings-catalog";
import { supabaseRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const contractSchema = z.object({
  entity: z.string().trim().optional().or(z.literal("")),
  object: z.string().trim().min(3),
  processType: z.string().trim().optional().or(z.literal("")),
  amount: z.string().trim().optional().or(z.literal("")),
  contractorName: z.string().trim().optional().or(z.literal("")),
  contractorRuc: z.string().trim().optional().or(z.literal("")),
  durationDays: z.coerce.number().int().positive().optional().or(z.literal("")),
  place: z.string().trim().optional().or(z.literal("")),
});

type ArticleRow = { article_number: string; article_label: string | null; content: string };

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)
    .toLowerCase();
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const payload = contractSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: "Solicitud invalida", details: payload.error.flatten() },
        { status: 400 },
      );
    }

    const data = payload.data;
    const catalog = await getSettingsCatalog(auth.user).catch(() => null);
    const effectiveEntity = data.entity || catalog?.entity.name || auth.user.entity || "";

    if (effectiveEntity.trim().length < 2) {
      return NextResponse.json({ error: "Configura o ingresa la entidad contratante." }, { status: 400 });
    }

    // Si la entidad del contrato es la configurada en Municipalidad, adjuntamos
    // su RUC y domicilio para identificar correctamente a LA ENTIDAD.
    const usesConfiguredEntity =
      Boolean(catalog?.entity.name) &&
      effectiveEntity.trim().toLowerCase() === catalog!.entity.name.trim().toLowerCase();
    const entityRuc = usesConfiguredEntity ? catalog!.entity.ruc || null : null;
    const entityAddress = usesConfiguredEntity ? catalog!.entity.address || null : null;

    // El formulario envia el codigo del proceso; resolvemos su nombre legible
    // desde el catalogo para que el contrato no muestre el codigo crudo.
    const processTypeLabel = data.processType
      ? catalog?.processTypes.find((item) => item.value === data.processType)?.label ?? null
      : null;

    // Referencias del corpus (art. 60/61) para fundamentar, si estan indexadas.
    const articles = await supabaseRest<ArticleRow[]>(
      "norma_articulos?article_number=in.(60,61)&select=article_number,article_label,content&limit=4",
    ).catch(() => []);
    const references: ClauseReference[] = articles.map((article) => ({
      article: article.article_number,
      title: article.article_label?.replace(/^articulo\s+\d+[.\-]?\s*/i, "").slice(0, 80) ?? "",
      excerpt: article.content,
    }));

    const buffer = await buildContractDocx(
      {
        amount: data.amount || null,
        contractorName: data.contractorName || null,
        contractorRuc: data.contractorRuc || null,
        durationDays: typeof data.durationDays === "number" ? data.durationDays : null,
        entity: effectiveEntity,
        entityAddress,
        entityRuc,
        object: data.object,
        place: data.place || null,
        processType: data.processType || null,
        processTypeLabel,
      },
      references,
    );

    await writeAuditLog({
      action: "contract.generate",
      details: { entity: effectiveEntity, object: data.object, processType: data.processType || null },
      entityType: "contract",
      module: "contratos",
      processType: data.processType || null,
      user: {
        email: auth.user.email,
        entity: effectiveEntity,
        id: auth.user.id,
        role: auth.user.role,
      },
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Disposition": `attachment; filename="contrato-${slugify(data.object) || "borrador"}.docx"`,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el contrato" },
      { status: 500 },
    );
  }
}
