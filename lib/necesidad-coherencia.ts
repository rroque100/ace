// Coherencia de la Necesidad: lo que ningún campo ve por su cuenta.
//
// La verificación "¿está lista?" (necesidad-verificacion.ts) mira cada exigencia
// del Art. 44 por separado: ¿hay finalidad?, ¿hay objeto?, ¿hay monto? Pero los
// errores caros de un requerimiento no son campos vacíos, sino campos llenos que
// se CONTRADICEN entre sí: una cuantía baja con un procedimiento de gran cuantía;
// una fecha pedida a la que, ni empezando hoy, la ejecución llega; un costo total
// que no cuadra con cantidad × precio unitario.
//
// Mismo patrón que la torre de control del expediente (lib/torre-control.ts):
// PAREJAS de datos que se contradicen, mostradas juntas —"S/ 90,000 frente a la
// línea de corte S/ 2,232,729" se entiende sin leer—. No decide ni escribe: es un
// diagnóstico. Todo es `warn` (conviene mirarlo), no `stop`: la asignación del
// procedimiento la confirma la DEC (A4) y la fecha requerida no invalida nada.

import { soles } from "./segmentacion-parametros";
import type { Necesidad } from "./necesidades";

export type NivelCoherencia = "warn" | "stop";

export type TarjetaCoherencia = {
  clave: "cuantia_proceso" | "fecha_plazo";
  /** Etiqueta con su artículo: de dónde sale la exigencia. */
  etiqueta: string;
  /** La pareja de datos, para verla de un vistazo. */
  valor: string;
  /** Qué se contradice y cuál es la salida. */
  nota: string;
  nivel: NivelCoherencia;
  /** Clave `api` del campo al que saltar para resolverlo. */
  campo: string;
};

export type EntradaCoherencia = {
  /** PAC de bienes y servicios (Configuración): base de la línea de corte. */
  pacBienesServicios: number | null;
  /** Hoy en ISO (inyectable para tests). */
  hoy?: string;
};

const PORCENTAJE_LINEA_CORTE = 0.1;

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function hoyISO(hoy?: string): string {
  if (hoy) return hoy;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Banda de cuantía a la que apunta un procedimiento, por palabras clave de su
 * etiqueta. Conservador a propósito: los "Abreviada/Abreviado" (cuantía
 * intermedia) y todo lo demás devuelven null para no marcar falsos positivos —la
 * norma no traza una línea 1:1 cuantía→procedimiento (la DEC lo confirma en A4).
 */
export function bandaProceso(valor: string): "alta" | "menor" | null {
  const v = (valor ?? "").toLowerCase();
  if (!v) return null;
  if (v.includes("comparación de precios") || v.includes("comparacion de precios") || v.includes("subasta inversa") || v.includes("no competitivo")) {
    return "menor";
  }
  if ((v.includes("licitación pública") || v.includes("licitacion publica") || v.includes("concurso público") || v.includes("concurso publico")) && !v.includes("abreviad")) {
    return "alta";
  }
  return null;
}

/** Cuantía ↔ procedimiento elegido (solo bienes/servicios, con línea de corte). */
function tarjetaCuantiaProceso(n: Necesidad, e: EntradaCoherencia): TarjetaCoherencia | null {
  const objeto = n.tipo_objeto;
  if (objeto !== "bienes" && objeto !== "servicios") return null; // obras/consultoría: Art. 153, sin línea de corte
  const pac = num(e.pacBienesServicios);
  const monto = num(n.monto_estimado);
  if (!pac || !monto) return null;
  const proceso = typeof n.tipo_proceso_seleccion === "string" ? n.tipo_proceso_seleccion : "";
  const banda = bandaProceso(proceso);
  if (!banda) return null; // proceso sin definir o intermedio: nada que contradecir aquí

  const lineaCorte = Math.round(pac * PORCENTAJE_LINEA_CORTE * 100) / 100;
  const cuantiaAlta = monto > lineaCorte;
  const par = `${soles(monto)} · línea de corte ${soles(lineaCorte)}`;

  if (cuantiaAlta && banda === "menor") {
    return {
      clave: "cuantia_proceso",
      etiqueta: "Cuantía ↔ procedimiento · Art. 125.2",
      valor: par,
      nota: `El monto supera la línea de corte (alta cuantía), pero elegiste un procedimiento de menor cuantía. Verifica que corresponde; la DEC lo confirma en su estrategia (A4).`,
      nivel: "warn",
      campo: "tipoProcesoSeleccion",
    };
  }
  if (!cuantiaAlta && banda === "alta") {
    return {
      clave: "cuantia_proceso",
      etiqueta: "Cuantía ↔ procedimiento · Art. 125.2",
      valor: par,
      nota: `El monto no supera la línea de corte (baja cuantía), pero elegiste un procedimiento de mayor cuantía. Verifica que corresponde; la DEC lo confirma en su estrategia (A4).`,
      nivel: "warn",
      campo: "tipoProcesoSeleccion",
    };
  }
  return null;
}

/** Fecha requerida ↔ plazo de ejecución: ¿cabe en el calendario? */
function tarjetaFechaPlazo(n: Necesidad, e: EntradaCoherencia): TarjetaCoherencia | null {
  const requerida = typeof n.fecha_requerida === "string" ? n.fecha_requerida.slice(0, 10) : "";
  const plazo = num(n.plazo_ejecucion);
  if (!requerida || !plazo) return null;
  const hoy = hoyISO(e.hoy);
  if (requerida <= hoy) return null; // fecha pasada: ya la avisa la verificación

  const dia = 86_400_000;
  const margen = Math.round((Date.parse(`${requerida}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / dia);
  if (!Number.isFinite(margen) || margen >= plazo) return null;

  return {
    clave: "fecha_plazo",
    etiqueta: "Fecha requerida ↔ plazo de ejecución",
    valor: `Faltan ${margen} días · la ejecución dura ${plazo}`,
    nota: `Se pide para el ${requerida}, pero la ejecución dura ${plazo} días: ni empezando hoy llegaría. Ajusta la fecha o el plazo, o deja constancia del motivo.`,
    nivel: "warn",
    campo: "fechaRequerida",
  };
}

/** Todas las contradicciones cruzadas detectables (solo las que tienen algo que decir). */
export function tarjetasCoherencia(n: Necesidad, e: EntradaCoherencia): TarjetaCoherencia[] {
  return [tarjetaCuantiaProceso(n, e), tarjetaFechaPlazo(n, e)].filter(
    (t): t is TarjetaCoherencia => t !== null,
  );
}

/** Cuántas contradicciones bloquean (nivel `stop`). Hoy todas son `warn`. */
export function cuantasBloquean(tarjetas: readonly TarjetaCoherencia[]): number {
  return tarjetas.filter((t) => t.nivel === "stop").length;
}
