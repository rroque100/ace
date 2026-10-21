import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getOpenAIClient, legalAnswerModel as model } from "@/lib/openai-server";
import { extractPdfText } from "@/lib/pdf-processing";
import { estimateCostUsd, roundCostUsd } from "@/lib/openai-cost";
import { writeAuditLog } from "@/lib/supabase-server";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const PROMPTS: Record<"proceso" | "oferta" | "precios", string> = {
  proceso: `Analiza este documento del PROCEDIMIENTO DE SELECCION (bases de una SUBASTA INVERSA ELECTRONICA, Ley 32069).
Devuelve SOLO JSON valido, sin markdown, con estas claves (usa null si no aparece; NO inventes):
{
  "nomenclatura": "nomenclatura completa del procedimiento, ej: SUBASTA INVERSA ELECTRONICA N° 02-2026-DEC-MDCH-1",
  "denominacion": "objeto de la convocatoria / denominacion completa de la contratacion (literal)",
  "entidadNombre": "nombre de la entidad contratante",
  "entidadRuc": "RUC de la entidad",
  "entidadDomicilio": "domicilio legal de la entidad",
  "fechaBuenaPro": "fecha de otorgamiento de la buena pro en formato ISO (YYYY-MM-DD) o null si no aparece",
  "fuenteFinanciamiento": "fuente de financiamiento o null",
  "formaPago": "PAGO UNICO o PAGO A CUENTA — busca la seccion FORMA DE PAGO en las bases",
  "nroPagos": "si es PAGO A CUENTA, el numero de pagos (ej: 2, 3). Si es PAGO UNICO, devuelve 1. Si no dice, null",
  "bienes": [
    { "paquete": "numero de paquete o item", "descripcion": "descripcion LITERAL del bien", "unidad": "unidad de medida", "cantidad": "cantidad" }
  ]
}
La lista "bienes" sale del cuadro del OBJETO DE LA CONVOCATORIA / OBJETO DE CONTRATACION (columnas PAQUETE, DESCRIPCION, UNIDAD DE MEDIDA, CANTIDAD). Copia TODAS las filas.`,
  oferta: `Este PDF contiene la oferta de un postor ganador en un proceso de seleccion peruano.
SOLO lee la pagina titulada "ANEXO 01" o "ANEXO N° 01" (Declaracion Jurada de Datos del Postor). IGNORA todas las demas paginas.

En el ANEXO 01 extrae:
- Razon social / Nombre: nombre completo de la empresa, al inicio del formulario.
- RUC: 11 digitos, junto a "N° de RUC".
- Domicilio legal: direccion completa (calle, numero, distrito, provincia, departamento).
- Correo electronico: junto a "Correo electronico" o "E-mail".
- Partida registral de la empresa: busca "FICHA Nro" o "FICHA N°" o "Partida Electronica Nro" seguido de un numero.
- Representante legal: busca "en que suscribe" o "quien suscribe" seguido del nombre completo de la persona. Tambien puede estar en "Representante Legal:".
- DNI del representante: 8 digitos, junto a "DNI" o "Documento de identidad".
- Poder del representante: busca "inscrita en" seguido de partida/asiento del poder.

Devuelve SOLO JSON valido, sin markdown (usa null si no aparece en el ANEXO 01; NO inventes datos):
{
  "razonSocial": "nombre o razon social COMPLETO del postor",
  "ruc": "RUC del postor (11 digitos)",
  "domicilio": "domicilio legal completo (calle, numero, distrito, provincia, departamento)",
  "partidaRegistral": "numero de FICHA o Partida Electronica de la empresa en SUNARP (ej: '11045229')",
  "asiento": "N° de asiento registral de la empresa o null",
  "ciudadRegistro": "ciudad/oficina registral de SUNARP (ej: 'Zona Registral X - Sede Cusco') o null",
  "representante": "nombre completo del representante legal que suscribe",
  "docTipo": "tipo de documento del representante: DNI o Carné de extranjería",
  "docNumero": "numero del documento de identidad del representante (8 digitos si es DNI)",
  "poderPartida": "partida registral donde consta el poder del representante o null",
  "poderAsiento": "asiento donde consta el poder del representante o null",
  "correo": "correo electronico del postor",
  "telefono": "telefono o celular de contacto o null",
  "montoOferta": null
}`,
  precios: `Este PDF contiene el DETALLE DE LOS PRECIOS UNITARIOS DEL PRECIO OFERTADO de un postor en un proceso de seleccion peruano.
Extrae la tabla de precios unitarios. Cada fila tiene: concepto (nombre del bien), marca, unidad de medida, cantidad, precio unitario y precio sub total.

Devuelve SOLO JSON valido, sin markdown:
{
  "items": [
    {
      "concepto": "descripcion del bien (ej: ACERO CORRUGADO FY=4200 KG/CM2 GRADO 60 DE 3/4 X 9M)",
      "marca": "marca del producto",
      "unidad": "unidad de medida (Unidad, Kg, etc.)",
      "cantidad": "cantidad numerica",
      "precioUnitario": "precio unitario en soles (numero con decimales)",
      "precioTotal": "precio sub total en soles (numero con decimales)"
    }
  ],
  "totalGeneral": "monto total general en soles (numero con decimales)"
}
Copia TODAS las filas de la tabla. NO inventes datos.`,
};

function parseJson(text: string): Record<string, unknown> {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return {};
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function readFileBytes(file: File): Promise<Buffer> {
  return Buffer.from(await file.arrayBuffer());
}

// Envía el PDF directamente a OpenAI como archivo (sin rasterizar).
// Funciona con PDFs escaneados (JBIG2, etc.) que pdfjs no puede renderizar.
async function extractWithVision(file: File, prompt: string) {
  const openai = getOpenAIClient();
  const bytes = await readFileBytes(file);
  const base64 = bytes.toString("base64");

  const response = await openai.responses.create({
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_file",
            file_data: `data:application/pdf;base64,${base64}`,
            filename: file.name,
          },
          { type: "input_text", text: prompt },
        ],
      },
    ],
    max_output_tokens: 2000,
    model,
    temperature: 0,
  });

  return { data: parseJson(response.output_text), usage: response.usage };
}

// POST /api/contratos-sie/extraer  (multipart: file + kind=proceso|oferta)
export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const rl = checkRateLimit(getRateLimitKey(request, auth.user.id, "contratos-sie"), RATE_LIMITS.aiSearch);
    if (!rl.allowed) return rateLimitResponse(rl);

    const formData = await request.formData();
    const file = formData.get("file");
    const kind = String(formData.get("kind") ?? "");
    if (!(file instanceof File) || file.type !== "application/pdf") {
      return NextResponse.json({ error: "Sube un archivo PDF." }, { status: 400 });
    }
    if (kind !== "proceso" && kind !== "oferta" && kind !== "precios") {
      return NextResponse.json({ error: "Tipo de documento inválido." }, { status: 400 });
    }
    if (file.size > 30 * 1024 * 1024) {
      return NextResponse.json({ error: "El PDF supera el límite de 30 MB." }, { status: 400 });
    }

    let data: Record<string, unknown>;
    let inputTokens = 0;
    let outputTokens = 0;
    let pageCount = 0;

    // Intenta texto nativo primero (más rápido y barato).
    // Si no hay suficiente texto, envía el PDF completo a OpenAI como archivo.
    try {
      const extracted = await extractPdfText(file);
      const text = extracted.text ?? "";
      pageCount = extracted.pageCount;

      if (text.trim().length >= 200) {
        const openai = getOpenAIClient();
        const response = await openai.responses.create({
          input: [{ role: "user", content: `${PROMPTS[kind]}\n\nTEXTO DEL DOCUMENTO:\n${text.slice(0, 30000)}` }],
          max_output_tokens: 2000,
          model,
          temperature: 0,
        });
        data = parseJson(response.output_text);
        inputTokens = response.usage?.input_tokens ?? 0;
        outputTokens = response.usage?.output_tokens ?? 0;
      } else {
        throw new Error("texto insuficiente");
      }
    } catch {
      // PDF escaneado o JBIG2: enviar directamente a OpenAI como archivo
      const result = await extractWithVision(file, PROMPTS[kind]);
      data = result.data;
      inputTokens = result.usage?.input_tokens ?? 0;
      outputTokens = result.usage?.output_tokens ?? 0;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No se pudo extraer datos del PDF. Intenta con una versión más legible." },
        { status: 422 },
      );
    }

    const usage = {
      inputTokens,
      outputTokens,
      estimatedCostUsd: roundCostUsd(estimateCostUsd(model, inputTokens, outputTokens)),
    };

    await writeAuditLog({
      action: "contratos.sie.extraer",
      actorReference: auth.user.email ?? auth.user.id,
      details: { kind, fileName: file.name, pageCount, tokenUsage: usage },
      entityType: "contrato",
      module: "contratos",
    }).catch(() => undefined);

    return NextResponse.json({ kind, data, tokenUsage: usage });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo analizar el PDF" },
      { status: 500 },
    );
  }
}
