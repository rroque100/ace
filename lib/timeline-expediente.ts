// Línea de tiempo del expediente: qué pasó, cuándo y quién lo hizo.
//
// ── Qué había antes ───────────────────────────────────────────────────────────
//
// Dos fuentes: la fecha de creación y una línea por documento cargado. En un
// expediente sin documentos eso deja UNA entrada —"Expediente creado"— con una
// fecha que ya sale en la cabecera. Un panel entero de la barra lateral para
// repetir un dato.
//
// Mientras tanto el rastro real estaba guardado y sin usar: `audit_logs` tiene
// once entradas de este expediente con fecha y autor, y el jsonb `hitos` guarda
// cuándo se completó cada paso. Eso es lo que responde "¿quién aprobó esto y en
// qué fecha?", que es la pregunta que trae a alguien a mirar una línea de tiempo.
//
// ── Por qué las etiquetas se traducen aquí ────────────────────────────────────
//
// `audit_logs.action` guarda claves técnicas ("process.hito.update"). Enseñarlas
// en crudo convierte la línea de tiempo en un log de servidor. La traducción es
// código puro y testeable, y lo que no se sabe traducir se OMITE en vez de
// pintarse crudo: una entrada que el usuario no entiende no informa, estorba.

/** Fila de `audit_logs` que interesa a la línea de tiempo. */
export type EventoAuditoria = {
  action: string;
  actor_reference: string | null;
  created_at: string;
  details: Record<string, unknown> | null;
};

export type EntradaTimeline = {
  at: string;
  label: string;
  /** Quién lo hizo, cuando se sabe. */
  actor?: string;
  /** Familia del evento: la interfaz elige el icono con esto. */
  tipo: "creacion" | "paso" | "documento" | "estado" | "analisis";
};

/**
 * Acciones que se traducen. El resto se omite.
 *
 * `process.hito.update` NO está: se dispara en cada autoguardado —diez veces en
 * este expediente, todas del mismo puñado de pasos— y llenaría la línea de
 * tiempo de ruido. Los pasos entran por su `doneAt`, que marca cuándo se
 * COMPLETARON, que es el hecho que importa.
 */
const ETIQUETA_ACCION: Record<string, { texto: string; tipo: EntradaTimeline["tipo"] }> = {
  "necesidad.derivar": { texto: "Expediente derivado de la necesidad", tipo: "creacion" },
  "process.create": { texto: "Expediente creado", tipo: "creacion" },
  "process.document.upload": { texto: "Documento cargado", tipo: "documento" },
  "process.document.link_library": { texto: "Documento vinculado de la biblioteca", tipo: "documento" },
  "process.document.formato_archivado": { texto: "Formato generado y archivado", tipo: "documento" },
  "process.evaluate_offer": { texto: "Oferta evaluada", tipo: "analisis" },
  "process.detect_risks": { texto: "Riesgos analizados", tipo: "analisis" },
  "fase1.cronograma_listo": { texto: "Segmentación completada: cronograma listo", tipo: "paso" },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Autor del evento, solo si identifica a alguien.
 *
 * Algunos registros guardan el id del usuario en vez de su correo (así llega
 * `process.detect_risks`). Un UUID no identifica a nadie que lea la pantalla:
 * ocupa una línea entera y no responde "¿quién hizo esto?". Mejor sin autor que
 * con uno ilegible.
 */
function actorLegible(referencia: string | null): string | undefined {
  const v = (referencia ?? "").trim();
  if (!v || v === "system" || UUID.test(v)) return undefined;
  return v;
}

function detalle(evento: EventoAuditoria, campo: string): string {
  const v = evento.details?.[campo];
  return typeof v === "string" ? v.trim() : "";
}

/** Eventos de auditoría traducidos. Los no reconocidos se descartan. */
export function entradasDeAuditoria(eventos: EventoAuditoria[]): EntradaTimeline[] {
  const out: EntradaTimeline[] = [];
  for (const evento of eventos) {
    const meta = ETIQUETA_ACCION[evento.action];
    if (!meta) continue;
    // Un detalle que precise el hecho: el título del formato archivado, el
    // código de la necesidad de origen. Sin él la línea dice "qué" pero no "cuál".
    const precision = detalle(evento, "titulo") || detalle(evento, "necesidad") || detalle(evento, "kind");
    out.push({
      actor: actorLegible(evento.actor_reference),
      at: evento.created_at,
      label: precision ? `${meta.texto}: ${precision}` : meta.texto,
      tipo: meta.tipo,
    });
  }
  return out;
}

export type HitoConFecha = {
  status?: string;
  doneAt?: string | null;
  responsible?: string | null;
};

/**
 * Pasos COMPLETADOS, con la fecha en que se cerraron.
 *
 * Solo los que tienen `doneAt`: un paso en curso no es un hecho de la historia
 * del expediente, es trabajo a medias. Y los marcados "no aplica" tampoco entran
 * —no ocurrió nada— aunque el modelo les ponga fecha.
 */
export function entradasDePasos(
  hitos: Record<string, HitoConFecha> | null | undefined,
  etiquetaDePaso: (code: string) => string,
): EntradaTimeline[] {
  const out: EntradaTimeline[] = [];
  for (const [code, hito] of Object.entries(hitos ?? {})) {
    if (hito?.status !== "hecho" || !hito.doneAt) continue;
    out.push({
      actor: actorLegible(hito.responsible ?? null),
      at: hito.doneAt,
      label: `${code} · ${etiquetaDePaso(code)} completado`,
      tipo: "paso",
    });
  }
  return out;
}

/**
 * Une y ordena las entradas, de la más reciente a la más antigua.
 *
 * Al revés que antes, que iba de la más antigua a la más nueva. Con dos entradas
 * daba igual; con veinte, lo último que pasó es lo que se busca al abrir el
 * panel y quedaba al final, fuera de la vista.
 *
 * Se descartan los duplicados. Son de dos clases:
 *
 *   · El mismo texto en el mismo minuto, que es el mismo hecho contado dos veces.
 *   · La CREACIÓN, que llega por `created_at` como "Expediente creado" y por el
 *     registro como "Expediente derivado de la necesidad: REQ-2026-0018". Son el
 *     mismo acto con distinto texto, así que se queda el más informativo —el que
 *     dice de qué necesidad salió— en vez de enseñar dos líneas seguidas.
 */
export function unirTimeline(...grupos: EntradaTimeline[][]): EntradaTimeline[] {
  const todas = grupos.flat().filter((e) => e.at);

  // Clave por hecho: para la creación basta el minuto, porque el texto difiere.
  const clave = (e: EntradaTimeline) =>
    e.tipo === "creacion" ? `creacion|${e.at.slice(0, 16)}` : `${e.label}|${e.at.slice(0, 16)}`;

  const porClave = new Map<string, EntradaTimeline>();
  for (const e of todas) {
    const k = clave(e);
    const previa = porClave.get(k);
    // Gana la etiqueta más larga: es la que trae el detalle (de qué necesidad).
    if (!previa || e.label.length > previa.label.length) porClave.set(k, e);
  }

  return [...porClave.values()].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
