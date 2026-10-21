import { documentTypeLabel } from "@/lib/legal-taxonomy";
import { LEY_32069_PROCESOS_CATALOGO, codigoProceso } from "@/lib/procesos-catalogo-32069";
import { PROCESOS_SELECCION, esModeloDeProceso } from "@/lib/procesos-seleccion";
import { supabaseRest } from "@/lib/supabase-server";

type DocumentRow = {
  id: string;
  title: string;
  file_name: string | null;
  document_type: string;
  process_type: string | null;
  status: string;
  metadata: Record<string, unknown>;
};

type ChunkRow = {
  document_id: string;
  page_start: number | null;
  page_end: number | null;
  pinecone_vector_id: string | null;
  metadata: Record<string, unknown>;
};

/** Código del procedimiento → su nombre en el catálogo. */
const VALOR_POR_CODIGO = new Map(
  PROCESOS_SELECCION.filter((p) => p.value).map((p) => [codigoProceso(p.value), p.value]),
);

const relevantDocumentTypes = ["ley", "reglamento", "directiva", "opinion", "bases_integradas"] as const;

function chunkArticle(chunk: ChunkRow) {
  const value = chunk.metadata.article ?? chunk.metadata.articulo;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isPineconeVerified(document: DocumentRow) {
  const pinecone = document.metadata?.pinecone;
  if (!pinecone || typeof pinecone !== "object") {
    return false;
  }
  const verification = (pinecone as Record<string, unknown>).verification;
  return Boolean(
    verification &&
      typeof verification === "object" &&
      (verification as Record<string, unknown>).verified === true,
  );
}

/**
 * ¿Este documento respalda ese procedimiento?
 *
 * Antes bastaba con NO tener `process_type` para contar en TODOS. Con un solo
 * documento sin clasificar —el modelo del procedimiento no competitivo, que se
 * subió sin proceso— los diez procedimientos salían "operativo", incluidos los
 * del régimen derogado. Ahora el alcance sigue el mismo criterio con el que se
 * suben (processScopeFor en document-upload): Ley y Reglamento marcan "todos",
 * las opiniones del OECE son de alcance general, y directivas y bases TIENEN que
 * declarar a qué procedimiento aplican. Sin declararlo no respaldan a ninguno.
 */
export function documentAppliesToProcess(document: DocumentRow, processType: string): boolean {
  if (document.process_type === "todos") return true;
  // Opinión del OECE: interpreta la norma, no es de un procedimiento concreto.
  if (document.document_type === "opinion") return true;

  // El vínculo explícito del modelo de requerimiento manda sobre `process_type`.
  const vinculo = document.metadata?.procesoSeleccion;
  if (typeof vinculo === "string" && vinculo.trim()) {
    if (codigoProceso(vinculo) === processType) return true;
    // Y además el catálogo puede declarar ese mismo archivo como modelo base de
    // otros procedimientos —el de obras vale para la licitación de obras, la de
    // precalificación y la de negociación—. Es el MISMO puente que usa
    // `resolverModeloDocId`; sin esto el panel decía "sin modelo" de
    // procedimientos para los que el copiloto sí encuentra uno.
    const valor = VALOR_POR_CODIGO.get(processType);
    return Boolean(valor && esModeloDeProceso(document.file_name, valor));
  }

  const declarado = document.process_type;
  if (!declarado) return false;
  if (declarado === processType) return true;
  // Puente con el vocabulario grueso: un documento marcado "concurso_publico"
  // respalda a "concurso_publico_de_servicios" y demás de esa familia. Es
  // transitorio, hasta que `documents.process_type` use el catálogo de la 32069.
  return processType.startsWith(`${declarado}_`);
}

export async function getCorpusQualityByProcedure() {
  const [documents, chunks] = await Promise.all([
    supabaseRest<DocumentRow[]>(
      "documents?select=id,title,file_name,document_type,process_type,status,metadata&limit=2000",
    ),
    supabaseRest<ChunkRow[]>(
      "document_chunks?select=document_id,page_start,page_end,pinecone_vector_id,metadata&limit=10000",
    ),
  ]);
  const chunksByDocument = new Map<string, ChunkRow[]>();

  for (const chunk of chunks) {
    chunksByDocument.set(chunk.document_id, [...(chunksByDocument.get(chunk.document_id) ?? []), chunk]);
  }

  // Los procedimientos que se evalúan son los de la Ley 32069. Antes se recorría
  // PROCESS_TYPES, que es la taxonomía de la Ley 30225 y se conserva solo para
  // filtrar documentos históricos: el panel puntuaba «Adjudicación Simplificada»
  // y «Acuerdo Marco» —que no existen en el régimen vigente— y no decía nada de
  // los 18 procedimientos reales.
  const procedures = LEY_32069_PROCESOS_CATALOGO.map((procedure) => {
    const typeCoverage = relevantDocumentTypes.map((documentType) => {
      const docs = documents.filter(
        (document) =>
          document.document_type === documentType &&
          document.status === "indexed" &&
          documentAppliesToProcess(document, procedure.code),
      );
      const docChunks = docs.flatMap((document) => chunksByDocument.get(document.id) ?? []);
      const chunksWithPage = docChunks.filter((chunk) => chunk.page_start || chunk.page_end).length;
      const chunksWithArticle = docChunks.filter(chunkArticle).length;
      const chunksWithVector = docChunks.filter((chunk) => chunk.pinecone_vector_id).length;
      const ready =
        docs.length > 0 &&
        docChunks.length > 0 &&
        chunksWithVector / docChunks.length >= 0.9 &&
        (documentType === "bases_integradas" || chunksWithPage > 0);

      return {
        chunks: docChunks.length,
        chunksWithArticle,
        chunksWithPage,
        chunksWithVector,
        documentType,
        documentTypeLabel: documentTypeLabel(documentType),
        documents: docs.length,
        pineconeVerified: docs.filter(isPineconeVerified).length,
        ready,
      };
    });
    const normativeReady = ["ley", "reglamento", "directiva"].every((type) =>
      typeCoverage.some((item) => item.documentType === type && item.ready),
    );
    const operationalReady = typeCoverage.some((item) => item.documentType === "bases_integradas" && item.ready);
    const score = Math.round((typeCoverage.filter((item) => item.ready).length / typeCoverage.length) * 100);
    const missingDocumentTypes = typeCoverage
      .filter((item) => !item.ready)
      .map((item) => ({
        documentType: item.documentType,
        documentTypeLabel: item.documentTypeLabel,
        reason:
          item.documents === 0
            ? "No hay documento indexado para este procedimiento."
            : item.chunks === 0
              ? "El documento existe, pero no tiene fragmentos procesados."
              : item.chunksWithVector / Math.max(item.chunks, 1) < 0.9
                ? "Faltan vectores en Pinecone."
                : item.documentType !== "bases_integradas" && item.chunksWithPage === 0
                  ? "Faltan paginas identificadas para citas exactas."
                  : "Requiere revision de indexacion.",
      }));

    return {
      missingDocumentTypes,
      operationalReady,
      processType: procedure.code,
      processTypeLabel: procedure.label,
      score,
      status: normativeReady ? "listo" : operationalReady ? "operativo_sin_norma_completa" : "incompleto",
      typeCoverage,
    };
  });

  return {
    checkedAt: new Date().toISOString(),
    procedures,
  };
}
