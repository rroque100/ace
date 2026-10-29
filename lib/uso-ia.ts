// Consumo de IA por cuenta y por módulo: a quién se atribuye cada llamada, dónde se anota y cuándo se corta.
//
// Quién llama no viaja por los parámetros (las ~26 llamadas al modelo no saben de usuarios). El proxy, que ya valida
// la sesión, pasa la identidad al resto del servidor en cabeceras propias (`x-ace-uid`, `x-ace-tipo`, `x-ace-cuota`,
// `x-ace-ruta`, `x-ace-ip`) que SIEMPRE sobrescribe: el cliente no puede falsearlas. Aquí se leen con `headers()`.
//
// No se usa un AsyncLocalStorage rellenado al resolver la sesión (`enterWith` dentro de una función async que se
// espera con await NO llega al código que la llamó; probado en Node 24). Fuera de una solicitud (los scripts, el
// worker de indexación) no hay cabeceras y no se anota nada: el consumo de indexar el corpus no es de ninguna persona.
//
// Escribe en `uso_ia` (docs/supabase/usuarios-externos.sql). Anotar nunca debe romper una respuesta: si la tabla no
// existe se avisa una vez en el log y se sigue.

import { AsyncLocalStorage } from "node:async_hooks";
import { headers } from "next/headers";
import { after } from "next/server";
import { supabaseRest } from "@/lib/supabase-server";
import { costoEstimado } from "@/lib/uso-ia-precios";
import type { UsoMedido } from "@/lib/uso-ia-medicion";

export type ContextoUso = {
  usuarioId: string | null;
  tipoUsuario: "interno" | "externo";
  modulo: string;
  ip: string | null;
  /** Tokens por mes permitidos a una cuenta externa; null = sin tope. */
  cuotaIAMensual: number | null;
};

const almacen = new AsyncLocalStorage<ContextoUso>();

/**
 * Contexto de la solicitud en curso, o `undefined` fuera de una (scripts, worker) o sin sesión. Primero el contexto
 * explícito (`conContextoUso`); si no, las cabeceras que fijó el proxy.
 */
export async function contextoUso(): Promise<ContextoUso | undefined> {
  const explicito = almacen.getStore();
  if (explicito) return explicito;
  try {
    const cabeceras = await headers();
    const usuarioId = cabeceras.get("x-ace-uid");
    if (!usuarioId) return undefined;
    const tipo = cabeceras.get("x-ace-tipo");
    const cuota = Number(cabeceras.get("x-ace-cuota"));
    return {
      usuarioId,
      tipoUsuario: tipo === "externo" ? "externo" : "interno",
      modulo: moduloDeUso(cabeceras.get("x-ace-ruta")),
      ip: cabeceras.get("x-ace-ip"),
      cuotaIAMensual: tipo === "externo" && cabeceras.get("x-ace-cuota") && Number.isFinite(cuota) && cuota >= 0 ? Math.floor(cuota) : null,
    };
  } catch {
    // `headers()` lanza fuera de una solicitud.
    return undefined;
  }
}

/** Ejecuta `trabajo` con un contexto propio y lo suelta al terminar (los scripts y las pruebas). */
export const conContextoUso = <T>(contexto: ContextoUso, trabajo: () => T): T => almacen.run(contexto, trabajo);

/** Módulo de la app al que se atribuye un consumo, a partir de la ruta que lo originó. */
export function moduloDeUso(pathname: string | null | undefined): string {
  const ruta = pathname ?? "";
  const es = (...prefijos: string[]) => prefijos.some((p) => ruta === p || ruta.startsWith(`${p}/`));
  if (es("/chat", "/busqueda", "/normas", "/api/chat", "/api/search", "/api/norms", "/api/normativa", "/api/facets")) return "centro_juridico";
  if (es("/simulacro", "/api/simulacro")) return "simulacro";
  if (es("/necesidades", "/api/necesidades")) return "necesidades";
  if (es("/expedientes-archivo", "/api/expedientes-archivo", "/archivo", "/api/archivo")) return "archivo";
  if (es("/expedientes", "/contratos", "/api/expedientes", "/api/processes", "/api/contracts", "/api/contratos-cp", "/api/contratos-sie")) return "expedientes";
  if (es("/api/asistente")) return "asistente";
  if (es("/analizar", "/comparar", "/validar", "/api/analyze", "/api/compare")) return "revisar";
  if (es("/api/documents", "/api/corpus", "/api/folders")) return "biblioteca";
  return "otros";
}

// ── Anotar ──────────────────────────────────────────────────────────────────────────────────────────────

let avisadoTabla = false;
const avisarUnaVez = (que: string, error: unknown) => {
  if (avisadoTabla) return;
  avisadoTabla = true;
  const motivo = error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 200) : String(error);
  console.error(`[uso-ia] ${que}; ¿falta ejecutar docs/supabase/usuarios-externos.sql? (${motivo})`);
};

/** Hace el trabajo después de responder si estamos dentro de una solicitud; si no, lo lanza sin esperar. */
export function diferir(trabajo: () => Promise<unknown>) {
  try { after(trabajo); } catch { void trabajo().catch(() => undefined); }
}

const consumo = new Map<string, { tokens: number; hasta: number }>();
const VIGENCIA_CONSUMO_MS = 60_000;

/** Anota el consumo en la tabla y lo suma al acumulado en memoria de la cuenta (para que la cuota lo vea enseguida). */
export async function registrarUsoIA(uso: UsoMedido, operacion = uso.operacion, proveedor: string | null = null): Promise<void> {
  const contexto = await contextoUso();
  if (!contexto) return;
  const total = uso.tokensEntrada + uso.tokensSalida;
  if (contexto.usuarioId) {
    const actual = consumo.get(contexto.usuarioId);
    if (actual) actual.tokens += total;
  }
  const { costo } = costoEstimado(uso.modelo, uso.tokensEntrada, uso.tokensSalida);
  diferir(async () => {
    try {
      await supabaseRest("uso_ia", {
        method: "POST",
        body: JSON.stringify({
          usuario_id: contexto.usuarioId,
          tipo_usuario: contexto.tipoUsuario,
          modulo: contexto.modulo,
          operacion,
          proveedor,
          modelo: uso.modelo.slice(0, 80),
          tokens_entrada: uso.tokensEntrada,
          tokens_salida: uso.tokensSalida,
          estimado: uso.estimado,
          costo_estimado: costo,
        }),
      });
    } catch (error) {
      avisarUnaVez("no se pudo anotar el consumo de IA", error);
    }
  });
}

// ── Cuota mensual ───────────────────────────────────────────────────────────────────────────────────────

export class CuotaIAAgotadaError extends Error {
  constructor(public readonly usados: number, public readonly cuota: number) {
    super("Alcanzaste tu límite mensual de uso de IA. Se renueva el primer día del mes; si lo necesitas antes, contacta con el administrador.");
    this.name = "CuotaIAAgotadaError";
  }
}

/** Primer instante del mes (UTC) al que pertenece `ahora`. */
export const inicioDeMes = (ahora: number) => new Date(Date.UTC(new Date(ahora).getUTCFullYear(), new Date(ahora).getUTCMonth(), 1)).toISOString();

type CargarConsumo = (usuarioId: string, desdeIso: string) => Promise<number>;

const cargarDesdeBase: CargarConsumo = async (usuarioId, desdeIso) => {
  const filas = await supabaseRest<Array<{ tokens_entrada: number; tokens_salida: number }>>(
    `uso_ia?usuario_id=eq.${usuarioId}&creado_en=gte.${encodeURIComponent(desdeIso)}&select=tokens_entrada,tokens_salida&limit=20000`,
  );
  return filas.reduce((suma, fila) => suma + fila.tokens_entrada + fila.tokens_salida, 0);
};

/** Tokens de IA que lleva la cuenta este mes. Se recuerda un minuto; si no se puede leer, se cuenta como 0 (ver abajo). */
export async function consumoMensualTokens(usuarioId: string, ahora = Date.now(), cargar: CargarConsumo = cargarDesdeBase): Promise<number> {
  const guardado = consumo.get(usuarioId);
  if (guardado && guardado.hasta > ahora) return guardado.tokens;
  try {
    const tokens = await cargar(usuarioId, inicioDeMes(ahora));
    consumo.set(usuarioId, { tokens, hasta: ahora + VIGENCIA_CONSUMO_MS });
    return tokens;
  } catch (error) {
    // No poder leer el consumo no deja sin servicio a nadie: la auditoría y la cuota son una capa de control, no una
    // condición para responder. Se avisa y se cuenta 0.
    avisarUnaVez("no se pudo leer el consumo mensual de IA para aplicar la cuota", error);
    return 0;
  }
}

export const olvidarConsumo = () => consumo.clear();

/** Lanza `CuotaIAAgotadaError` si la cuenta externa del contexto ya llegó a su tope mensual. */
export async function exigirCuotaIA(ahora = Date.now(), cargar?: CargarConsumo): Promise<void> {
  const contexto = await contextoUso();
  if (!contexto || contexto.tipoUsuario !== "externo" || contexto.cuotaIAMensual === null || !contexto.usuarioId) return;
  const usados = await consumoMensualTokens(contexto.usuarioId, ahora, cargar);
  if (usados >= contexto.cuotaIAMensual) throw new CuotaIAAgotadaError(usados, contexto.cuotaIAMensual);
}
