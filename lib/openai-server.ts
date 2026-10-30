import OpenAI from "openai";
import {generationFallback,openCodeTextFallback,openCodeAvailable,openCodeBase,openCodeModel,zaiFallbackAvailable,zaiFallbackModel,zaiFallbackBase,canUseZaiText} from "./ai-fallback";
import { withRetry } from "./retry";
import { medirCliente } from "./uso-ia-medicion";
import { exigirCuotaIA, registrarUsoIA } from "./uso-ia";

// ---------------------------------------------------------------------------
// Proveedor de IA: OpenAI, Google Gemini (AI Studio) o Z.ai (Zhipu / GLM).
//
// Todo el código usa el API `responses.create` de OpenAI. Gemini y Z.ai son
// compatibles con OpenAI SOLO en `chat/completions`, así que cuando el proveedor
// NO es OpenAI se envuelve el cliente en un Proxy que traduce `responses.create`
// → `chat.completions.create` (streaming y no-streaming, más partes de visión),
// sin tocar los ~26 puntos de llamada del proyecto.
//
// Precedencia por variable de entorno presente: Gemini → Z.ai → OpenAI.
// ---------------------------------------------------------------------------

type Provider = "openai" | "gemini" | "zai";

function geminiKey(): string | undefined {
  return process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
}

export function getProvider(): Provider {
  if (geminiKey()) return "gemini";
  if (process.env.ZAI_API_KEY) return "zai";
  return "openai";
}

/** Responses API `input` → mensajes de chat.completions (traduce partes de visión). */
function toChatMessages(input: unknown): Array<Record<string, unknown>> {
  if (typeof input === "string") return [{ role: "user", content: input }];
  if (!Array.isArray(input)) return [];
  return input.map((msg) => {
    const m = msg as { role?: string; content?: unknown };
    const role = m.role ?? "user";
    if (typeof m.content === "string" || m.content == null) {
      return { role, content: m.content ?? "" };
    }
    if (Array.isArray(m.content)) {
      const parts = m.content.map((p) => {
        const part = p as { type?: string; text?: string; image_url?: unknown };
        if (part.type === "input_text" || part.type === "text") {
          return { type: "text", text: part.text ?? "" };
        }
        if (part.type === "input_image" || part.type === "image_url") {
          // Responses: image_url puede ser string o {url}. Chat: {url}.
          const url = typeof part.image_url === "string" ? part.image_url : (part.image_url as { url?: string })?.url;
          return { type: "image_url", image_url: { url } };
        }
        return { type: "text", text: part.text ?? "" };
      });
      return { role, content: parts };
    }
    return { role, content: "" };
  });
}

/** Traduce los parámetros de `responses.create` a `chat.completions.create`. */
function toChatParams(params: Record<string, unknown>, provider: string): Record<string, unknown> {
  const { input, instructions, max_output_tokens, model, temperature, stream, ...rest } = params;
  // Solo se conservan parámetros que chat.completions entiende; se descartan los
  // específicos de Responses (p. ej. `text`, `reasoning`) que romperían el proveedor.
  const messages = toChatMessages(input);
  // `instructions` (Responses API) = prompt de sistema → se antepone como system.
  // Sin esto, p. ej. el OCR perdería su instrucción de transcripción.
  if (typeof instructions === "string" && instructions.trim()) {
    messages.unshift({ role: "system", content: instructions });
  }
  const out: Record<string, unknown> = {
    model,
    messages,
  };
  if (typeof max_output_tokens === "number") out.max_tokens = max_output_tokens;
  if (typeof temperature === "number") out.temperature = temperature;
  if (stream) out.stream = true;
  // `response_format` sí lo entiende chat.completions (por si algún día se usa).
  if (rest.response_format) out.response_format = rest.response_format;
  // Gemini 2.5 "piensa" y ese razonamiento CONSUME max_tokens, truncando la
  // salida (JSON cortado → irreparable). Se desactiva el thinking para que TODO
  // el presupuesto vaya a la respuesta. `reasoning_effort` es el control del
  // endpoint compatible-OpenAI de Gemini.
  if (provider === "gemini") out.reasoning_effort = "none";
  if (provider === "opencode") out.reasoning_effort = "minimal";
  if (provider === "zai") out.thinking = {type:"disabled"};
  if (rest.text && typeof rest.text === "object") {
    const format=(rest.text as {format?: {type?:string}}).format;
    if(format?.type === "json_object") out.response_format={type:"json_object"};
  }
  return out;
}

/** Shim de `responses.create` sobre `chat.completions` para Z.ai. */
function zaiResponsesCreate(client: OpenAI, params: Record<string, unknown>, options?: OpenAI.RequestOptions, provider: string = "gemini"): unknown {
  const chatParams = toChatParams(params,provider);
  if (params.stream) {
    // Devuelve un async-iterable de eventos con la MISMA forma que Responses:
    // { type: "response.output_text.delta", delta }.
    return (async function* () {
      const stream = (await client.chat.completions.create(
        chatParams as unknown as OpenAI.Chat.ChatCompletionCreateParamsStreaming, options,
      )) as AsyncIterable<OpenAI.Chat.ChatCompletionChunk>;
      let incomplete=false; let usage: unknown; let actualModel=String(params.model);
      for await (const chunk of stream) {
        if(chunk.usage) usage=chunk.usage;
        if(chunk.model) actualModel=chunk.model;
        if(chunk.choices?.[0]?.finish_reason==="length")incomplete=true;
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) yield { type: "response.output_text.delta", delta };
      }
      yield { type: incomplete ? "response.incomplete" : "response.completed", response:{model:["opencode","zai"].includes(provider) ? `${provider}/${actualModel}` : actualModel,usage} };
    })();
  }
  return client.chat.completions
    .create(chatParams as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming, options)
    .then((resp) => ({
      // La forma que consume el proyecto: `.output_text`.
      output_text: resp.choices?.[0]?.message?.content ?? "",
      model: ["opencode","zai"].includes(provider) ? `${provider}/${resp.model}` : resp.model,
      status:resp.choices?.[0]?.finish_reason === "length" ? "incomplete" : "completed",
      raw: resp,
    }));
}

/** Envuelve el cliente para que `.responses.create` funcione vía chat.completions. */
function withChatShim(client: OpenAI, provider: string): OpenAI {
  const responsesShim = { create: (params: Record<string, unknown>, options?: OpenAI.RequestOptions) => zaiResponsesCreate(client, params, options, provider) };
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "responses") return responsesShim;
      return Reflect.get(target, prop, receiver);
    },
  }) as OpenAI;
}

export function getOpenAIClient() {
  const provider=getProvider();
  const measured=(client:OpenAI,name:string)=>medirCliente(client,usage=>registrarUsoIA(usage,usage.operacion,name),()=>exigirCuotaIA());
  const primary=measured(crearClienteProveedor(),provider);
  if(provider !== "gemini" || (!openCodeAvailable() && !zaiFallbackAvailable()))return primary;
  const backup=openCodeAvailable()?measured(withChatShim(new OpenAI({apiKey:process.env.OPENCODE_API_KEY,baseURL:openCodeBase(),maxRetries:0}),"opencode"),"opencode"):null;
  const third=zaiFallbackAvailable()?measured(withChatShim(new OpenAI({apiKey:process.env.ZAI_API_KEY,baseURL:zaiFallbackBase(),maxRetries:0}),"zai"),"zai"):null;
  return new Proxy(primary,{
    get(target,property,receiver){
      if(property !== "responses")return Reflect.get(target,property,receiver);
      return {create:(params:Record<string,unknown>,options?:OpenAI.RequestOptions)=>{
        const call=(client:OpenAI,model?:string)=>client.responses.create({...params,...(model?{model}:{})} as unknown as OpenAI.Responses.ResponseCreateParamsNonStreaming,options);
        const runPrimary=()=>call(primary);
        const runThird=()=>call(third!,zaiFallbackModel());
        const runBackup=()=>call(backup!,openCodeModel());
        const eligible=Boolean(third)&&canUseZaiText(params);
        const unavailable=()=>{throw new Error("No hay un proveedor de respaldo compatible con este contenido");};
        if(params.stream){
          const asStream=(run:()=>unknown)=>()=>run() as AsyncIterable<unknown>;
          const backups=backup
            ? eligible?()=>openCodeTextFallback.stream(asStream(runBackup),asStream(runThird)):asStream(runBackup)
            : eligible?asStream(runThird):unavailable;
          return generationFallback.stream(asStream(runPrimary),backups);
        }
        const backups=backup
          ? eligible?()=>openCodeTextFallback.run(runBackup,runThird):runBackup
          : eligible?runThird:unavailable;
        return generationFallback.run(runPrimary,backups);
      }};
    },
  }) as OpenAI;
}

/** The actual generation route, including the third provider, is visible in Chat details. */
export function reportedProvider(model:string):string {
  if(model.startsWith("opencode/"))return "opencode";
  if(model.startsWith("zai/"))return "zai";
  return getProvider();
}
export function configuredTextProviders():string[]{
 return getProvider()==="gemini"?["Google Gemini",...(openCodeAvailable()?["OpenCode"]:[]),...(zaiFallbackAvailable()?["Z.ai"]:[])]:[getProvider()==="zai"?"Z.ai":"OpenAI"];
}

function crearClienteProveedor() {
  const provider = getProvider();
  if (provider === "gemini") {
    const apiKey = geminiKey() as string;
    const baseURL = process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai";
    return withChatShim(new OpenAI({ apiKey, baseURL, maxRetries: 0 }),provider);
  }
  if (provider === "zai") {
    const apiKey = process.env.ZAI_API_KEY as string;
    const baseURL = process.env.ZAI_BASE_URL ?? "https://api.z.ai/api/paas/v4";
    return withChatShim(new OpenAI({ apiKey, baseURL, maxRetries: 0 }),provider);
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Falta OPENAI_API_KEY (o GOOGLE_API_KEY / ZAI_API_KEY para usar otro proveedor)");
  }
  return new OpenAI({ apiKey });
}

// Modelos por defecto según el proveedor activo; todos configurables por env.
const provider = getProvider();

/**
 * Modelo a usar: el override del PROVEEDOR ACTIVO si lo hay, si no su valor por
 * defecto. Nunca el override de otro proveedor.
 *
 * Antes la precedencia era por variable, no por proveedor: `OPENAI_PDF_OCR_MODEL`
 * ganaba siempre, así que con `GOOGLE_API_KEY` presente el OCR pedía "gpt-4o" a
 * generativelanguage.googleapis.com y recibía «models/gpt-4o is not found» (404).
 * El PDF quedaba en error y el mensaje —"404 status code (no body)"— no decía
 * nada del modelo. Un valor en blanco cuenta como no configurado: `??` dejaba
 * pasar la cadena vacía y se pedía un modelo sin nombre.
 */
export function elegirModelo(
  proveedor: Provider,
  overrides: Partial<Record<Provider, string | undefined>>,
  porDefecto: Record<Provider, string>,
): string {
  return overrides[proveedor]?.trim() || porDefecto[proveedor];
}

export const legalAnswerModel = elegirModelo(
  provider,
  {
    gemini: process.env.GEMINI_MODEL,
    openai: process.env.OPENAI_LEGAL_MODEL,
    zai: process.env.ZAI_MODEL,
  },
  { gemini: "gemini-2.5-flash", openai: "gpt-4.1-mini", zai: "glm-4.5-flash" },
);
export const pdfOcrModel = elegirModelo(
  provider,
  {
    gemini: process.env.GEMINI_PDF_OCR_MODEL,
    openai: process.env.OPENAI_PDF_OCR_MODEL,
    zai: process.env.ZAI_PDF_OCR_MODEL,
  },
  { gemini: "gemini-2.5-flash", openai: "gpt-4o-mini", zai: "glm-4.5v" },
);
// Embeddings: el índice de Pinecone se construyó con text-embedding-3-small
// (1536 dim). Ni Gemini ni Z.ai producen ese formato/espacio vectorial, así que
// el embedding sigue apuntando a OpenAI: requiere una OPENAI_API_KEY con cuota
// para el EMBEDDING aunque el LLM use otro proveedor. Si OpenAI está agotado, la
// búsqueda RAG cae al modo LÉXICO (SQL) automáticamente. Ver getEmbeddingClient().
export const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
export const embeddingDimensions = Number.parseInt(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? "1536", 10);
export const rerankModel = elegirModelo(
  provider,
  {
    gemini: process.env.GEMINI_RERANK_MODEL,
    openai: process.env.OPENAI_RERANK_MODEL,
    zai: process.env.ZAI_RERANK_MODEL,
  },
  { gemini: "gemini-2.5-flash-lite", openai: "gpt-4o-mini", zai: "glm-4.5-flash" },
);

/**
 * Cliente para EMBEDDINGS. Se separa del LLM: el índice de Pinecone es de OpenAI
 * (1536 dim), así que el embedding debe seguir yendo a OpenAI. Si hay
 * OPENAI_EMBEDDING_API_KEY (o OPENAI_API_KEY con cuota), se usa; si no, se cae al
 * cliente principal (que, con Z.ai, hará fallar el embedding y la búsqueda RAG
 * degradará a léxico).
 */
/**
 * Proveedor de embeddings. OpenAI por defecto; `google` cuando su cuota se agota.
 *
 * El indice de Pinecone es de 1536 dimensiones, y `gemini-embedding-001` acepta
 * `outputDimensionality: 1536`, asi que encaja SIN recrear el indice.
 *
 * AVISO IMPORTANTE: coincidir en numero de dimensiones NO basta. Cada modelo
 * proyecta a un espacio distinto, asi que consultar con Gemini contra vectores
 * escritos por OpenAI da parecidos sin sentido. Cambiar de proveedor obliga a
 * REINDEXAR el corpus, y por eso el namespace se separa por proveedor: asi los
 * dos juegos de vectores conviven y volver atras es cambiar una variable.
 */
export const embeddingProvider = (process.env.EMBEDDING_PROVIDER ?? "openai").trim().toLowerCase();
export const googleEmbeddingModel = process.env.GOOGLE_EMBEDDING_MODEL ?? "gemini-embedding-001";

/** Embeddings con Gemini. Su API no acepta lotes en `embedContent`: usa `batchEmbedContents`. */
export async function embedWithGoogle(textos: string[], dimensiones: number): Promise<number[][]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Falta GOOGLE_API_KEY para los embeddings de Google");
  const salida: number[][] = [];
  // 100 es el maximo por llamada que documenta batchEmbedContents.
  for (let i = 0; i < textos.length; i += 100) {
    const lote = textos.slice(i, i + 100);
    // Un 429 por minuto o un 503 de medio segundo no deben dejar un documento en `error` ni degradar una respuesta:
    // se reintenta con espera creciente. El crédito agotado (402) no se reintenta; ver lib/retry.ts.
    const json = await withRetry(async () => {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${googleEmbeddingModel}:batchEmbedContents?key=${apiKey}`,
        {
          body: JSON.stringify({
            requests: lote.map((texto) => ({
              content: { parts: [{ text: texto }] },
              model: `models/${googleEmbeddingModel}`,
              outputDimensionality: dimensiones,
            })),
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      if (!res.ok) {
        throw new Error(`Google embeddings ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }
      return (await res.json()) as { embeddings?: { values: number[] }[] };
    }, { attempts: 3, baseMs: 400 });
    for (const e of json.embeddings ?? []) salida.push(e.values);
  }
  return salida;
}

export function getEmbeddingClient() {
  const apiKey = process.env.OPENAI_EMBEDDING_API_KEY ?? process.env.OPENAI_API_KEY;
  if (apiKey) return new OpenAI({ apiKey });
  return getOpenAIClient();
}
