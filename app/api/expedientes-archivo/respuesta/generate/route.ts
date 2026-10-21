import { NextResponse } from "next/server";
import { getArchivoScopeLevel, getOfficeFilter, requireUser } from "@/lib/auth";
import { isTipoDocumento } from "@/lib/document-number";
import { getOpenAIClient, legalAnswerModel as model } from "@/lib/openai-server";
import { extractResponseText } from "@/lib/openai-response";
import { estimateCostUsd, roundCostUsd } from "@/lib/openai-cost";
import { searchLegalSources } from "@/lib/legal-chat";
import { searchExpedientes } from "@/lib/expedientes-archivo-search";
import {
  fetchDocumentChunks,
  respuestaAdjuntosNamespace,
} from "@/lib/pinecone";
import { writeAuditLog } from "@/lib/supabase-server";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const toneLabels: Record<string, string> = {
  cercano: "cercano, accesible y didactico, como si hablaras directamente con el administrado",
  formal: "formal e institucional, propio de un documento oficial municipal",
  tecnico: "tecnico-juridico especializado, con precision normativa y terminologia legal",
};

const lengthLabels: Record<string, string> = {
  concisa: "breve y directa, solo lo esencial",
  media: "equilibrada, con el detalle suficiente sin ser excesiva",
  detallada: "extensa y profunda, cubriendo todos los aspectos del caso",
};

// Esquemas de cuerpo por tipo de documento (estandar peruano).
// Cada tipo tiene su estructura y reglas de cortesia propias.
const documentSchemas: Record<string, { structure: string; courtesy: string; close: string }> = {
  OFICIO: {
    // Modelo peruano de oficio (comunicacion oficial entre entidades publicas).
    // El lugar/fecha, la numeracion, el bloque del destinatario, el ASUNTO,
    // la REF., la despedida y la firma los añade el EXPORTADOR: la IA solo
    // redacta el cuerpo (introduccion, desarrollo y cierre).
    structure: [
      "INTRODUCCION: formula protocolar de apertura ('Tengo el agrado de dirigirme a usted...' o 'Es grato dirigirme a usted...') enlazada con el motivo del documento.",
      "DESARROLLO: exposicion del tema, motivo o peticion, citando la normativa aplicable cuando corresponda.",
      "CIERRE: formula protocolar de cierre ('En espera de su atencion, me despido...' o 'Es propicia la oportunidad para expresarle los sentimientos de mi especial consideracion.').",
    ].join("\n"),
    courtesy:
      "Lenguaje protocolar institucional. NO escribas el lugar/fecha, ni la numeracion (OFICIO N° ...), ni el bloque del destinatario (Senor(a)/cargo/institucion/ciudad), ni las lineas ASUNTO/REF.: esos datos se añaden automaticamente al exportar.",
    close:
      "NO escribas la despedida ('Atentamente,') ni la firma: se añaden automaticamente al exportar. Termina con la formula protocolar de cierre.",
  },
  INFORME: {
    // Documento tecnico/administrativo: exposicion OBJETIVA de hechos, analisis
    // de una situacion o resultados de una gestion.
    structure: [
      "I. INTRODUCCION / ANTECEDENTES: explica el motivo, contexto o encargo que origina el informe, y el marco legal o normativa aplicable (con numero de norma y articulo cuando corresponda).",
      "II. ANALISIS O CUERPO DEL INFORME: desarrollo detallado de los hechos, datos, hallazgos o resultados. Usa subtitulos por tema o area cuando ayuden a la claridad; presenta cifras o comparaciones en cuadros o listas; ordena la exposicion cronologicamente o por criterios.",
      "III. CONCLUSIONES: sintesis de los principales hallazgos o resultados, en parrafos numerados. Deben ser OBJETIVAS y basadas exclusivamente en lo expuesto en el analisis (no introducir hechos nuevos).",
      "IV. RECOMENDACIONES: acciones propuestas en funcion de las conclusiones, concretas y accionables (incluir solo si el caso lo amerita).",
    ].join("\n"),
    courtesy:
      "Tono tecnico/administrativo objetivo, en PRIMERA PERSONA SINGULAR (quien informa es el/la responsable que firma: 'informo', 'he verificado', 'concluyo', 'recomiendo'). Sin formulas de cortesia epistolar al inicio ni al cierre (es un documento interno dirigido al superior o al area que lo encargo). NO escribas el encabezado (INFORME N°, PARA/DE, asunto, fecha): lo añade automaticamente el exportador. Empieza directamente en 'I. INTRODUCCION / ANTECEDENTES'.",
    close:
      "Cierra con 'Es todo cuanto informo para su conocimiento y fines pertinentes.'. NO escribas lugar/fecha ni la firma (nombre, cargo o dependencia del emisor): se añaden automaticamente al exportar.",
  },
  CARTA: {
    // Modelo peruano de carta (comunicacion con personas naturales o empresas
    // privadas). El lugar/fecha, el bloque del destinatario, el asunto, la
    // despedida y la firma los añade el EXPORTADOR: la IA solo redacta desde
    // el vocativo hasta el parrafo de cierre.
    structure: [
      "SALUDO / VOCATIVO: una linea de cortesia dirigida a la persona indicada en 'DIRIGIDO A' ('Estimado(a) senor(a) [apellido]:', 'Distinguido(a) senor(a):' o 'De mi mayor consideracion:'). Usa su apellido/denominacion LITERAL; no inventes otro destinatario.",
      "PARRAFO DE APERTURA: presentacion y motivo de la carta.",
      "PARRAFOS DE DESARROLLO: exposicion del tema con claridad y orden, en segunda persona hacia el destinatario de 'DIRIGIDO A'.",
      "PARRAFO DE CIERRE: solicitud, agradecimiento o llamada a la accion.",
    ].join("\n"),
    courtesy:
      "Usa formulas de cortesia flexibles segun el destinatario de 'DIRIGIDO A' (persona natural o empresa privada). NO escribas el lugar/fecha, ni el bloque del destinatario (Senor(a)/cargo/empresa/ciudad), ni la linea de asunto: esos datos se añaden automaticamente al exportar.",
    close:
      "NO escribas la despedida ('Atentamente,'/'Cordialmente,') ni la firma: se añaden automaticamente al exportar. Termina con el parrafo de cierre.",
  },
  MEMORANDUM: {
    // Documento interno: comunicacion BREVE y DIRECTA entre areas o personas
    // de la misma organizacion.
    structure: [
      "1. ENCABEZADO: NO lo escribas. El numero (MEMORANDUM N° ...), destinatario, asunto y fecha los añade automaticamente el exportador.",
      "2. CUERPO DEL TEXTO: breve y directo, SIN saludo formal. Parrafo unico o muy corto que indique la disposicion, instruccion, comunicado o solicitud. Formulas tipicas: 'Por el presente, se hace de su conocimiento que a partir del dia de la fecha queda usted encargado(a) de...' o 'Se le informa que el dia... se realizara..., por lo que debera...'.",
    ].join("\n"),
    courtesy:
      "Sin formulas de cortesia protocolares ni saludo inicial (es comunicacion interna). Tono directo e imperativo-institucional. NO extender el cuerpo: un memorandum largo es un memorandum mal redactado.",
    close:
      "NO escribas la despedida ('Atentamente,') ni la firma (nombre y cargo del remitente): se añaden automaticamente al exportar. Termina con el parrafo de la disposicion o, si corresponde, con la distribucion 'c.c.: ...'.",
  },
  "MEMORANDUM MULTIPLE": {
    // Igual que el memorandum, pero dirigido a VARIOS destinatarios a la vez.
    structure: [
      "1. ENCABEZADO: NO lo escribas. El numero (MEMORANDUM MULTIPLE N° ...), los destinatarios, el asunto y la fecha los añade automaticamente el exportador.",
      "2. CUERPO DEL TEXTO: breve y directo, SIN saludo formal. Parrafo unico o muy corto con la disposicion, instruccion, comunicado o solicitud, aplicable a TODOS los destinatarios por igual; indicar plazo si corresponde.",
    ].join("\n"),
    courtesy:
      "Sin formulas de cortesia protocolares ni saludo inicial (es comunicacion interna dirigida a varias areas). Tono directo e imperativo-institucional. NO extender el cuerpo.",
    close:
      "NO escribas la despedida ('Atentamente,') ni la firma (nombre y cargo del remitente): se añaden automaticamente al exportar. Termina con el parrafo de la disposicion o, si corresponde, con la distribucion 'c.c.: ...'.",
  },
  "OFICIO MULTIPLE": {
    // Igual que OFICIO pero dirigido a VARIOS destinatarios por igual.
    structure: [
      "INTRODUCCION: formula protocolar de apertura en plural ('Tengo el agrado de dirigirme a ustedes...') enlazada con el motivo del documento.",
      "DESARROLLO: exposicion del tema, motivo o peticion, aplicable a TODOS los destinatarios por igual, citando la normativa aplicable cuando corresponda.",
      "CIERRE: formula protocolar de cierre en plural ('En espera de su atencion, me despido...').",
    ].join("\n"),
    courtesy:
      "Lenguaje protocolar institucional en plural. NO escribas el lugar/fecha, ni la numeracion, ni el bloque de destinatarios, ni las lineas ASUNTO/REF.: se añaden automaticamente al exportar.",
    close:
      "NO escribas la despedida ('Atentamente,') ni la firma: se añaden automaticamente al exportar. Termina con la formula protocolar de cierre.",
  },
  CONTRATO: {
    structure: [
      "TITULO: CONTRATO N° ... seguido de la denominacion del contrato (ej: CONTRATO DE PRESTACION DE SERVICIOS).",
      "PARTES: identificacion completa de las partes (denominacion, RUC/DNI, domicilio, representante) con la formula 'Conste por el presente documento...'.",
      "CLAUSULA PRIMERA - ANTECEDENTES: contexto y motivo del contrato.",
      "CLAUSULA SEGUNDA - OBJETO: prestacion o bien contratado, descrito con precision.",
      "CLAUSULAS SIGUIENTES (numeradas en ordinales): monto y forma de pago, plazo, obligaciones de las partes, penalidades, resolucion del contrato, solucion de controversias y domicilio.",
      "CIERRE: formula 'En senal de conformidad, las partes suscriben el presente documento...' con lugar, fecha y espacio para firmas de ambas partes.",
    ].join("\n"),
    courtesy:
      "Lenguaje juridico contractual, en tercera persona, sin formulas de cortesia epistolar. Las partes se denominan segun su rol (EL CONTRATANTE / EL CONTRATISTA, LA ENTIDAD / EL PROVEEDOR).",
    close: "Cierra con la clausula de conformidad y los espacios de firma de AMBAS partes (nombre, documento, cargo).",
  },
};

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    // Rate limit: evita abuso del endpoint mas caro del modulo
    // (gpt-4.1-mini + RAG + Pinecone + embeddings).
    const rl = checkRateLimit(
      getRateLimitKey(request, auth.user.id, "respuesta-generate"),
      RATE_LIMITS.aiSearch,
    );
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await request.json();
    const {
      intencion,
      tipoDocumento = "OFICIO",
      documentoTexto = "",
      remitente,
      destinatario,
      cargoDestinatario,
      oficinaId,
      asunto,
      tone = "formal",
      length = "media",
      selectedSources = [],
      normativaIds = [],
      adjuntosIds = [],
      antecedenteId,
      // El ANTECEDENTE de la respuesta es el PDF cargado en Responder
      // (documentoTexto/antecedenteId). La busqueda en la biblioteca de
      // expedientes archivados (pestaña Subir) es OPCIONAL y viene apagada.
      includeAntecedentes = false,
      entityName,
    } = body;

    const intent = typeof intencion === "string" ? intencion.trim() : "";
    if (intent.length < 10) {
      return NextResponse.json(
        { error: "Escribe que quieres responder (minimo 10 caracteres)." },
        { status: 400 },
      );
    }
    const tipo = isTipoDocumento(tipoDocumento) ? tipoDocumento : "OFICIO";
    let recibido = typeof documentoTexto === "string" ? documentoTexto : "";

    // ===== Contexto de la OFICINA EMISORA + feedback de redaccion =====
    // El documento se redacta con la voz del jefe/responsable de la oficina.
    // Ademas, los borradores que la oficina marco como CORRECTOS sirven de
    // ejemplo de estilo, y los INCORRECTOS (con comentario) como defectos
    // a evitar (aprendizaje continuo por oficina).
    let oficinaNombre = "";
    let responsableCargo = "";
    let ejemplosAprobados: string[] = [];
    let defectosEvitar: string[] = [];
    // Validar que la oficina pertenece al usuario (evita leer feedback ajeno).
    const scope = getArchivoScopeLevel(auth.user);
    const safeOficinaId = scope === "all" ? oficinaId
      : scope === "oficina" && typeof oficinaId === "string" && /^[0-9a-f-]{36}$/i.test(oficinaId) ? oficinaId
      : null;
    if (safeOficinaId && typeof safeOficinaId === "string" && /^[0-9a-f-]{36}$/i.test(safeOficinaId)) {
      try {
        const { supabaseRest } = await import("@/lib/supabase-server");
        const [ofiRows, likes, dislikes] = await Promise.all([
          supabaseRest<Array<{ nombre: string | null; responsable_cargo: string | null }>>(
            `expedientes_oficinas?id=eq.${safeOficinaId}&select=nombre,responsable_cargo&limit=1`,
          ).catch(() => []),
          supabaseRest<Array<{ cuerpo: string }>>(
            `respuesta_feedback?oficina_id=eq.${safeOficinaId}&rating=eq.like&tipo_documento=eq.${encodeURIComponent(tipo)}&select=cuerpo&order=created_at.desc&limit=2`,
          ).catch(() => []),
          supabaseRest<Array<{ comentario: string | null }>>(
            `respuesta_feedback?oficina_id=eq.${safeOficinaId}&rating=eq.dislike&comentario=not.is.null&select=comentario&order=created_at.desc&limit=5`,
          ).catch(() => []),
        ]);
        oficinaNombre = ofiRows[0]?.nombre ?? "";
        responsableCargo = ofiRows[0]?.responsable_cargo ?? "";
        ejemplosAprobados = likes.map((r) => r.cuerpo.slice(0, 1500));
        defectosEvitar = dislikes
          .map((r) => r.comentario?.trim() ?? "")
          .filter(Boolean)
          .slice(0, 5);
      } catch {
        // Sin contexto de oficina: se genera igual.
      }
    }

    // Si viene antecedenteId, recuperamos el texto completo desde Pinecone
    // (es la fuente de verdad despues de la indexacion). Esto reemplaza
    // o complementa al documentoTexto que pudo haber sido editado en UI.
    if (antecedenteId && typeof antecedenteId === "string") {
      try {
        const { supabaseRest } = await import("@/lib/supabase-server");
        // Validar ownership: el antecedente debe pertenecer al usuario o ser admin.
        const antRows = await supabaseRest<Array<{
          pinecone_document_id: string;
          pinecone_namespace: string;
          created_by: string | null;
        }>>(
          `respuesta_antecedentes?id=eq.${antecedenteId}&select=pinecone_document_id,pinecone_namespace,created_by&limit=1`,
        );
        const ref = antRows?.[0];
        if (ref) {
          if (!auth.user.isAdmin && ref.created_by !== auth.user.id) {
            return NextResponse.json(
              { error: "No tienes acceso a este antecedente." },
              { status: 403 },
            );
          }
          const doc = await fetchDocumentChunks(ref.pinecone_document_id, ref.pinecone_namespace, 200);
          if (doc?.text) {
            // Si el usuario edito el texto en el textarea, su version manda.
            // Si no edito nada, usamos el texto completo de Pinecone.
            recibido = recibido.trim().length > 20 ? recibido : doc.text;
          }
        }
      } catch (err) {
        // Si falla la recuperacion del antecedente, seguimos con el texto
        // del body. No bloqueamos la generacion.
        console.warn(
          `[respuesta.generate] No se pudo cargar antecedente ${antecedenteId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const openai = getOpenAIClient();

    // ===== 1) NORMATIVA SELECCIONADA (biblioteca) =====
    // El usuario eligio documentos especificos de la biblioteca.
    // Recuperamos el texto completo (todos los chunks) por documentId.
    const selectedIds: string[] = Array.isArray(normativaIds) ? normativaIds.filter((x) => typeof x === "string").slice(0, 20) : [];
    const selectedNorms: Array<{ title: string; text: string }> = [];
    for (const documentId of selectedIds) {
      try {
        const doc = await fetchDocumentChunks(documentId, "legal-documents", 100);
        if (doc && doc.text) {
          const title = typeof doc.metadata.title === "string" ? doc.metadata.title : documentId;
          selectedNorms.push({ text: doc.text.slice(0, 4000), title });
        }
      } catch {
        // Continua con el siguiente documento si uno falla.
      }
    }

    // ===== 2) NORMATIVA ADJUNTA DEL USUARIO =====
    // PDFs que el usuario subio para esta generacion (namespace respuesta-adjuntos).
    const adjuntosIdsList: string[] = Array.isArray(adjuntosIds) ? adjuntosIds.filter((x) => typeof x === "string").slice(0, 5) : [];
    const adjuntosDocs: Array<{ title: string; text: string }> = [];
    for (const documentId of adjuntosIdsList) {
      try {
        const doc = await fetchDocumentChunks(documentId, respuestaAdjuntosNamespace, 100);
        if (doc && doc.text) {
          const title = typeof doc.metadata.title === "string" ? doc.metadata.title : documentId;
          adjuntosDocs.push({ text: doc.text.slice(0, 4000), title });
        }
      } catch {
        // Continua con el siguiente adjunto si uno falla.
      }
    }

    // ===== 3) RAG AUTOMATICO (solo si no hay normativa seleccionada manualmente) =====
    // Si el usuario eligio documentos, no se hace RAG. Asi respetamos su eleccion.
    let autoSources: { assessment: unknown; sources: Array<{ citation?: string; documentTitle: string; documentNumber: string | null; excerpt: string }> } = {
      assessment: null,
      sources: [],
    };
    if (selectedNorms.length === 0) {
      try {
        const query = `${intent}. ${asunto ?? ""}. ${recibido.slice(0, 1200)}`.trim();
        autoSources = await searchLegalSources({ query, topK: 10 });
      } catch {
        autoSources = { assessment: null, sources: [] };
      }
    }

    // ===== 4) ANTECEDENTES DEL ARCHIVO MUNICIPAL =====
    type Antecedente = { expedienteId: string; title: string; serie: string | null; anio: number | null; ubicacion: string; excerpt: string };
    let antecedentes: Antecedente[] = [];
    if (includeAntecedentes) {
      try {
        // Mismo scope que la búsqueda: jefe su oficina; usuario normal solo lo suyo.
        const scope = getArchivoScopeLevel(auth.user);
        const hits = await searchExpedientes({
          query: `${intent} ${asunto ?? ""} ${recibido.slice(0, 600)}`.trim(),
          oficina: scope === "oficina" ? getOfficeFilter(auth.user) ?? undefined : undefined,
          uploadedBy: scope === "own" ? auth.user.id : undefined,
          topK: scope === "all" ? 4 : 24,
        });
        const seen = new Set<string>();
        antecedentes = hits
          .filter((h) => (seen.has(h.expedienteId) ? false : (seen.add(h.expedienteId), true)))
          .slice(0, 4)
          .map((h) => ({
            anio: h.anio,
            excerpt: h.excerpt.slice(0, 300),
            expedienteId: h.expedienteId,
            serie: h.serieDocumento,
            title: h.title,
            ubicacion: h.ubicacionResumen,
          }));
      } catch {
        antecedentes = [];
      }
    }

    // ===== 5) CONSTRUIR EL PROMPT POR TIPO =====
    const schema = documentSchemas[tipo] ?? documentSchemas.OFICIO;
    const tipoLabel = tipo.charAt(0) + tipo.slice(1).toLowerCase();
    const toneInstruction = toneLabels[tone] ?? toneLabels.formal;
    const lengthInstruction = lengthLabels[length] ?? lengthLabels.media;

    const selectedNormsBlock =
      selectedNorms.length > 0
        ? `\n\nNORMATIVA SELECCIONADA POR EL FUNCIONARIO (USAR COMO BASE PRINCIPAL):\n${selectedNorms
            .map((n) => `### ${n.title}\n${n.text}`)
            .join("\n\n")}`
        : "";

    const adjuntosBlock =
      adjuntosDocs.length > 0
        ? `\n\nDOCUMENTOS ADJUNTOS POR EL FUNCIONARIO (referencia adicional, no normativa):\n${adjuntosDocs
            .map((a) => `### ${a.title}\n${a.text}`)
            .join("\n\n")}`
        : "";

    const baseLegal =
      autoSources.sources.length > 0
        ? autoSources.sources
            .slice(0, 8)
            .map((s) =>
              `[${s.citation}] ${s.documentTitle}${s.documentNumber ? ` (${s.documentNumber})` : ""}: ${s.excerpt.slice(0, 400)}`,
            )
            .join("\n\n")
        : "";

    const autoLegalBlock =
      baseLegal.length > 0
        ? `\n\nNORMATIVA COMPLEMENTARIA ENCONTRADA POR RAG (usar solo si refuerza la seleccionada):\n${baseLegal}`
        : "";

    const selectedNormsBlockManual = selectedSources.length > 0
      ? `\n\nNORMATIVA SELECCIONADA POR EL USUARIO (referencias):\n${selectedSources.join("\n")}`
      : "";

    const antecedentesBlock = antecedentes.length > 0
      ? `\n\nEXPEDIENTES DE LA BIBLIOTECA (busqueda opcional en el archivo; son REFERENCIALES, no normativa; el antecedente principal es el DOCUMENTO RECIBIDO):\n${antecedentes
          .map(
            (a) =>
              `- ${a.title}${a.serie ? ` (${a.serie})` : ""}${a.anio ? `, ${a.anio}` : ""} - ${a.ubicacion}: ${a.excerpt}`,
          )
          .join("\n")}`
      : "";

    // Voz del emisor: jefe/responsable de la oficina que firma.
    const emisorDescripcion = [
      responsableCargo || "jefe(a) responsable",
      oficinaNombre ? `de la ${oficinaNombre}` : "de la oficina emisora",
      entityName ? `(${entityName})` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const systemPrompt = [
      `Eres el/la ${emisorDescripcion} y redactas el CUERPO de un ${tipoLabel} oficial que TU firmas, a partir de la INTENCION indicada. Escribes con autoridad y responsabilidad de jefe de oficina.`,
      "",
      `ESTRUCTURA OBLIGATORIA del ${tipoLabel} (siguiendo el esquema oficial peruano):`,
      schema.structure,
      "",
      schema.courtesy,
      "",
      schema.close,
      "",
      `Estilo de redaccion: ${toneInstruction}.`,
      `Extension: ${lengthInstruction}.`,
      "",
      "REGLAS DE FUNDAMENTACION:",
      "- Fundamenta SOLO en la normativa proporcionada abajo. NO inventes leyes ni articulos.",
      "- Si hay NORMATIVA SELECCIONADA por el funcionario, esa es la fuente principal; usala para construir el argumento.",
      "- Si hay NORMATIVA COMPLEMENTARIA de RAG, usala solo si refuerza la seleccionada.",
      "- Si hay DOCUMENTOS ADJUNTOS, son referencia adicional (no los cites como norma).",
      "- Si no hay suficiente sustento normativo, indicarlo explicitamente.",
      "- NO redactes el membrete, el numero, la fecha, la despedida ni la firma; tampoco el nombre ni el cargo del responsable de la oficina (remitente/emisor). Todo eso lo añade automaticamente el exportador: redacta SOLO el CUERPO.",
      "- No dejes marcadores de relleno tipo '[Nombre]', '[Cargo]' o lineas de firma en blanco.",
      // Voz del documento: quien firma es el/la responsable de la oficina, asi
      // que habla en primera persona. El CONTRATO es la excepcion (es un acto
      // bilateral entre partes y va en tercera persona).
      tipo === "CONTRATO"
        ? "- Usa tercera persona (las partes, la entidad) y lenguaje juridico contractual."
        : "- Redacta en PRIMERA PERSONA SINGULAR, con la voz del/de la responsable de la oficina emisora que firma el documento: 'me dirijo a usted', 'informo', 'comunico', 'dispongo', 'solicito', 'remito'. NO hables de la oficina o la entidad en tercera persona cuando es el emisor quien actua ('esta oficina informa' -> 'informo').",
      ...(ejemplosAprobados.length > 0
        ? [
            "",
            "EJEMPLOS DE REDACCION APROBADOS POR ESTA OFICINA (imita su estilo, estructura de parrafos y formulas; NO copies sus datos ni hechos):",
            ...ejemplosAprobados.map((e, i) => `--- EJEMPLO ${i + 1} ---\n${e}`),
          ]
        : []),
      ...(defectosEvitar.length > 0
        ? [
            "",
            "OBSERVACIONES DE REDACCION QUE ESTA OFICINA HA MARCADO COMO DEFECTOS (evitalos):",
            ...defectosEvitar.map((d) => `- ${d}`),
          ]
        : []),
    ].join("\n");

    const userMessage = [
      `TIPO DE DOCUMENTO: ${tipoLabel}`,
      "",
      `LO QUE EL FUNCIONARIO QUIERE RESPONDER (intencion - esto es lo que debes desarrollar):`,
      intent,
      "",
      `ASUNTO: ${asunto ?? "No especificado"}`,
      // El campo "Dirigido a" de la UI manda; si esta vacio, se responde al
      // remitente del documento recibido. La IA debe dirigir el saludo/vocativo
      // y el cuerpo a ESTA persona (clave en la CARTA).
      `DIRIGIDO A: ${
        [
          typeof destinatario === "string" && destinatario.trim() ? destinatario.trim() : null,
          typeof cargoDestinatario === "string" && cargoDestinatario.trim()
            ? cargoDestinatario.trim()
            : null,
        ]
          .filter(Boolean)
          .join(", ") ||
        remitente ||
        "No especificado"
      }`,
      "",
      recibido.trim()
        ? `DOCUMENTO RECIBIDO (es EL ANTECEDENTE de esta respuesta: el PDF que el usuario cargo; responde a su contenido):\n${recibido.slice(0, 10000)}`
        : "DOCUMENTO RECIBIDO: no se adjunto.",
      "",
      selectedNormsBlock,
      autoLegalBlock,
      selectedNormsBlockManual,
      adjuntosBlock,
      antecedentesBlock,
      "",
      `Redacta el CUERPO del ${tipoLabel} en espanol siguiendo EXACTAMENTE la estructura obligatoria indicada.`,
    ].join("\n");

    const temperature = tone === "tecnico" ? 0.2 : tone === "cercano" ? 0.5 : 0.3;
    const maxTokens = length === "concisa" ? 1500 : length === "detallada" ? 4000 : 3000;

    const response = await openai.responses.create({
      input: userMessage,
      instructions: systemPrompt,
      model,
      temperature,
      max_output_tokens: maxTokens,
    });

    // Acepta output_text (legacy) o output[0].content[0].text (nuevo formato).
    const respuestaTexto = extractResponseText(response);

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    const tokenUsage = {
      model,
      inputTokens,
      outputTokens,
      estimatedCostUsd: roundCostUsd(estimateCostUsd(model, inputTokens, outputTokens)),
    };

    await writeAuditLog({
      action: "respuesta.generate",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        adjuntosCount: adjuntosDocs.length,
        antecedentesCount: antecedentes.length,
        autoSourcesCount: autoSources.sources.length,
        selectedNormsCount: selectedNorms.length,
        selectedSourcesCount: selectedSources.length,
        tipoDocumento: tipo,
        tone,
        length,
        tokenUsage,
      },
      entityType: "respuesta",
      module: "expedientes-archivo",
    });

    // Mezcla fuentes: las manuales + las del RAG.
    const sourcesOutput = [
      ...selectedNorms.map((n) => ({
        citation: n.title,
        documentNumber: null,
        documentTitle: n.title,
        excerpt: n.text.slice(0, 300),
        source: "manual" as const,
      })),
      ...autoSources.sources.slice(0, 8).map((s) => ({
        citation: s.citation ?? s.documentTitle,
        documentNumber: s.documentNumber,
        documentTitle: s.documentTitle,
        excerpt: s.excerpt.slice(0, 300),
        source: "rag" as const,
      })),
    ];

    return NextResponse.json({
      respuesta: respuestaTexto,
      sources: sourcesOutput,
      antecedentes,
      assessment: autoSources.assessment,
      tokenUsage,
      schema: documentSchemas[tipo],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la respuesta" },
      { status: 500 },
    );
  }
}
