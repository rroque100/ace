// Archiva en el expediente el formato que se acaba de generar.
//
// ── El problema que resuelve ──────────────────────────────────────────────────
//
// Los formatos de la Fase 1 (Formato de Estrategia, Anexo N° 1, informe de
// segmentación, memorándum de designación…) se generaban, se descargaban al
// ordenador y ahí acababa su relación con la aplicación. El expediente se
// quedaba con cero documentos, así que la sección "Instrucción del expediente"
// marcaba 0% para siempre y el usuario aprendía a ignorarla —peor que no
// tenerla—. Y el Art. 54 enumera lo que el expediente CONTIENE: un formato que
// solo existe en la carpeta de Descargas de alguien no está en el expediente.
//
// Ahora, además de descargarse, queda archivado. Es el mismo acto: generar el
// formato ES incorporarlo.
//
// ── Por qué no bloquea ────────────────────────────────────────────────────────
//
// Si el archivado falla —Storage caído, la tabla con otra forma—, la descarga
// sigue. Quitarle al usuario su documento porque no se pudo guardar una copia
// sería cambiar un problema pequeño por uno grande: el formato es lo que venía a
// buscar. El fallo se traga y se puede volver a intentar exportando otra vez.
//
// ── Por qué reemplaza en vez de acumular ──────────────────────────────────────
//
// Un formato se re-exporta muchas veces mientras se corrige. Guardar cada
// intento llenaría el expediente de versiones del mismo documento y la lista
// dejaría de leerse. Se guarda el ÚLTIMO de cada formato: el expediente refleja
// lo vigente, que es lo que se folia.

import { randomUUID } from "node:crypto";
import type { ProcessDocument } from "./processes";
import {
  getSupabaseServerConfig,
  supabaseUserRest,
  uploadStorageObject,
  writeAuditLog,
} from "./supabase-server";

/** Formato exportable y el tipo de documento con el que entra al expediente. */
export type FormatoArchivable = {
  /** Título con el que aparece en la lista de documentos. */
  titulo: string;
  /** `process_documents.kind`: es lo que lee la Instrucción para dar por cumplida una etapa. */
  kind: string;
  /** Paso que lo genera, para poder rastrear de dónde salió. */
  paso: string;
};

function nombreSeguro(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]+/g, "-")
    .slice(0, 80);
}

/**
 * Guarda el archivo en Storage y lo registra como documento del expediente.
 *
 * Devuelve el documento creado, o null si algo falló. Nunca lanza: quien la
 * llama está a punto de devolverle un archivo al usuario y ese archivo tiene
 * que llegar pase lo que pase.
 */
export async function archivarFormato(input: {
  accessToken: string;
  processId: string;
  ownerId: string;
  actorReference: string;
  formato: FormatoArchivable;
  fileName: string;
  mimeType: string;
  contenido: ArrayBuffer | Uint8Array;
}): Promise<ProcessDocument | null> {
  try {
    const ruta = `expedientes/${input.processId}/formatos/${randomUUID()}-${nombreSeguro(input.fileName)}`;
    await uploadStorageObject(ruta, input.contenido, input.mimeType);

    // Fuera la versión anterior del MISMO formato en ESTE expediente. Se filtra
    // por el paso y no solo por el `kind`: varios pasos pueden producir
    // documentos del mismo tipo (A6 genera tres "otros"), y borrar por kind se
    // llevaría por delante los de los otros pasos.
    await supabaseUserRest(
      input.accessToken,
      `process_documents?process_id=eq.${input.processId}` +
        `&metadata->>formatoPaso=eq.${encodeURIComponent(input.formato.paso)}` +
        `&metadata->>formatoTitulo=eq.${encodeURIComponent(input.formato.titulo)}`,
      { method: "DELETE" },
    ).catch(() => undefined);

    const [documento] = await supabaseUserRest<ProcessDocument[]>(
      input.accessToken,
      "process_documents",
      {
        body: JSON.stringify({
          file_name: input.fileName,
          kind: input.formato.kind,
          metadata: {
            // Generado por la aplicación, no subido por una persona: la lista de
            // documentos lo distingue y el reemplazo lo localiza por aquí.
            generadoPorAce: true,
            formatoPaso: input.formato.paso,
            formatoTitulo: input.formato.titulo,
          },
          mime_type: input.mimeType,
          owner_id: input.ownerId,
          process_id: input.processId,
          // "ready" y no "processing": no hay texto que extraer de un .xlsx o un
          // .docx generado, y dejarlo en "processing" lo enseñaría eternamente
          // como pendiente de procesar.
          status: "ready",
          storage_bucket: getSupabaseServerConfig().storageBucket,
          storage_path: ruta,
          title: input.formato.titulo,
        }),
        method: "POST",
      },
    );

    await writeAuditLog({
      action: "process.document.formato_archivado",
      actorReference: input.actorReference,
      details: { paso: input.formato.paso, titulo: input.formato.titulo, processId: input.processId },
      entityId: documento?.id ?? input.processId,
      entityType: "process_document",
    }).catch(() => undefined);

    // A propósito NO se llama a `reconcileProcessStatus`, que sí dispara la
    // subida manual de documentos. Un formato recién generado es un BORRADOR: el
    // Anexo N° 2 se exporta para llevarlo a firmar, no porque el expediente esté
    // aprobado. Avanzar el ciclo al exportarlo daría por aprobado algo que nadie
    // ha firmado todavía, y el estado solo se mueve hacia adelante.
    return documento ?? null;
  } catch {
    // La descarga sigue: el formato es lo que el usuario venía a buscar.
    return null;
  }
}

// ─── Catálogo: qué formato entra al expediente con qué tipo ─────────────────
//
// El `kind` importa porque es lo que la Instrucción cruza contra los documentos
// que cada etapa exige. Elegirlo mal produce un FALSO POSITIVO: una etapa que se
// da por foliada sin estarlo, que es peor que el 0% de partida.
//
// Por eso el checklist de bases entra como "otros" y no como "bases": es una
// lista de comprobación, no las bases del procedimiento, y marcaría como
// cumplido un requisito obligatorio de la etapa de Selección.
//
// La clave es la del catálogo `EXPORT_FORMATO` del panel de fases: `paso|path`.
export const FORMATOS_ARCHIVABLES: Record<string, FormatoArchivable> = {
  // Informe del Art. 42: clasifica las contrataciones del PAC.
  "A2|segmentacion": { kind: "informe", paso: "A2", titulo: "Informe de Segmentación de Contrataciones" },
  // Formato de la estrategia (Art. 46).
  "A4|estrategia": { kind: "informe", paso: "A4", titulo: "Formato de Estrategia de Contratación" },
  // Anexo N° 1: el informe de mercado del Art. 47. El título lleva "mercado"
  // porque la etapa lo busca por palabra clave.
  "A5|anexo1": { kind: "informe", paso: "A5", titulo: "Anexo N° 1 — Interacción con el mercado" },
  // Designación de evaluadores (Arts. 56-60): tres documentos distintos.
  "A6|memo": { kind: "otros", paso: "A6", titulo: "Memorándum de designación de evaluadores" },
  "A6|jurada": { kind: "otros", paso: "A6", titulo: "Declaración jurada de no conflicto de intereses" },
  "A6|consentimiento": { kind: "otros", paso: "A6", titulo: "Consentimiento de datos personales" },
  // Es la SOLICITUD de certificación, no la CCP: no acredita nada por sí sola.
  "A7|certificacion": { kind: "otros", paso: "A7", titulo: "Solicitud de Certificación Presupuestal" },
  // El informe con el que la DEC PIDE la aprobación (Art. 54.2). No es el acto
  // aprobatorio —ese es el Anexo N° 2—, así que entra como "informe" y no como
  // "acta": darlo por aprobación sería dar por cerrada una etapa que sigue
  // esperando la firma de la AGA.
  "A8|informe_aprobacion": {
    kind: "informe",
    paso: "A8",
    titulo: "Informe de solicitud de aprobación del expediente",
  },
  // Anexo N° 2: el acto de aprobación del expediente (Art. 54). El título lleva
  // "aprobación" porque la etapa de AGA lo busca por esa palabra.
  "A8|anexo2": { kind: "acta", paso: "A8", titulo: "Anexo N° 2 — Aprobación del expediente" },
  // Lista de comprobación, NO las bases. Ver la nota de arriba.
  "A9|bases_checklist": { kind: "otros", paso: "A9", titulo: "Checklist de elaboración de Bases" },
  "A10|anuncio": { kind: "otros", paso: "A10", titulo: "Anuncio de Contratación Futura" },
  // No sale de un paso, sino del expediente entero: de ahí la clave "EXP".
  // Entra como "otros" porque es la PORTADA del legajo, no el "expediente de
  // contratación consolidado" del Art. 54; darlo por cumplido con una portada
  // sería mentir sobre lo que el expediente contiene.
  "EXP|caratula": { kind: "otros", paso: "EXP", titulo: "Carátula del expediente de contratación" },
};

export const MIME_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
