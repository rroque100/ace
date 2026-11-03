// Por qué falló una vía de recuperación, dicho de forma que el usuario y el administrador puedan actuar.
//
// La búsqueda corre dos vías a la vez (semántica: embedding + Pinecone; léxica: SQL) y, si una cae, sigue con la otra. Antes el
// error se tragaba y el aviso decía solo «una de las vías no estuvo disponible»: sin crédito en el proveedor de embeddings,
// por ejemplo, la búsqueda semántica estuvo caída semanas y nadie supo por qué. Aquí se clasifica el error SIN exponer el
// texto del proveedor (puede traer rutas, identificadores o detalles de facturación); el detalle crudo va solo al log del
// servidor.

export type ViaRecuperacion = "semantic" | "lexical";

export type CausaFalloRecuperacion =
  | "sin_credito"
  | "cuota_usuario"
  | "clave"
  | "limite_peticiones"
  | "indice_vectorial"
  | "base_de_datos"
  | "red"
  | "desconocida";

export type FalloRecuperacion = { causa: CausaFalloRecuperacion; motivo: string };

const MOTIVOS: Record<CausaFalloRecuperacion, string> = {
  sin_credito: "el proveedor de embeddings no tiene crédito",
  cuota_usuario: "se agotó la cuota mensual de uso de IA",
  clave: "falta o no es válida la clave del proveedor de embeddings",
  limite_peticiones: "el proveedor limitó temporalmente las peticiones",
  indice_vectorial: "el índice vectorial (Pinecone) no respondió",
  base_de_datos: "la base de datos no respondió",
  red: "hubo un fallo de red o de tiempo de espera",
  desconocida: "no se pudo identificar la causa",
};

const VIAS: Record<ViaRecuperacion, string> = {
  semantic: "la búsqueda por significado",
  lexical: "la búsqueda por palabras",
};

function estadoDe(error: unknown): number | undefined {
  if (error && typeof error === "object") {
    const estado = (error as { status?: unknown }).status;
    if (typeof estado === "number") return estado;
  }
  const coincidencia = /\b(?:embeddings|search|index|REST(?:\(user\))?)\s+(\d{3})\b/i.exec(error instanceof Error ? error.message : "");
  return coincidencia ? Number(coincidencia[1]) : undefined;
}

/** Clasifica el error de una vía. Solo lee el mensaje, el `status` y el `code` del error: no hace red. */
export function clasificarFalloRecuperacion(error: unknown): FalloRecuperacion {
  const mensaje = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const nombre = error instanceof Error ? error.name : "";
  const codigo = error && typeof error === "object" ? String((error as { code?: unknown }).code ?? "") : "";
  const estado = estadoDe(error);
  const texto = `${mensaje} ${codigo}`;
  const causa = ((): CausaFalloRecuperacion => {
    if (nombre === "CuotaIAAgotadaError") return "cuota_usuario";
    // Crédito agotado: Google responde 402 / RESOURCE_EXHAUSTED «prepayment credits are depleted»; OpenAI, 429
    // `insufficient_quota` / `credit_balance_exhausted`. Se distingue del 429 de límite de ritmo, que sí se recupera solo.
    if (estado === 402 || /insufficient_quota|credit_balance_exhausted|credits? (?:are )?(?:depleted|remaining)|no credits|prepayment|billing/i.test(texto)) return "sin_credito";
    // Pinecone y Supabase van antes que «clave»: un 401/403 de su API es de SU clave, no la de embeddings.
    if (/pinecone/i.test(texto) && estado !== 429) return "indice_vectorial";
    if (/supabase|postgrest|document_chunks/i.test(texto) && estado !== 429) return "base_de_datos";
    if (/Falta\s+(?:GOOGLE|OPENAI)[A-Z_]*API_KEY|api key|apikey|invalid[_ ]api[_ ]key|incorrect api key/i.test(texto) || estado === 401 || estado === 403) return "clave";
    if (estado === 429 || /rate.?limit|too many requests/i.test(texto)) return "limite_peticiones";
    if (nombre === "AbortError" || nombre === "TimeoutError" || /fetch failed|ECONN|ETIMEDOUT|ENOTFOUND|timeout|timed out|network/i.test(texto)) return "red";
    return "desconocida";
  })();
  return { causa, motivo: MOTIVOS[causa] };
}

export type FallosRecuperacion = Partial<Record<ViaRecuperacion, FalloRecuperacion>>;

/**
 * Advertencia de «recuperación parcial» que nombra la vía caída y su causa. Empieza por «Recuperación parcial», que es lo
 * que `materialWarnings` (lib/chat-signals.ts) reconoce para mostrarla en la tarjeta de la respuesta.
 */
export function advertenciaRecuperacionParcial(fallos: FallosRecuperacion): string {
  const caidas = (Object.keys(VIAS) as ViaRecuperacion[]).filter((via) => fallos[via]);
  if (caidas.length === 0) return "Recuperación parcial: una de las vías de búsqueda no estuvo disponible. Los resultados pueden ser incompletos.";
  const detalle = caidas.map((via) => `${VIAS[via]} no estuvo disponible (${fallos[via]!.motivo})`).join("; ");
  const respaldo = caidas.length === 1 ? ` Se usó solo ${caidas[0] === "semantic" ? VIAS.lexical : VIAS.semantic}.` : "";
  return `Recuperación parcial: ${detalle}.${respaldo} Los resultados pueden ser incompletos.`;
}

/** Texto para el log del servidor: la causa y un extracto del error, sin el cuerpo completo de la respuesta del proveedor. */
export function detalleParaLog(via: ViaRecuperacion, error: unknown): string {
  const fallo = clasificarFalloRecuperacion(error);
  const mensaje = error instanceof Error ? error.message : String(error);
  return `[recuperacion] vía ${via} caída: ${fallo.causa} · ${mensaje.replace(/\s+/g, " ").slice(0, 200)}`;
}
