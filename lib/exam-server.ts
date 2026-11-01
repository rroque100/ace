import { getSupabaseAdminClient } from "./supabase-server";
import { publicExam, type RawExam, type ExamQuestion } from "./exam-policy";
export async function examRpc(name: string, args: Record<string, unknown>) {
  const c = await getSupabaseAdminClient();
  const r = await c.rpc(name, args);
  if (r.error)
    throw Object.assign(Error(r.error.message), { code: r.error.code });
  return r.data;
}
export async function getExam(actor: string, id: string) {
  return publicExam(
    (await examRpc("ace_exam_get", { p_actor: actor, p_id: id })) as RawExam,
  );
}
const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
export async function validateExamSources(
  question: Pick<ExamQuestion, "sources" | "regime">,
) {
  const c = await getSupabaseAdminClient();
  for (const s of question.sources) {
    const [d, x] = await Promise.all([
      c
        .from("documents")
        .select("id,title,status,es_institucional,metadata")
        .eq("id", s.documentId)
        .single(),
      c
        .from("document_chunks")
        .select("id,document_id,content,page_start,page_end,metadata")
        .eq("id", s.chunkId)
        .eq("document_id", s.documentId)
        .single(),
    ]);
    if (
      d.error ||
      x.error ||
      !d.data?.es_institucional ||
      d.data.status !== "indexed"
    )
      throw Error(
        "La fuente no está disponible como documento institucional indexado.",
      );
    if (
      d.data.metadata.regime !== question.regime &&
      !d.data.metadata.declaredRegimes?.includes(question.regime)
    )
      throw Error("La fuente no identifica el régimen de esta pregunta.");
    if (d.data.metadata.sha256 !== s.sha256)
      throw Error(
        "La versión de la fuente cambió: vuelve a revisar la pregunta.",
      );
    if (
      x.data.metadata.ocrPartial ||
      !normalize(x.data.content).includes(normalize(s.quote))
    )
      throw Error(
        "El pasaje citado no coincide con la fuente; revisa el texto original.",
      );
    if (s.pageStart !== x.data.page_start || s.pageEnd !== x.data.page_end)
      throw Error("El rango de páginas debe coincidir con el pasaje original.");
    if (String(x.data.metadata.article ?? "") !== s.article)
      throw Error("El artículo no coincide con el pasaje seleccionado.");
    if (
      d.data.title !== s.title ||
      d.data.metadata.officialVersion !== s.version
    )
      throw Error(
        "El título o versión de la fuente no coincide con el registro.",
      );
  }
}
export function examError(error: unknown) {
  const e = error as {
    code?: string;
    message?: string;
    issues?: Array<{ message: string }>;
  };
  if (e.issues?.length) return { status: 400, message: e.issues[0].message };
  if (e.code === "23505")
    return {
      status: 409,
      message:
        "Ya existe una pregunta publicada con el mismo enunciado. Revisa el banco antes de publicar una copia.",
    };
  if (e.code === "P0002")
    return { status: 404, message: "No se encontró este intento." };
  if (e.code === "40001")
    return {
      status: 409,
      message:
        e.message ?? "Los datos cambiaron; actualiza e intenta nuevamente.",
    };
  if (e.code === "PGRST202" || e.code === "42P01")
    return {
      status: 503,
      message:
        "El simulador está preparando su banco. Falta activar la migración del módulo.",
    };
  return {
    status: 400,
    message: e.message ?? "No se pudo completar la operación.",
  };
}
