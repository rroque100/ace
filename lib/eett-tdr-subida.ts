import { verifyUploadTicket } from "./archivo-upload-ticket";
import { getSupabaseServerConfig } from "./supabase-server";
import { maxPdfSizeBytes } from "./upload-limits";

// Subida del EETT/TDR de una necesidad en dos pasos, sin pasar el fichero por
// la función.
//
// Por qué: Vercel corta cualquier petición a una función por encima de 4,5 MB
// con un `413 FUNCTION_PAYLOAD_TOO_LARGE` en texto plano, ANTES de que la ruta
// llegue a ejecutarse (Netlify hace lo mismo hacia los 6 MB). Un TDR con anexos
// o escaneado pasa de eso con facilidad, y el cliente, al no poder leer JSON,
// lo mostraba como «No se pudo conectar para subir el EETT/TDR». Ahora el
// navegador sube el fichero directo a Storage con una URL firmada y la ruta
// solo recibe una referencia firmada (HMAC) que apunta a ese objeto.

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Carpeta del bucket reservada a los EETT/TDR que sube un usuario. */
export function prefijoEettTdr(userId: string) {
  return `eett-tdr/${userId}/`;
}

/** Tipo del fichero por mime o, si el navegador no lo da (pasa con .docx), por extensión. */
export function tipoFicheroEett(name: string, mime: string): "pdf" | "docx" | null {
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (mime === DOCX_MIME || /\.docx$/i.test(name)) return "docx";
  return null;
}

export function mimeFicheroEett(tipo: "pdf" | "docx") {
  return tipo === "pdf" ? "application/pdf" : DOCX_MIME;
}

export class SubidaEettError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Recupera de Storage el fichero que el navegador subió con la URL firmada. El
 * objeto se queda donde está: es ya el fichero definitivo del documento.
 */
export async function leerFicheroSubidoEett(
  ticket: string,
  userId: string,
): Promise<{ file: File; storagePath: string }> {
  const { storageBucket, serviceRoleKey, supabaseUrl } = getSupabaseServerConfig();
  let data;
  try {
    data = verifyUploadTicket(ticket, userId, serviceRoleKey, prefijoEettTdr(userId));
  } catch {
    throw new SubidaEettError("La referencia del archivo venció o no está autorizada. Vuelve a subirlo.", 400);
  }
  const tipo = tipoFicheroEett(data.name, "");
  if (!tipo) throw new SubidaEettError("Solo se permiten archivos PDF o Word (.docx).", 400);

  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${storageBucket}/${encodeURI(data.path)}`,
    { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }, cache: "no-store" },
  );
  if (response.status === 400 || response.status === 404) {
    throw new SubidaEettError("El archivo no llegó al almacenamiento. Vuelve a subirlo.", 400);
  }
  if (!response.ok || !response.body) {
    throw new SubidaEettError("No se pudo recuperar el archivo subido. Intenta nuevamente.", 503);
  }
  // Lectura por trozos con tope: la URL firmada no fija el tamaño, así que se
  // comprueba aquí contra el que se autorizó al firmar.
  const reader = response.body.getReader();
  const partes: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > data.size || size > maxPdfSizeBytes) {
        throw new SubidaEettError("El archivo supera el tamaño autorizado.", 400);
      }
      partes.push(new Uint8Array(value));
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  if (size !== data.size) {
    throw new SubidaEettError("El tamaño del archivo no coincide con la subida autorizada.", 400);
  }
  return { file: new File(partes, data.name, { type: mimeFicheroEett(tipo) }), storagePath: data.path };
}
