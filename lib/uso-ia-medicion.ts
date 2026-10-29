// Medición del consumo de IA: envuelve el cliente de modelos para anotar, en cada llamada, cuántos tokens usó.
//
// Las ~26 llamadas del proyecto pasan por UN cliente (lib/openai-server.ts), así que se mide ahí en lugar de en cada
// punto de uso. Solo se anota; no cambia lo que la llamada devuelve ni cuándo lo devuelve, y un fallo al anotar nunca
// llega a quien llamó. Los tokens son los que informa el proveedor; cuando no los informa (la traducción a
// `chat.completions` en streaming no los trae) se estiman por la longitud del texto y se marca `estimado`.
// Módulo puro: el destino de la anotación se inyecta.

export type UsoMedido = { operacion: string; modelo: string; tokensEntrada: number; tokensSalida: number; estimado: boolean };
export type RegistrarUso = (uso: UsoMedido) => void;

/** ≈4 caracteres por token en español; es una cota razonable, no una medida. */
export const estimarTokens = (texto: string) => Math.ceil(texto.length / 4);

type Uso = Record<string, unknown> | null | undefined;
const numero = (valor: unknown) => (typeof valor === "number" && Number.isFinite(valor) && valor >= 0 ? Math.round(valor) : null);

/** Lee el uso en cualquiera de las dos formas: Responses (`input_tokens`) o chat.completions (`prompt_tokens`). */
export function leerUso(uso: Uso): { entrada: number; salida: number } | null {
  if (!uso || typeof uso !== "object") return null;
  const entrada = numero(uso.input_tokens) ?? numero(uso.prompt_tokens);
  const salida = numero(uso.output_tokens) ?? numero(uso.completion_tokens);
  return entrada === null && salida === null ? null : { entrada: entrada ?? 0, salida: salida ?? 0 };
}

const esIterable = (valor: unknown): valor is AsyncIterable<unknown> => Boolean(valor) && typeof (valor as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === "function";
const esPromesa = (valor: unknown): valor is PromiseLike<unknown> => Boolean(valor) && typeof (valor as { then?: unknown }).then === "function";

function anotar(registrar: RegistrarUso, uso: UsoMedido) {
  try { registrar(uso); } catch { /* medir nunca rompe la llamada */ }
}

type Parametros = { model?: unknown; input?: unknown; instructions?: unknown } | undefined;
const modeloDe = (parametros: Parametros) => (typeof parametros?.model === "string" ? parametros.model : "desconocido");
const textoDeEntrada = (parametros: Parametros) => {
  try { return `${typeof parametros?.instructions === "string" ? parametros.instructions : ""}${JSON.stringify(parametros?.input ?? "")}`; } catch { return ""; }
};

/** Envuelve el stream para anotar al terminar, sin alterar los eventos ni su ritmo. */
async function* medirStream(origen: AsyncIterable<unknown>, parametros: Parametros, registrar: RegistrarUso): AsyncGenerator<unknown> {
  let salida = 0;
  let informado: { entrada: number; salida: number } | null = null;
  try {
    for await (const evento of origen) {
      const e = evento as { type?: string; delta?: unknown; response?: { usage?: Uso } };
      if (e?.type === "response.output_text.delta" && typeof e.delta === "string") salida += e.delta.length;
      if (e?.type === "response.completed" || e?.type === "response.incomplete") informado = leerUso(e.response?.usage) ?? informado;
      yield evento;
    }
  } finally {
    // También si quien consume corta el stream a medias: lo que se generó ya se pagó.
    anotar(registrar, informado
      ? { operacion: "llm", modelo: modeloDe(parametros), tokensEntrada: informado.entrada, tokensSalida: informado.salida, estimado: false }
      : { operacion: "llm", modelo: modeloDe(parametros), tokensEntrada: estimarTokens(textoDeEntrada(parametros)), tokensSalida: Math.ceil(salida / 4), estimado: true });
  }
}

function medirRespuesta(respuesta: unknown, parametros: Parametros, registrar: RegistrarUso) {
  const r = respuesta as { usage?: Uso; raw?: { usage?: Uso }; output_text?: unknown } | null;
  const informado = leerUso(r?.usage) ?? leerUso(r?.raw?.usage);
  anotar(registrar, informado
    ? { operacion: "llm", modelo: modeloDe(parametros), tokensEntrada: informado.entrada, tokensSalida: informado.salida, estimado: false }
    : { operacion: "llm", modelo: modeloDe(parametros), tokensEntrada: estimarTokens(textoDeEntrada(parametros)), tokensSalida: estimarTokens(typeof r?.output_text === "string" ? r.output_text : ""), estimado: true });
}

/**
 * Envuelve `client.responses.create` (la única llamada que usa el proyecto) para medirla. Cubre sus tres formas: promesa
 * con respuesta, promesa con un stream (cliente de OpenAI) y generador asíncrono (la traducción a chat.completions).
 *
 * `antes` se espera ANTES de cada llamada y puede lanzar para impedirla (la cuota mensual de una cuenta externa): así un
 * tope agotado corta la llamada que lo desborda en vez de dejarla pasar y descubrirlo al anotarla.
 */
export function medirCliente<T extends object>(cliente: T, registrar: RegistrarUso, antes?: () => Promise<void>): T {
  const original = cliente as { responses?: { create?: (...args: unknown[]) => unknown } };
  if (!original.responses?.create) return cliente;
  const crearOriginal = original.responses.create.bind(original.responses);
  const responsesMedido = new Proxy(original.responses, {
    get(destino, propiedad, receptor) {
      if (propiedad !== "create") return Reflect.get(destino, propiedad, receptor);
      return (parametros: Parametros, ...resto: unknown[]) => {
        if (antes) {
          const lanzar = async () => {
            await antes();
            return crearOriginal(parametros, ...resto);
          };
          // Un stream se devuelve ya como generador; el resto, como promesa de la respuesta.
          if ((parametros as { stream?: unknown } | undefined)?.stream) {
            return (async function* () {
              const origen = await lanzar();
              if (esIterable(origen)) yield* medirStream(origen, parametros, registrar);
            })();
          }
          return lanzar().then((respuesta) => {
            if (esIterable(respuesta)) return medirStream(respuesta, parametros, registrar);
            medirRespuesta(respuesta, parametros, registrar);
            return respuesta;
          });
        }
        const resultado = crearOriginal(parametros, ...resto);
        if (esIterable(resultado)) return medirStream(resultado, parametros, registrar);
        if (esPromesa(resultado)) {
          return Promise.resolve(resultado).then((respuesta) => {
            if (esIterable(respuesta)) return medirStream(respuesta, parametros, registrar);
            medirRespuesta(respuesta, parametros, registrar);
            return respuesta;
          });
        }
        return resultado;
      };
    },
  });
  return new Proxy(cliente, {
    get(destino, propiedad, receptor) {
      if (propiedad === "responses") return responsesMedido;
      return Reflect.get(destino, propiedad, receptor);
    },
  });
}
