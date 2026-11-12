import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ search: vi.fn(), rest: vi.fn(), userRest: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/pinecone", () => ({ searchTextRecords: mocks.search, rerankWithModel: async () => null }));
vi.mock("@/lib/openai-server", () => ({ getOpenAIClient: () => ({ responses: { create: mocks.create } }), legalAnswerModel: "test" }));
vi.mock("@/lib/supabase-server", () => ({ supabaseRest: mocks.rest, supabaseUserRest: mocks.userRest, writeAuditLog: async () => {}, institutionalAuditDetails: (x: unknown) => x }));
import { FORMAT_HEADINGS, formatInstruction, formatOutputTokens, formatShowsEverything, type AnswerMode } from "@/lib/chat-answer-format";
import { analyzeAnswerLayout } from "@/lib/chat-answer-layout";
import { auditEvidence } from "@/lib/chat-evidence-audit";
import { publishEvidence } from "@/lib/chat-evidence-publication";
import { answerLegalQuestion, chatRequestSchema, clearLexicalCache } from "@/lib/legal-chat";

const modos: AnswerMode[] = ["breve", "tecnica", "informe", "checklist"];

describe("qué le pide cada formato al modelo", () => {
  it("«tecnica» es la respuesta de siempre; los demás añaden su instrucción", () => {
    expect(formatInstruction("tecnica")).toBe("");
    for (const modo of modos.filter((m) => m !== "tecnica")) expect(formatInstruction(modo), modo).toMatch(/prevalece/);
  });

  it("la lista pide puntos numerados que AFIRMAN la regla con su cita, no órdenes", () => {
    const texto = formatInstruction("checklist");
    expect(texto).toContain("**Lista de verificación**");
    expect(texto).toMatch(/lista numerada/);
    expect(texto).toMatch(/\[F#\]/);
    expect(texto).toMatch(/No escribas órdenes/);
  });

  it("el informe pide sus cuatro encabezados en orden", () => {
    const texto = formatInstruction("informe");
    const posiciones = FORMAT_HEADINGS.informe.map((encabezado) => texto.indexOf(`**${encabezado}**`));
    expect(posiciones.every((posicion) => posicion >= 0)).toBe(true);
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones);
  });

  it("los encabezados de los formatos se muestran como títulos, no se auditan como afirmaciones", () => {
    for (const encabezado of [...FORMAT_HEADINGS.informe, ...FORMAT_HEADINGS.checklist]) {
      const { nodes, claims } = analyzeAnswerLayout(`**${encabezado}**\nLa comisión sintética se calcula sobre el importe [F1]`);
      expect(nodes[0], encabezado).toMatchObject({ kind: "heading", text: encabezado });
      expect(claims).toHaveLength(1);
    }
  });

  it("cuánto puede escribir: el informe y la lista tienen sitio aunque la longitud sea concisa", () => {
    expect(formatOutputTokens("tecnica", "concisa")).toBe(600);
    expect(formatOutputTokens("tecnica", "media")).toBe(1300);
    expect(formatOutputTokens("tecnica", "detallada")).toBe(2400);
    expect(formatOutputTokens("breve", "detallada")).toBe(600);
    expect(formatOutputTokens("informe", "concisa")).toBe(2400);
    expect(formatOutputTokens("checklist", "concisa")).toBe(1600);
    expect(formatOutputTokens("checklist", "detallada")).toBe(2400);
  });

  it("solo la lista y el informe se publican enteros, sin plegar", () => {
    expect(modos.filter(formatShowsEverything)).toEqual(["informe", "checklist"]);
  });
});

// Texto ficticio: aquí no se codifica ninguna regla de contratación pública.
const contenido = "Artículo 7. La comisión sintética se calcula sobre el importe original de prueba. La comisión sintética puede reducirse cuando el expediente de prueba se cierra. La oficina sintética revisa el expediente antes del cierre.";
describe("el formato elegido llega a la generación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearLexicalCache();
    mocks.search.mockResolvedValue([{ _id: "vector", _score: 0.95 }]);
    mocks.rest.mockResolvedValue([{ id: "chunk", document_id: "doc", chunk_index: 0, pinecone_vector_id: "vector", page_start: 2, page_end: 2, content: contenido, metadata: { article: "7" },
      documents: { id: "doc", title: "Reglamento sintético", document_type: "reglamento", source_entity: "OECE", file_name: "r.pdf", status: "indexed", metadata: { vigencia: "vigente" } } }]);
    mocks.userRest.mockResolvedValue([]);
    mocks.create.mockResolvedValue({ output_text: "La comisión sintética se calcula sobre el importe original de prueba [F1]" });
  });
  const generacion = () => mocks.create.mock.calls.map(([params]) => params as { input: Array<{ content: string }>; max_output_tokens: number })
    .find((params) => params.input?.[1]?.content?.includes("Fuentes recuperadas:"))!;

  for (const [modo, marca, tokens] of [["checklist", "LISTA DE VERIFICACIÓN", 1600], ["informe", "Formato INFORME", 2400], ["breve", "Formato BREVE", 600]] as const) {
    it(`«${modo}»: la instrucción va en el mensaje y el límite de salida cambia`, async () => {
      await answerLegalQuestion(chatRequestSchema.parse({ question: "¿Cómo se calcula la comisión sintética del expediente de prueba?", mode: modo, length: "concisa" }), { ownerId: "alice", accessToken: "jwt", persist: false });
      expect(generacion().input[1].content).toContain(marca);
      expect(generacion().max_output_tokens).toBe(tokens);
    });
  }

  it("sin formato elegido («tecnica») el mensaje no lleva instrucción de formato", async () => {
    await answerLegalQuestion(chatRequestSchema.parse({ question: "¿Cómo se calcula la comisión sintética del expediente de prueba?" }), { ownerId: "alice", accessToken: "jwt", persist: false });
    expect(generacion().input[1].content).not.toMatch(/Formato (?:BREVE|INFORME|LISTA)/);
    expect(generacion().max_output_tokens).toBe(1300);
  });
});

describe("el informe se publica entero", () => {
  const fuentes = [{ documentTitle: "Reglamento sintético", article: "7", pageStart: 2, pageEnd: 2, excerpt: contenido }];
  const frases = ["La comisión sintética se calcula sobre el importe original de prueba", "La comisión sintética puede reducirse cuando el expediente de prueba se cierra", "La oficina sintética revisa el expediente antes del cierre"];
  const informe = `**Resumen**\n${frases[0]} [F1]\n**Fundamento legal**\n${frases[1]} [F1]\n**Análisis**\n${frases[2]} [F1]\n**Conclusión**\n${frases[0]} [F1]`;
  const aprueba = async (_system: string, input: string) => JSON.stringify({ claims: (JSON.parse(input).claims as Array<{ id: number }>).map((claim) => ({ id: claim.id, status: "supported", reason: "Coincide", evidence: [{ source: 1, passage: 1 }] })) });

  it("con el formato informe las cuatro secciones quedan a la vista, en orden", async () => {
    const revision = await auditEvidence(informe, fuentes, undefined, aprueba);
    const publicada = publishEvidence(informe, fuentes, revision, "¿Cómo se calcula la comisión sintética?", undefined, { everything: true });
    const posiciones = ["**Resumen**", "**Fundamento legal**", "**Análisis**", "**Conclusión**"].map((encabezado) => publicada.indexOf(encabezado));
    expect(posiciones.every((posicion) => posicion >= 0), publicada).toBe(true);
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones);
    expect(revision.presentation).toBe("verified");
  });

  it("sin la opción, una respuesta normal sigue plegando lo que no es el primer bloque", async () => {
    const revision = await auditEvidence(informe, fuentes, undefined, aprueba);
    const plegada = publishEvidence(informe, fuentes, revision, "¿Cómo se calcula la comisión sintética?");
    const entera = publishEvidence(informe, fuentes, await auditEvidence(informe, fuentes, undefined, aprueba), "¿Cómo se calcula la comisión sintética?", undefined, { everything: true });
    expect(plegada).not.toBe(entera);
  });
});
