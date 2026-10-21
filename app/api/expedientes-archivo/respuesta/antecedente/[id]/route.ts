import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-server";
import {
  shapeAntecedente,
  type AntecedenteResponse,
  type AntecedenteRow,
} from "../route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/expedientes-archivo/respuesta/antecedente/[id]
// Devuelve el texto completo + metadata de un antecedente persistido.
// Usado cuando el usuario re-abre una respuesta guardada.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Falta el id" }, { status: 400 });
    }
    const rows = await supabaseRest<AntecedenteRow[]>(
      `respuesta_antecedentes?id=eq.${id}&select=*`,
    ).catch(() => []);
    const row = rows?.[0];
    if (!row) {
      return NextResponse.json({ error: "Antecedente no encontrado" }, { status: 404 });
    }
    if (
      row.created_by &&
      row.created_by !== auth.user.id &&
      auth.user.role !== "admin" &&
      auth.user.role !== "dec"
    ) {
      return NextResponse.json(
        { error: "No tienes permiso para ver este antecedente" },
        { status: 403 },
      );
    }

    // Recuperamos el texto desde Pinecone (fuente de verdad tras la indexacion).
    const { fetchDocumentChunks } = await import("@/lib/pinecone");
    let text = "";
    try {
      const doc = await fetchDocumentChunks(
        row.pinecone_document_id,
        row.pinecone_namespace,
        200,
      );
      if (doc?.text) text = doc.text;
    } catch {
      text = "";
    }

    const payload: AntecedenteResponse = shapeAntecedente(row);
    return NextResponse.json({ ...payload, text });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo obtener el antecedente" },
      { status: 500 },
    );
  }
}
