// Banco de regresión del chat jurídico (preguntas de oro).
//
// Corre cada caso de docs/evaluaciones/chat-juridico/preguntas-oro.json contra el pipeline REAL de respuesta
// (recuperación + modelo + verificación de citas) y comprueba lo que la respuesta debe cumplir. No escribe en
// la base de datos ni guarda conversaciones (persist: false); solo lee el corpus y llama a los proveedores.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/evaluar-chat-oro.mts [--solo id1,id2] [--grupo nombre] [--salida informe.json]
//
// Sale con código 1 si algún caso falla, para poder usarlo como comprobación antes de dar un cambio por bueno.
// El modelo varía entre ejecuciones: por eso se comprueba conducta (qué ley rige, qué fuentes entran, cuándo se
// pide contexto), no texto exacto. Un caso que falla de forma intermitente es una señal, no un ruido a ignorar.

import { readFileSync, writeFileSync } from "node:fs";
import { answerLegalQuestion, chatRequestSchema } from "@/lib/legal-chat";
import { checkCitationFaithfulness } from "@/lib/citation-faithfulness";
import { detectGroundingViolations } from "@/lib/eval-grounding";
import { caseSearchQuery } from "@/lib/chat-case-context";
import { resolveFollowUp } from "@/lib/legal-document-reference";

type Fuente = { documentType?: string; article?: string; titleIncludes?: string };
type Caso = {
  id: string; grupo: string; pregunta: string;
  contextoCaso?: { regime?: string; dates?: string; facts?: string; object?: string };
  /** Turnos previos de la conversación: sirve para probar seguimientos («¿y si fue en 2024?»). */
  historial?: Array<{ role: "user" | "assistant"; content: string }>;
  contiene?: string[]; contieneAlguno?: string[]; noContiene?: string[]; fuentes?: Fuente[]; sinFuentes?: boolean;
  /** Acierta unas veces y otras no (depende de qué recupera el buscador y de qué afirmaciones respalda la revisión): se informa como AVISO y no hace fallar la ejecución. */
  intermitente?: boolean;
};

const args = process.argv.slice(2);
const opcion = (nombre: string) => { const i = args.indexOf(nombre); return i >= 0 ? args[i + 1] : undefined; };
const solo = opcion("--solo")?.split(",").map((id) => id.trim());
const grupo = opcion("--grupo");
const salida = opcion("--salida");

const plano = (texto: string) => texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const { casos } = JSON.parse(readFileSync("docs/evaluaciones/chat-juridico/preguntas-oro.json", "utf8")) as { casos: Caso[] };
const elegidos = casos.filter((caso) => (!solo || solo.includes(caso.id)) && (!grupo || caso.grupo === grupo));
if (!elegidos.length) { console.error("Ningún caso coincide con el filtro."); process.exit(2); }

function coincide(fuente: { documentType?: string; article?: string | null; documentTitle?: string }, esperada: Fuente) {
  if (esperada.documentType && fuente.documentType !== esperada.documentType) return false;
  if (esperada.article && !plano(fuente.article ?? "").includes(plano(esperada.article))) return false;
  if (esperada.titleIncludes && !plano(fuente.documentTitle ?? "").includes(plano(esperada.titleIncludes))) return false;
  return true;
}

const informe: Array<Record<string, unknown>> = [];
for (const caso of elegidos) {
  const inicio = Date.now();
  const fallos: string[] = [];
  let respuesta = "";
  let nFuentes = 0;
  try {
    const resultado = await answerLegalQuestion(
      chatRequestSchema.parse({ question: caso.pregunta, mode: "tecnica", tone: "formal", length: "media", ...(caso.contextoCaso ? { caseContext: { regime: "", dates: "", facts: "", ...caso.contextoCaso } } : {}) }),
      { accessToken: "", ownerId: "00000000-0000-4000-8000-000000000000", persist: false, role: "admin", ...(caso.historial ? { history: caso.historial } : {}) },
    );
    respuesta = resultado.answer;
    nFuentes = resultado.sources.length;
    const texto = plano(respuesta);
    for (const frase of caso.contiene ?? []) if (!texto.includes(plano(frase))) fallos.push(`Falta «${frase}».`);
    if (caso.contieneAlguno?.length && !caso.contieneAlguno.some((frase) => texto.includes(plano(frase)))) fallos.push(`No contiene ninguna de: ${caso.contieneAlguno.map((f) => `«${f}»`).join(", ")}.`);
    for (const frase of caso.noContiene ?? []) if (texto.includes(plano(frase))) fallos.push(`Contiene «${frase}».`);
    for (const esperada of caso.fuentes ?? []) if (!resultado.sources.some((fuente) => coincide(fuente, esperada))) fallos.push(`Falta la fuente ${JSON.stringify(esperada)}.`);
    if (caso.sinFuentes && nFuentes > 0) fallos.push(`Debía responder sin fuentes y trae ${nFuentes}.`);
    // Lo que no puede fallar nunca, sea cual sea el caso: grounding y fidelidad de las citas.
    // La regla del régimen anterior se juzga con la pregunta COMPLETA que el chat resolvió (seguimiento con su historial, datos del
    // caso): «¿y si fue en 2024?» suelta no dice que se habla de la Ley 30225, pero en la conversación sí.
    const consulta = caseSearchQuery(resolveFollowUp(caso.pregunta, caso.historial ?? []).query, caso.contextoCaso ? { regime: "", dates: "", facts: "", ...caso.contextoCaso } : undefined);
    fallos.push(...detectGroundingViolations(respuesta, nFuentes, [], consulta, resultado.sources.map((fuente) => fuente.excerpt)));
    const fidelidad = checkCitationFaithfulness(respuesta, resultado.sources);
    if (!fidelidad.ok) fallos.push(...fidelidad.issues.map((problema) => `Cita infiel: ${problema.reason}`));
  } catch (error) {
    fallos.push(`Error al responder: ${error instanceof Error ? error.message.slice(0, 160) : String(error)}`);
  }
  const segundos = +((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`${fallos.length ? (caso.intermitente ? "AVISO" : "FALLA") : "ok   "}${caso.id.padEnd(30)} ${String(segundos).padStart(5)} s · ${nFuentes} fuentes${fallos.length ? "\n        - " + fallos.join("\n        - ") : ""}`);
  informe.push({ id: caso.id, grupo: caso.grupo, intermitente: Boolean(caso.intermitente), pasa: fallos.length === 0, fallos, segundos, fuentes: nFuentes, respuesta: respuesta.slice(0, 6000) });
}

const pasan = informe.filter((fila) => fila.pasa).length;
const fallan = informe.filter((fila) => !fila.pasa && !fila.intermitente).length;
const avisos = informe.filter((fila) => !fila.pasa && fila.intermitente).length;
console.log(`\n${pasan}/${informe.length} casos cumplen lo esperado.${avisos ? ` ${avisos} intermitente(s) no cumplieron: es un aviso, no un fallo.` : ""}`);
const porGrupo = new Map<string, [number, number]>();
for (const fila of informe) { const [ok, total] = porGrupo.get(String(fila.grupo)) ?? [0, 0]; porGrupo.set(String(fila.grupo), [ok + (fila.pasa ? 1 : 0), total + 1]); }
for (const [nombre, [ok, total]] of porGrupo) console.log(`  ${nombre.padEnd(24)} ${ok}/${total}`);
if (salida) writeFileSync(salida, JSON.stringify({ creadoEn: new Date().toISOString(), pasan, total: informe.length, casos: informe }, null, 2));
process.exit(fallan === 0 ? 0 : 1);
