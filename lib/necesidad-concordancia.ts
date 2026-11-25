import { adjuntoFuenteMatriz } from "./matriz-riesgos";
import { OBJETOS_POR_PROCEDIMIENTO, type ObjetoFilter } from "./procesos-seleccion";

export type AdjuntoConcordancia = {
  id: string;
  file_name: string;
  title?: string | null;
  metadata?: { textoExtraido?: string } | null;
};

type FichaConcordancia = {
  tipo_objeto?: string | null;
  tipo_proceso_seleccion?: string | null;
  cui?: string | null;
  plazo_ejecucion?: number | string | null;
  plazo_ejecucion_unidad?: string | null;
  gestion_riesgos?: string | null;
};

type AjusteFicha = Partial<Record<"tipoObjeto" | "cui" | "plazoEjecucion" | "plazoEjecucionUnidad", string>>;
export type HallazgoConcordancia = { mensaje: string; bloquea: boolean; ajuste?: AjusteFicha };

function unico(valores: string[]): string | undefined {
  return new Set(valores).size === 1 ? valores[0] : undefined;
}

export function verificarConcordanciaFicha(
  ficha: FichaConcordancia,
  adjuntos: readonly AdjuntoConcordancia[],
): HallazgoConcordancia[] {
  const hallazgos: HallazgoConcordancia[] = [];
  const objetos: readonly ObjetoFilter[] = OBJETOS_POR_PROCEDIMIENTO[ficha.tipo_proceso_seleccion ?? ""] ?? [];
  if (objetos.length && !objetos.some((objeto) => objeto === ficha.tipo_objeto)) {
    hallazgos.push({
      mensaje: `El objeto registrado (${ficha.tipo_objeto || "sin definir"}) no coincide con el procedimiento elegido. Objetos permitidos: ${objetos.join(", ")}.`,
      bloquea: true,
      ajuste: objetos.length === 1 ? { tipoObjeto: objetos[0] } : undefined,
    });
  }

  const origen = adjuntoFuenteMatriz(ficha.gestion_riesgos ?? "");
  const adjunto = origen ? adjuntos.find((doc) => doc.id === origen) : adjuntos.length === 1 ? adjuntos[0] : undefined;
  if (origen && !adjunto) {
    hallazgos.push({ mensaje: "El adjunto de origen de la matriz ya no está disponible. Revisa y genera una matriz con el archivo vigente.", bloquea: true });
  } else if (ficha.gestion_riesgos?.trim() && !origen) {
    hallazgos.push({ mensaje: "La matriz guardada no identifica el adjunto de origen. Regenera y aplica la propuesta para incorporar su trazabilidad.", bloquea: false });
  }
  if (!origen && adjuntos.length > 1) {
    hallazgos.push({ mensaje: "Hay varios adjuntos. Selecciona el archivo de referencia al generar la matriz para cotejar sus datos con la ficha.", bloquea: false });
  }

  const texto = adjunto?.metadata?.textoExtraido?.trim();
  if (adjunto && !texto) {
    hallazgos.push({ mensaje: `El archivo «${adjunto.file_name}» todavía no tiene texto disponible para cotejar el CUI y el plazo.`, bloquea: false });
  }
  if (!adjunto || !texto) return hallazgos;

  const cui = unico([...texto.matchAll(/\bCUI(?:\s*\)\s*,?\s*de corresponder)?\s*(?:N[.°º\s]*)?[:\s]*([1-9]\d{6})(?!\d)/gi)].map((m) => m[1]));
  const plazos = [...texto.matchAll(/\bplazo de ejecuci[oó]n\s*[:\s]*([1-9]\d{0,3})\s*d[ií]as\s+(calendario|h[aá]biles)\b/gi)]
    .map((m) => `${m[1]}:${m[2].toLowerCase() === "calendario" ? "calendario" : "habiles"}`);
  const plazo = unico(plazos);
  if (cui && ficha.cui?.trim() !== cui) {
    hallazgos.push({ mensaje: `El CUI de la ficha debe cotejarse con el CUI ${cui} de «${adjunto.file_name}».`, bloquea: true, ajuste: { cui } });
  }
  if (plazo) {
    const [dias, unidad] = plazo.split(":");
    if (Number(ficha.plazo_ejecucion) !== Number(dias) || (ficha.plazo_ejecucion_unidad || "calendario") !== unidad) {
      hallazgos.push({
        mensaje: `El plazo de la ficha debe cotejarse con los ${dias} días ${unidad === "habiles" ? "hábiles" : unidad} de «${adjunto.file_name}».`,
        bloquea: true,
        ajuste: { plazoEjecucion: dias, plazoEjecucionUnidad: unidad },
      });
    }
  }
  return hallazgos;
}
