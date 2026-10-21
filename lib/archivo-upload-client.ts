/** Evita enviar archivos grandes a la función (límite de Vercel: 4,5 MB). */
export async function prepareArchivoUpload(form: FormData, request: typeof fetch = fetch): Promise<void> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 3 * 1024 * 1024) return;
  const response = await request("/api/expedientes-archivo/upload", {
    signal: AbortSignal.timeout(30_000),
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, type: file.type }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "No se pudo preparar la subida.");
  const upload = await fetch(payload.url, { signal: AbortSignal.timeout(180_000), method: "PUT", headers: { "Content-Type": "application/pdf" }, body: file });
  if (!upload.ok) throw new Error("No se pudo subir el PDF al almacenamiento. Intenta nuevamente.");
  form.delete("file");
  form.set("uploadTicket", payload.ticket);
}
