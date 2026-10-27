import {compareDocumentTexts} from "@/lib/normative-text-comparison";
import {z} from "zod";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { compareNorms, compareRequestSchema } from "@/lib/legal-compare";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) {
      return auth.error;
    }

    const payload = compareRequestSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: "Solicitud invalida", details: payload.error.flatten() },
        { status: 400 },
      );
    }

    if(payload.data.mode==="texto") {
      const a=z.string().uuid().safeParse(payload.data.sideA.documentId),b=z.string().uuid().safeParse(payload.data.sideB.documentId);
      if(!a.success||!b.success)return NextResponse.json({error:"Selecciona dos documentos exactos"},{status:400});
      try{return NextResponse.json({textComparison:await compareDocumentTexts(a.data,b.data),scope:"extracted-text"});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"No se pudo comparar el texto"},{status:422});}
    }
    const result = await compareNorms(payload.data, {
      accessToken: auth.user.accessToken,
      ownerId: auth.user.id,
    });

    return NextResponse.json({ topic: payload.data.topic, ...result, scope:"thematic-selection", scopeNotice:"Comparación temática con IA sobre pasajes recuperados (hasta ocho por documento); no es una comparación completa del texto." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo generar la comparacion";
    const isValidation = message.includes("alcances distintos");

    return NextResponse.json({ error: message }, { status: isValidation ? 400 : 500 });
  }
}
