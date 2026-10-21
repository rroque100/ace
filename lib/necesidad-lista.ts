// Presentación de la LISTA de necesidades: orden, titular de urgencia y el
// "próximo paso" de cada tarjeta. Lógica pura y determinista —sin red, sin
// React— para que un test la recorra y para que la tarjeta no arrastre reglas
// de flujo en el JSX.

import { accionesDisponibles, estadoNecesidad } from "./necesidad-workflow";

// ── Orden ──────────────────────────────────────────────────────────────────
// La paginación es del SERVIDOR (page/limit), así que el orden también tiene que
// serlo: ordenar en el cliente solo reordenaría la página cargada. Cada opción
// lleva su fragmento `order=` de PostgREST; el `.nullslast` empuja al final lo
// que no tiene el dato (una necesidad sin fecha requerida no debe encabezar el
// orden "más próximas").

export type OrdenNecesidad = "recientes" | "actividad" | "espera" | "fecha" | "monto";

export const ORDEN_OPCIONES: { value: OrdenNecesidad; label: string; order: string }[] = [
  { value: "recientes", label: "Más recientes", order: "created_at.desc" },
  { value: "actividad", label: "Actividad reciente", order: "updated_at.desc.nullslast" },
  { value: "espera", label: "Más tiempo en espera", order: "updated_at.asc.nullslast" },
  { value: "fecha", label: "Fecha requerida (más próximas)", order: "fecha_requerida.asc.nullslast" },
  { value: "monto", label: "Mayor monto", order: "monto_estimado.desc.nullslast" },
];

export const ORDEN_POR_DEFECTO: OrdenNecesidad = "recientes";

const ORDEN_MAP = new Map(ORDEN_OPCIONES.map((o) => [o.value, o]));

/** ¿Es una clave de orden reconocida? Sirve para validar lo que llega por la URL. */
export function esOrdenValido(valor: string | null | undefined): valor is OrdenNecesidad {
  return valor != null && ORDEN_MAP.has(valor as OrdenNecesidad);
}

/**
 * Fragmento `order=` seguro para la query. La entrada es una CLAVE del catálogo
 * (no el fragmento), así que el servidor nunca interpola texto arbitrario del
 * cliente en la consulta: clave desconocida → orden por defecto.
 */
export function ordenPostgrest(valor: string | null | undefined): string {
  return (esOrdenValido(valor) ? ORDEN_MAP.get(valor)! : ORDEN_MAP.get(ORDEN_POR_DEFECTO)!).order;
}

// ── Titular de urgencia ──────────────────────────────────────────────────────
// Una sola frase con lo que apremia, para que el atraso sea la lente por defecto
// en vez de estar repartido entre chips. Cadena vacía = nada urgente (no se
// pinta el titular).

export function resumenUrgencia(
  portafolio: { porVencer: number; estancadas: number },
  misPendientes: number,
): string {
  const trozos: string[] = [];
  if (misPendientes > 0) trozos.push(`${misPendientes} ${misPendientes === 1 ? "espera" : "esperan"} tu acción`);
  if (portafolio.porVencer > 0) trozos.push(`${portafolio.porVencer} por vencer`);
  if (portafolio.estancadas > 0) {
    trozos.push(`${portafolio.estancadas} ${portafolio.estancadas === 1 ? "estancada" : "estancadas"}`);
  }
  return trozos.join(" · ");
}

// ── Próximo paso de la tarjeta ───────────────────────────────────────────────
// Convierte "qué estado tiene" en "qué toca hacer y de quién depende". Reutiliza
// la máquina de estados: `estado.actor` es el lado responsable del siguiente
// paso; si es el mío, tomo la acción primaria disponible como etiqueta.

export type ProximoPaso = {
  /** ¿El siguiente paso depende del lado de este usuario? */
  miTurno: boolean;
  etiqueta: string;
  tono: "brand" | "muted" | "terminal";
};

export function proximoPaso(
  status: string,
  lado: { esDec: boolean; esAreaUsuaria: boolean },
  tieneExpediente: boolean,
): ProximoPaso {
  const estado = estadoNecesidad(status);
  // Estado terminal (incorporado / anulada): no hay siguiente paso que empujar.
  if (!estado || estado.actor === null) {
    return { miTurno: false, etiqueta: estado?.label ?? "—", tono: "terminal" };
  }

  const miLado = lado.esDec ? "dec" : lado.esAreaUsuaria ? "area_usuaria" : null;
  const miTurno = estado.actor === miLado;

  if (miTurno) {
    // La acción primaria del flujo desde este estado es el "próximo paso". La DEC
    // puede ejecutar cualquiera; el área usuaria solo las suyas —de ahí el gating
    // de `accionesDisponibles`—.
    const acciones = accionesDisponibles(status, lado, { tieneExpediente });
    const primaria = acciones.find((a) => a.variante === "primary") ?? acciones[0];
    return { miTurno: true, etiqueta: primaria?.label ?? "Continuar", tono: "brand" };
  }

  // Depende del otro lado: se muestra a la espera, sin CTA.
  const otro = estado.actor === "dec" ? "la DEC" : "el área usuaria";
  return { miTurno: false, etiqueta: `En manos de ${otro}`, tono: "muted" };
}
