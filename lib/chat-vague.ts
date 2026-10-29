// Preguntas que piden ayuda sin decir sobre qué («no sé qué hacer con mi contrato», «necesito ayuda con una
// compra», «hola»). Hoy reciben un ensayo genérico del primer contrato o proceso que la recuperación
// encuentra («los contratos son aquellos celebrados entre una entidad y un proveedor…»), que no responde a
// nada y da la falsa impresión de haber contestado. Lo útil es pedir lo mínimo para poder citar la norma
// que corresponde. Módulo puro: la decisión es por la FORMA de la pregunta, nunca por su tema.

import { questionWords, strongQuestionWords } from "./legal-document-reference";

// El marco de quien pide ayuda, sin objeto: el problema es que NO dice de qué se trata.
const HELP_FRAME = [
  /\b(?:ayuda|ayudame|ayudenme|ayudar|auxilio)\b/,
  /\bno se (?:que|como|por donde|cual|donde)\b/,
  /\bque (?:hago|puedo hacer|debo hacer|se hace|hacer)\b/,
  /\btengo (?:un|una) (?:problema|duda|consulta|pregunta|caso|situacion|inconveniente)\b/,
  /\b(?:quiero|quisiera|necesito) (?:saber|consultar|preguntar|informacion)\b/,
  /^(?:hola|buenas|buenos dias|buenas tardes|buenas noches)\b/,
];

// Palabras del marco y términos tan amplios que no acotan nada: con ellas solas, aún no se sabe qué se
// necesita. («penalidad», «garantía» o «plazo» sí acotan, y no están aquí.)
const FILLER = new Set(
  ("ayuda ayudame ayudenme ayudar auxilio hacer hago problema problemas duda dudas consulta consultas pregunta preguntas informacion info saber " +
    "necesito quiero quisiera tengo puedo debo empezar empiezo comenzar comienzo favor hola buenas buenos dias tardes noches gracias algo cosa cosas situacion tema inconveniente " +
    "contrato contratos compra compras proceso procesos procedimiento procedimientos entidad contratista proveedor adquisicion adquisiciones " +
    "mi mis nuestro nuestra nuestros nuestras ustedes ustedes").split(" "),
);

/** ¿Pide ayuda sin decir sobre qué? Cuanto más corta y menos concreta, más probable. */
export function isVagueQuestion(question: string): boolean {
  const tokens = questionWords(question);
  if (!tokens.length || tokens.length > 12) return false;
  const text = tokens.join(" ");
  if (!HELP_FRAME.some((pattern) => pattern.test(text))) return false;
  // Si queda alguna palabra con tema propio («penalidad», «mora», «entregó»), ya dice de qué se trata.
  return strongQuestionWords(tokens).filter((word) => !FILLER.has(word)).length === 0;
}

/** Respuesta fija: no cita normas ni afirma nada jurídico, solo pide lo que hace falta. */
export function vagueQuestionAnswer(): string {
  return (
    "**Necesito un poco más de contexto**\n" +
    "Con lo que indicas todavía no puedo ubicar la norma que corresponde, y prefiero no darte una respuesta genérica que no sea la tuya. Cuéntame:\n\n" +
    "1. **Qué quieres resolver**: por ejemplo una penalidad, una garantía, un plazo, una modificación del contrato o un requisito del requerimiento.\n" +
    "2. **Qué se contrata**: bienes, servicios, obras o consultoría.\n" +
    "3. **En qué etapa estás**: requerimiento, selección, ejecución del contrato o pagos.\n" +
    "4. **Cuándo se convocó el procedimiento**, para saber qué ley le corresponde.\n\n" +
    "Puedes escribirlo en tu pregunta o completar «Añadir datos del caso», debajo de la caja de pregunta."
  );
}
