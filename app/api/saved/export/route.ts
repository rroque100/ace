import { NextResponse } from "next/server";
import { z } from "zod";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ExternalHyperlink,
} from "docx";
import { requireUser } from "@/lib/auth";
import {researchBriefSchema,briefText,type ResearchBrief} from '@/lib/research-brief';
import {csvSafe} from '@/lib/source-dossier';
import { supabaseUserRest, type DocumentRecord } from "@/lib/supabase-server";
import {
  dossierCsv,
  type DossierSource,
  sourceSnapshot,
} from "@/lib/source-dossier";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = z
    .object({
      ids: z.array(z.string().uuid()).min(1).max(100),
      format: z.enum(["preview", "csv", "docx"]),
      folderId:z.string().uuid().optional(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Selecciona de 1 a 100 elementos." },
      { status: 400 },
    );
  try {
    let brief:ResearchBrief|null=null;
    if(parsed.data.folderId){const [folder]=await supabaseUserRest<Array<Record<string,unknown>>>(auth.user.accessToken,`carpetas?id=eq.${parsed.data.folderId}&owner_id=eq.${auth.user.id}&select=research_question,research_objective,research_notes,research_status&limit=1`);if(!folder)return NextResponse.json({error:'Investigación no disponible.'},{status:404});brief=researchBriefSchema.parse(folder);}
    const items = await supabaseUserRest<
      Array<{
        id: string;
        title: string;
        document_id: string | null;
        message_id: string | null;
        note: string | null;
        carpeta_id:string|null;
        metadata: Record<string, unknown>;
      }>
    >(
      auth.user.accessToken,
      `guardados?id=in.(${[...new Set(parsed.data.ids)].join(",")})&owner_id=eq.${auth.user.id}&select=id,title,document_id,message_id,note,metadata,carpeta_id&order=created_at`,
    );
    if (items.length !== new Set(parsed.data.ids).size)
      return NextResponse.json(
        { error: "Algún elemento no está disponible para tu usuario." },
        { status: 404 },
      );
    const sources: DossierSource[] = [];
    if(parsed.data.folderId&&items.some(i=>i.carpeta_id!==parsed.data.folderId))return NextResponse.json({error:'El informe debe contener fuentes de esta investigación. Revisa la selección.'},{status:409});
    const referenced: DossierSource[] = [];
    for (const item of items) {
      let snapshot = item.metadata?.snapshot as DossierSource | undefined;
      if (item.document_id) {
        const [d] = await supabaseUserRest<DocumentRecord[]>(
          auth.user.accessToken,
          `documents?id=eq.${item.document_id}&select=*&limit=1`,
        );
        if (!d)
          return NextResponse.json(
            {
              error:
                "Una fuente ya no está disponible; retírala de la selección.",
            },
            { status: 409 },
          );
        snapshot = snapshot ?? sourceSnapshot(d);
        if(snapshot.sha256&&d.metadata.sha256&&snapshot.sha256!==d.metadata.sha256)return NextResponse.json({error:"El original cambió respecto al guardado; revisa la versión antes de exportar."},{status:409});
      } else if (item.message_id) {
        const [m] = await supabaseUserRest<
          Array<{
            id: string;
            content: string;
            sources?: Array<Record<string, unknown>>;
          }>
        >(
          auth.user.accessToken,
          `chat_messages?id=eq.${item.message_id}&select=id,content,sources&limit=1`,
        );
        if (!m)
          return NextResponse.json(
            { error: "Una respuesta ya no está disponible." },
            { status: 409 },
          );
        snapshot = snapshot ?? {
          title: item.title,
          quote: m.content,
          contentKind: "respuesta asistida",
        };
        snapshot.contentKind = "Respuesta asistida · pendiente de revisión";
        for (const source of m.sources ?? []) {
          const docId = z.string().uuid().safeParse(source.documentId);
          if (!docId.success)
            return NextResponse.json(
              {
                error:
                  "Una respuesta contiene una fuente sin identificar; revísala antes de exportar.",
              },
              { status: 409 },
            );
          const [doc] = await supabaseUserRest<DocumentRecord[]>(
            auth.user.accessToken,
            `documents?id=eq.${docId.data}&select=*&limit=1`,
          );
          if (!doc)
            return NextResponse.json(
              {
                error:
                  "Una fuente citada ya no está disponible para tu usuario.",
              },
              { status: 409 },
            );
          referenced.push({
            ...sourceSnapshot(doc),
            locatorLabel:
              typeof source.locatorLabel === "string"
                ? source.locatorLabel
                : typeof source.pageStart === "number"
                  ? `Página ${source.pageStart}`
                  : undefined,
            quote:
              typeof source.excerpt === "string" ? source.excerpt : undefined,
            contentKind: "Fuente citada por la respuesta",
          });
        }
      }
      sources.push({
        ...snapshot,
        title: snapshot?.title ?? item.title,
        note: item.note,
      });
    }
    sources.push(...referenced);
    if (sources.length > 250)
      return NextResponse.json(
        {
          error:
            "La selección contiene más de 250 referencias; divide la exportación en varias partes.",
        },
        { status: 400 },
      );
    if (parsed.data.format === "preview")
      return NextResponse.json({
        sources,
        research:brief,
        notice:
          "Relación de apoyo: verifica versiones y aplicación. No equivale a una decisión jurídica aprobada.",
      });
    if (parsed.data.format === "csv")
      return new Response((brief?'\ufeff'+[['Investigación',briefText(brief)]].map(row=>row.map(csvSafe).join(',')).join('\r\n')+'\r\n':'')+dossierCsv(sources).replace(/^\ufeff/,brief?'':'\ufeff'), {
        headers: {
          "Content-Type": "text/csv;charset=UTF-8",
          "Content-Disposition": "attachment; filename=fuentes-ace.csv",
        },
      });
    const children = [
      new Paragraph({
        text: "Relación de fuentes — ACE",
        heading: HeadingLevel.TITLE,
      }),
      new Paragraph(
        "Material de apoyo pendiente de revisión. Se distingue el texto original de las notas personales y respuestas asistidas.",
      ),
    ];
    if(brief)children.push(new Paragraph({text:'Investigación · contexto de trabajo',heading:HeadingLevel.HEADING_1}),...briefText(brief).split('\n').map(text=>new Paragraph(text)),new Paragraph('Generado: '+new Date().toISOString()));
    for (const s of sources) {
      children.push(
        new Paragraph({ text: s.title, heading: HeadingLevel.HEADING_2 }),
        new Paragraph(
          [
            s.sourceEntity,
            s.version,
            s.locatorLabel,
            `Revisión: ${s.review ?? "pendiente"}`,
            s.consultedAt,
          ]
            .filter(Boolean)
            .join(" · "),
        ),
        new Paragraph({
          children: [
            new TextRun({
              text: s.contentKind ?? "Pasaje original",
              bold: true,
            }),
          ],
        }),
        new Paragraph(
          s.quote ?? "Documento completo; sin pasaje seleccionado.",
        ),
      );
      if (s.sha256)
        children.push(new Paragraph("Huella del original: " + s.sha256));
      if (s.sourceUrl && /^https:\/\//.test(s.sourceUrl))
        children.push(
          new Paragraph({
            children: [
              new ExternalHyperlink({
                link: s.sourceUrl,
                children: [
                  new TextRun({ text: s.sourceUrl, style: "Hyperlink" }),
                ],
              }),
            ],
          }),
        );
      if (s.note) children.push(new Paragraph("Nota personal: " + s.note));
    }
    const bytes = await Packer.toBuffer(
      new Document({ sections: [{ children }] }),
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": "attachment; filename=fuentes-ace.docx",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "No se pudo preparar la exportación. Tus guardados se conservan.",
      },
      { status: 503 },
    );
  }
}
