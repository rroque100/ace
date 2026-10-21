import { deleteStorageObjects, getSupabaseServerConfig } from "./supabase-server";
import { verifyUploadTicket } from "./archivo-upload-ticket";
import { maxPdfSizeBytes } from "./upload-limits";
import { PdfReadError } from "./pdf-read-error";

export async function readArchivoFile(form: FormData, userId: string): Promise<File> {
  let file = form.get("file");
  if (!(file instanceof File)) {
    const ticket = form.get("uploadTicket");
    if (typeof ticket !== "string") throw new PdfReadError("Debes adjuntar un PDF.", 400, false);
    const { storageBucket, serviceRoleKey, supabaseUrl } = getSupabaseServerConfig();
    let data;
    try { data = verifyUploadTicket(ticket, userId, serviceRoleKey); }
    catch { throw new PdfReadError("La referencia del PDF venció o no está autorizada. Vuelve a subirlo.", 400, false); }
    try {
      const response = await fetch(`${supabaseUrl}/storage/v1/object/${storageBucket}/${data.path}`, {
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }, cache: "no-store",
      });
      if (!response.ok || !response.body) throw new PdfReadError("No se pudo recuperar el PDF subido. Intenta nuevamente.", 503, true);
      const reader = response.body.getReader();
      const parts: Uint8Array<ArrayBuffer>[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > data.size || size > maxPdfSizeBytes) throw new PdfReadError("El PDF supera el tamaño autorizado.", 400, false);
          parts.push(new Uint8Array(value));
        }
      } finally { await reader.cancel(); }
      if (size !== data.size) throw new PdfReadError("El tamaño del PDF no coincide con la subida autorizada.", 400, false);
      file = new File(parts, data.name, { type: "application/pdf" });
    } finally {
      await deleteStorageObjects(storageBucket, [data.path]).catch((error) => console.error("[archivo] limpieza temporal", error));
    }
  }
  if (!(file instanceof File) || file.type !== "application/pdf" || !file.size || file.size > maxPdfSizeBytes) throw new PdfReadError("Adjunta un PDF válido de hasta 100 MB.", 400, false);
  const header = new TextDecoder().decode(await file.slice(0, 1024).arrayBuffer());
  if (!header.includes("%PDF-")) throw new PdfReadError("El archivo no contiene una cabecera PDF válida.", 422, false);
  return file;
}
