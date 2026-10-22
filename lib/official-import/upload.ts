/** Subida TUS por bloques de 6 MiB para PDF grandes; sin sobrescribir objetos. */
export async function uploadLargeOfficialPdf(input: { supabaseUrl: string; serviceRoleKey: string; bucket: string; objectPath: string; bytes: Buffer }) {
  const base = new URL(input.supabaseUrl);
  if (!/^[a-z0-9]+\.supabase\.co$/.test(base.hostname) || base.protocol !== "https:") throw new Error("Destino de almacenamiento inválido");
  base.hostname = base.hostname.replace(".supabase.co", ".storage.supabase.co");
  const endpoint = new URL("/storage/v1/upload/resumable", base);
  const headers = { Authorization: `Bearer ${input.serviceRoleKey}`, apikey: input.serviceRoleKey, "Tus-Resumable": "1.0.0" };
  const metadata = Object.entries({ bucketName: input.bucket, objectName: input.objectPath, contentType: "application/pdf", cacheControl: "3600" })
    .map(([key,value]) => `${key} ${Buffer.from(value).toString("base64")}`).join(",");
  const created = await fetch(endpoint, {method:"POST", redirect:"error", signal:AbortSignal.timeout(45000), headers:{...headers,"Upload-Length":String(input.bytes.length),"Upload-Metadata":metadata}});
  if (created.status !== 201) throw new Error(`Creación TUS HTTP ${created.status}`);
  const location = created.headers.get("location");
  if (!location) throw new Error("TUS sin ubicación");
  const target = new URL(location, endpoint);
  if (target.origin !== endpoint.origin || !target.pathname.startsWith("/storage/v1/upload/resumable/")) throw new Error("Ubicación TUS no autorizada");
  const block = 6 * 1024 * 1024;
  let offset = 0;
  while (offset < input.bytes.length) {
    const end = Math.min(offset + block, input.bytes.length);
    const response = await fetch(target, {method:"PATCH", redirect:"error", signal:AbortSignal.timeout(60000), headers:{...headers,"Upload-Offset":String(offset),"Content-Type":"application/offset+octet-stream"},body:Uint8Array.from(input.bytes.subarray(offset,end))});
    if (response.status !== 204 || Number(response.headers.get("upload-offset")) !== end) throw new Error(`Bloque TUS incompleto: HTTP ${response.status}`);
    offset = end;
  }
}
