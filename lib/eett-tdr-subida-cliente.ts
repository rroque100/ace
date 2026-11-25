// Lado navegador de la subida del EETT/TDR (ver lib/eett-tdr-subida.ts): pide
// una URL firmada, sube el fichero directo a Storage y registra el documento
// mandando solo la referencia. Así el fichero nunca cruza la función, que en
// Vercel rechaza cuerpos de más de 4,5 MB.

export type EettSubido = {
  document: { id: string; tipo: "eett" | "tdr"; file_name: string };
  text?: string;
  pageCount?: number;
};

/**
 * Lee el JSON de una respuesta sin confundir sus fallos con uno de red. La
 * plataforma responde en texto plano cuando corta la petición (413 por tamaño,
 * 504 por tiempo); tratar eso como «no se pudo conectar» mandaba al usuario a
 * revisar su conexión cuando el problema era el archivo.
 */
export async function leerRespuesta(res: Response, porDefecto: string): Promise<Record<string, unknown>> {
  const data = await res.json().catch(() => null);
  if (res.ok && data) return data as Record<string, unknown>;
  if (data && typeof data.error === "string" && data.error) throw new Error(data.error);
  if (res.status === 413) throw new Error("El archivo es demasiado grande para enviarlo al servidor.");
  if (res.status === 504) {
    throw new Error("El servidor tardó demasiado en leer el archivo. Si es un escaneo largo, prueba con un PDF con texto o un .docx.");
  }
  throw new Error(`${porDefecto} (error ${res.status}).`);
}

export async function subirEettTdr(
  necesidadId: string,
  file: File,
  tipo: "eett" | "tdr",
): Promise<EettSubido> {
  const base = `/api/necesidades/${necesidadId}/eett-tdr`;

  const preparada = await leerRespuesta(
    await fetch(`${base}/subida`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size, type: file.type }),
    }),
    "No se pudo preparar la subida del EETT/TDR",
  );

  // Un fallo aquí sí es de conexión o del almacenamiento, no del servidor de la app.
  const subida = await fetch(String(preparada.url), {
    method: "PUT",
    // Windows a veces no informa el mime de un .docx; se deduce de la extensión
    // para que el bucket no lo guarde como binario genérico.
    headers: {
      "Content-Type":
        file.type ||
        (/\.docx$/i.test(file.name)
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/pdf"),
    },
    body: file,
  });
  if (!subida.ok) {
    const detalle = await subida.text().catch(() => "");
    // El bucket filtra por mime; hasta que se aplica
    // docs/supabase/2026-11-25-bucket-documents-docx.sql solo admite PDF.
    if (/invalid_mime_type/i.test(detalle)) {
      throw new Error("El almacenamiento aún no admite este tipo de archivo. Súbelo en PDF.");
    }
    throw new Error("No se pudo subir el archivo al almacenamiento. Intenta nuevamente.");
  }

  const fd = new FormData();
  fd.append("uploadTicket", String(preparada.ticket));
  fd.append("tipo", tipo);
  const registrado = await leerRespuesta(
    await fetch(base, { method: "POST", body: fd }),
    "No se pudo registrar el EETT/TDR",
  );
  return registrado as unknown as EettSubido;
}
