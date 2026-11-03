import { describe, expect, it } from "vitest";
import { advertenciaRecuperacionParcial, clasificarFalloRecuperacion, detalleParaLog } from "../lib/retrieval-failure";
import { materialWarnings } from "../lib/chat-signals";

// Mensajes tal como los devuelven los proveedores (los dos primeros, en producción: la búsqueda por significado estuvo caída
// con los DOS proveedores de embeddings sin crédito y el aviso decía solo «una de las vías no estuvo disponible»).
const GOOGLE_SIN_CREDITO = new Error(
  'Google embeddings 402: {"error":{"code":402,"message":"Your prepayment credits are depleted. Please go to AI Studio","status":"RESOURCE_EXHAUSTED"}}',
);
const OPENAI_SIN_CREDITO = Object.assign(new Error("429 You have no credits remaining. Add credits to continue using the API."), {
  status: 429,
  code: "credit_balance_exhausted",
});

describe("clasificarFalloRecuperacion", () => {
  it("crédito agotado de Google (402) y de OpenAI (429 con credit_balance_exhausted)", () => {
    expect(clasificarFalloRecuperacion(GOOGLE_SIN_CREDITO).causa).toBe("sin_credito");
    expect(clasificarFalloRecuperacion(OPENAI_SIN_CREDITO).causa).toBe("sin_credito");
  });

  it("un 429 de ritmo NO es falta de crédito: se recupera solo", () => {
    expect(clasificarFalloRecuperacion(Object.assign(new Error("Rate limit reached for requests"), { status: 429 })).causa).toBe("limite_peticiones");
  });

  it("la cuota mensual del usuario", () => {
    const error = new Error("Alcanzaste tu límite mensual de uso de IA.");
    error.name = "CuotaIAAgotadaError";
    expect(clasificarFalloRecuperacion(error).causa).toBe("cuota_usuario");
  });

  it("clave ausente o rechazada del proveedor de embeddings", () => {
    expect(clasificarFalloRecuperacion(new Error("Falta GOOGLE_API_KEY para los embeddings de Google")).causa).toBe("clave");
    expect(clasificarFalloRecuperacion(Object.assign(new Error("Incorrect API key provided"), { status: 401 })).causa).toBe("clave");
  });

  it("un 401 de Pinecone o de Supabase es de SU clave, no la de embeddings", () => {
    expect(clasificarFalloRecuperacion(new Error("Pinecone search 401: unauthorized")).causa).toBe("indice_vectorial");
    expect(clasificarFalloRecuperacion(new Error("Supabase REST 401: JWT expired")).causa).toBe("base_de_datos");
  });

  it("red y tiempo de espera; lo desconocido no se inventa", () => {
    expect(clasificarFalloRecuperacion(new TypeError("fetch failed")).causa).toBe("red");
    expect(clasificarFalloRecuperacion(new Error("algo raro")).causa).toBe("desconocida");
    expect(clasificarFalloRecuperacion(undefined).causa).toBe("desconocida");
  });
});

describe("advertenciaRecuperacionParcial", () => {
  it("nombra la vía caída y su causa, y la que sigue funcionando", () => {
    const texto = advertenciaRecuperacionParcial({ semantic: clasificarFalloRecuperacion(GOOGLE_SIN_CREDITO) });
    expect(texto).toContain("la búsqueda por significado no estuvo disponible");
    expect(texto).toContain("el proveedor de embeddings no tiene crédito");
    expect(texto).toContain("Se usó solo la búsqueda por palabras");
  });

  it("con las dos vías caídas las nombra a ambas", () => {
    const texto = advertenciaRecuperacionParcial({
      semantic: clasificarFalloRecuperacion(GOOGLE_SIN_CREDITO),
      lexical: clasificarFalloRecuperacion(new Error("Supabase REST 500: boom")),
    });
    expect(texto).toContain("por significado");
    expect(texto).toContain("por palabras");
    expect(texto).toContain("la base de datos no respondió");
  });

  it("no filtra el texto del proveedor (ni ids ni rutas)", () => {
    const texto = advertenciaRecuperacionParcial({ semantic: clasificarFalloRecuperacion(GOOGLE_SIN_CREDITO) });
    expect(texto).not.toMatch(/AI Studio|RESOURCE_EXHAUSTED|402|prepayment/);
  });

  it("sin información de causa conserva el aviso genérico", () => {
    expect(advertenciaRecuperacionParcial({})).toContain("una de las vías de búsqueda no estuvo disponible");
  });

  it("sigue mostrándose en la tarjeta de la respuesta (materialWarnings)", () => {
    const texto = advertenciaRecuperacionParcial({ semantic: clasificarFalloRecuperacion(GOOGLE_SIN_CREDITO) });
    expect(materialWarnings([texto])).toEqual([texto]);
  });
});

describe("detalleParaLog", () => {
  it("lleva la vía, la causa y un extracto acotado del error", () => {
    const log = detalleParaLog("semantic", new Error("x".repeat(1000)));
    expect(log).toMatch(/^\[recuperacion\] vía semantic caída: desconocida · x+$/);
    expect(log.length).toBeLessThan(260);
  });
});
