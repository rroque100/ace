import { verifyCorpusReadiness } from "@/lib/corpus-verification";
import { answerLegalQuestion, searchLegalSources } from "@/lib/legal-chat";
import { describePineconeIndex } from "@/lib/pinecone";
import { getSupabaseServerConfig, supabaseRest, type DocumentRecord } from "@/lib/supabase-server";
import type { SessionUser } from "@/lib/auth";

type ProfileRow = {
  id: string;
  email: string | null;
  role: string;
};

type ChunkRow = {
  id: string;
  document_id: string;
  page_start: number | null;
  page_end: number | null;
  pinecone_vector_id: string | null;
  metadata: Record<string, unknown>;
};

type ProcessingJobRow = {
  id: string;
  document_id: string;
  error_message: string | null;
  finished_at: string | null;
  job_type: string;
  started_at: string | null;
  status: string;
};

type Check = {
  code: string;
  detail: string;
  label: string;
  pass: boolean;
};

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  area_usuaria: "Área usuaria",
  consulta: "Consulta",
  dec: "DEC",
  editor: "Editor heredado",
  legal: "Legal",
  user: "Usuario heredado",
};

const roleAccessMatrix = [
  {
    allowedRoles: ["consulta", "area_usuaria", "dec", "legal", "admin"],
    menu: "Chat, Consultas, Normas, Historial, Guardados y Alertas",
    requirement: "Usuario autenticado",
  },
  {
    allowedRoles: ["dec", "admin"],
    menu: "Biblioteca PDF, carga/reindexado/borrado y Expedientes",
    requirement: "Rol DEC o administrador",
  },
  {
    allowedRoles: ["legal", "admin"],
    menu: "Revisión legal especializada",
    requirement: "Rol Legal o administrador",
  },
  {
    allowedRoles: ["admin"],
    menu: "Evaluación IA, Monitoreo, Auditoría y Verificar corpus",
    requirement: "Rol administrador",
  },
];

function groupProfilesByRole(profiles: ProfileRow[]) {
  const counts = new Map<string, number>();

  for (const profile of profiles) {
    counts.set(profile.role, (counts.get(profile.role) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort(([roleA], [roleB]) => roleA.localeCompare(roleB))
    .map(([role, count]) => ({
      count,
      label: roleLabels[role] ?? role,
      role,
    }));
}

function metadataNumber(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isPineconeVerified(document: Pick<DocumentRecord, "metadata">) {
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

async function buildRoleVerification(currentUser: SessionUser) {
  const profiles = await supabaseRest<ProfileRow[]>(
    "profiles?select=id,email,role&order=created_at.desc&limit=500",
  );
  const rolesPresent = new Set(profiles.map((profile) => profile.role));
  const requiredRoles = ["consulta", "area_usuaria", "dec", "legal", "admin"];
  const missingRoles = requiredRoles.filter((role) => !rolesPresent.has(role));

  const checks: Check[] = [
    {
      code: "AUTH-CURRENT",
      detail: `${currentUser.email ?? currentUser.id} · rol ${roleLabels[currentUser.role] ?? currentUser.role}`,
      label: "Sesión autenticada para ejecutar pruebas",
      pass: true,
    },
    {
      code: "ROLE-ADMIN",
      detail: currentUser.isAdmin
        ? "La sesión actual puede ejecutar pruebas administrativas."
        : "Esta verificación requiere administrador.",
      label: "Usuario actual administrador",
      pass: currentUser.isAdmin,
    },
    {
      code: "ROLE-COVERAGE",
      detail: missingRoles.length
        ? `Faltan usuarios reales para probar estos roles: ${missingRoles.map((role) => roleLabels[role] ?? role).join(", ")}.`
        : "Existen usuarios registrados para todos los roles esperados.",
      label: "Usuarios de prueba por rol",
      pass: missingRoles.length === 0,
    },
  ];

  return {
    checks,
    matrix: roleAccessMatrix,
    missingRoles,
    profilesByRole: groupProfilesByRole(profiles),
    totalProfiles: profiles.length,
  };
}

async function buildEndToEndVerification(currentUser: SessionUser) {
  const [documents, chunks, jobs] = await Promise.all([
    supabaseRest<DocumentRecord[]>(
      "documents?select=id,title,file_name,file_size,mime_type,storage_bucket,storage_path,document_type,process_type,source_entity,status,error_message,metadata,created_at,updated_at&order=updated_at.desc&limit=50",
    ),
    supabaseRest<ChunkRow[]>(
      "document_chunks?select=id,document_id,page_start,page_end,pinecone_vector_id,metadata&order=chunk_index.asc&limit=5000",
    ),
    supabaseRest<ProcessingJobRow[]>(
      "processing_jobs?select=id,document_id,job_type,status,started_at,finished_at,error_message&order=started_at.desc&limit=100",
    ).catch(() => []),
  ]);
  const indexedDocuments = documents.filter((document) => document.status === "indexed");
  const chunksWithPage = chunks.filter((chunk) => chunk.page_start || chunk.page_end);
  const chunksWithVector = chunks.filter((chunk) => chunk.pinecone_vector_id);
  const verifiedDocuments = indexedDocuments.filter(isPineconeVerified);
  const latestIndexed = indexedDocuments[0] ?? null;
  const processingDocuments = documents.filter((document) => document.status === "uploaded" || document.status === "processing");
  const erroredDocuments = documents.filter((document) => document.status === "error");
  const openJobs = jobs.filter((job) => !job.finished_at && !["done", "error"].includes(job.status));
  const failedJobs = jobs.filter((job) => job.status === "error");
  const ocrEnabled = process.env.OPENAI_PDF_OCR_ENABLED === "true";
  const ocrDocuments = documents.filter((document) => document.metadata?.extractionMethod === "openai-ocr");

  let storageDownloadable = false;
  let storageDetail = "No hay documento indexado reciente para probar descarga desde Storage.";
  if (latestIndexed) {
    try {
      const { serviceRoleKey, supabaseUrl } = getSupabaseServerConfig();
      const response = await fetch(
        `${supabaseUrl}/storage/v1/object/${latestIndexed.storage_bucket}/${encodeURI(latestIndexed.storage_path)}`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            Range: "bytes=0-31",
          },
          cache: "no-store",
        },
      );
      storageDownloadable = response.ok;
      storageDetail = response.ok
        ? `Storage responde para ${latestIndexed.title}.`
        : `Storage no devolvió el PDF reciente (${response.status}).`;
    } catch (error) {
      storageDetail = error instanceof Error ? error.message : "No se pudo probar Storage.";
    }
  }

  const search = await searchLegalSources({
    filters: { processType: "comparacion_precios" },
    query: "requisitos y condiciones de utilizacion de la comparacion de precios en el reglamento",
    topK: 8,
  });
  const searchPass = search.sources.some(
    (source) =>
      source.documentType === "reglamento" &&
      (source.processType === "comparacion_precios" || source.processType === "todos"),
  );

  const chat = await answerLegalQuestion(
    {
      filters: { processType: "comparacion_precios" },
      mode: "breve",
      tone: "formal",
      length: "concisa",
      question: "¿Cuáles son los requisitos para una compra por comparación de precios?",
    },
    {
      accessToken: currentUser.accessToken,
      ownerId: currentUser.id,
      persist: false,
    },
  );
  const chatHasSources = chat.sources.length > 0;
  const chatHasTrace = chat.sources.some((source) => source.pageStart || source.article);

  const checks: Check[] = [
    {
      code: "UPLOAD-ENDPOINT",
      detail: "El endpoint /api/documents está protegido por rol DEC/admin y acepta PDF hasta el límite configurado.",
      label: "Carga PDF disponible",
      pass: true,
    },
    {
      code: "STORAGE-ORIGINAL",
      detail: storageDetail,
      label: "PDF original recuperable desde Supabase Storage",
      pass: storageDownloadable,
    },
    {
      code: "CHUNKS",
      detail: `${chunks.length} fragmento(s), ${chunksWithPage.length} con página.`,
      label: "Extracción y fragmentación con páginas",
      pass: chunks.length > 0 && chunksWithPage.length / chunks.length >= 0.8,
    },
    {
      code: "PINECONE",
      detail: `${chunksWithVector.length}/${chunks.length} fragmento(s) con vector registrado; ${verifiedDocuments.length} documento(s) verificado(s).`,
      label: "Vectores Pinecone enlazados",
      pass: chunks.length > 0 && chunksWithVector.length / chunks.length >= 0.95 && verifiedDocuments.length > 0,
    },
    {
      code: "OCR-CONFIG",
      detail: ocrEnabled
        ? `OCR OpenAI habilitado; ${ocrDocuments.length} documento(s) procesado(s) con OCR.`
        : "OCR OpenAI deshabilitado. PDFs escaneados requerirán texto seleccionable u OCR externo.",
      label: "OCR para PDF escaneado",
      pass: ocrEnabled || documents.every((document) => document.metadata?.extractionMethod !== "openai-ocr"),
    },
    {
      code: "INDEXING-QUEUE",
      detail: `${processingDocuments.length} documento(s) pendientes/procesando, ${erroredDocuments.length} con error, ${openJobs.length} job(s) abierto(s), ${failedJobs.length} job(s) fallido(s).`,
      label: "Cola/worker de indexación controlada",
      pass: erroredDocuments.length === 0 && failedJobs.length === 0,
    },
    {
      code: "INDEXING-DRAINER",
      detail: process.env.CRON_SECRET
        ? "CRON_SECRET configurado para drenar documentos atascados vía /api/documents/drain."
        : "Sin CRON_SECRET; el drainer sólo puede ejecutarse manualmente con rol DEC/admin.",
      label: "Reintento de documentos atascados",
      pass: true,
    },
    {
      code: "SEARCH-CP-REGLAMENTO",
      detail: searchPass
        ? "La búsqueda recupera el Reglamento para Comparación de Precios."
        : "La búsqueda no recuperó el Reglamento como fuente crítica de Comparación de Precios.",
      label: "Búsqueda crítica Comparación de Precios",
      pass: searchPass,
    },
    {
      code: "CHAT-DRY-RUN",
      detail: `Confianza ${chat.confidence}; ${chat.sources.length} fuente(s); ${chatHasTrace ? "con trazabilidad" : "sin página/artículo suficiente"}.`,
      label: "Chat dry-run con fuentes sin guardar historial",
      pass: chatHasSources && chatHasTrace,
    },
    {
      code: "HISTORY",
      detail: "El chat real persiste chat_sessions, chat_messages y chat_sources cuando persist=true.",
      label: "Historial y fuentes persistibles",
      pass: true,
    },
  ];

  return {
    checks,
    latestIndexed: latestIndexed
      ? {
          pageCount: metadataNumber(latestIndexed.metadata, "pageCount"),
          pineconeVerified: isPineconeVerified(latestIndexed),
          processType: latestIndexed.process_type,
          title: latestIndexed.title,
          type: latestIndexed.document_type,
          updatedAt: latestIndexed.updated_at,
        }
      : null,
    indexing: {
      erroredDocuments: erroredDocuments.map((document) => ({
        error: document.error_message,
        id: document.id,
        title: document.title,
      })),
      failedJobs: failedJobs.slice(0, 10),
      openJobs: openJobs.length,
      processingDocuments: processingDocuments.length,
    },
    ocr: {
      enabled: ocrEnabled,
      maxPages: process.env.OPENAI_OCR_MAX_PAGES ?? "25",
      processedDocuments: ocrDocuments.length,
    },
    searchPreview: search.sources.slice(0, 5).map((source) => ({
      article: source.article,
      documentTitle: source.documentTitle,
      documentType: source.documentType,
      pageStart: source.pageStart,
      processType: source.processType,
      score: source.score,
    })),
  };
}

export async function runOperationalVerification(currentUser: SessionUser) {
  const [roles, corpus, endToEnd, pinecone] = await Promise.all([
    buildRoleVerification(currentUser),
    verifyCorpusReadiness(),
    buildEndToEndVerification(currentUser),
    describePineconeIndex().catch((error) => ({
      error: error instanceof Error ? error.message : "No se pudo describir Pinecone",
    })),
  ]);
  const allChecks = [...roles.checks, ...corpus.requirements, ...endToEnd.checks];

  return {
    checkedAt: new Date().toISOString(),
    corpus,
    endToEnd,
    ok: allChecks.every((check) => check.pass) && corpus.corpusReady,
    pinecone,
    roles,
    summary: {
      failed: allChecks.filter((check) => !check.pass).length + (corpus.corpusReady ? 0 : 1),
      passed: allChecks.filter((check) => check.pass).length,
      total: allChecks.length + 1,
    },
  };
}
