// Preguntas sobre el propio asistente («¿qué sabes hacer?», «¿cómo te uso?», «hola»), no sobre contratación pública.
//
// Buscar en el corpus la respuesta a «¿qué sabes hacer?» no tiene sentido: el chat contestaba «No se obtuvo una conclusión
// respaldada», que es lo primero que ve una persona que abre el chat por primera vez y quiere saber qué le ofrece. Se
// contesta con una guía fija, sin consultar fuentes ni gastar IA (importa a las cuentas con cuota mensual).
//
// Como en `chat-vague.ts`, la decisión es por la FORMA de la pregunta, nunca por su tema: si queda alguna palabra con
// contenido propio («subasta», «penalidad»), se trata como una pregunta de verdad aunque empiece como «cómo funciona».
// Módulo puro: sin red ni base de datos.

import { questionWords, strongQuestionWords } from "./legal-document-reference";

// Marcos de quien pregunta por el asistente. Se comparan sobre el texto normalizado (minúsculas, sin tildes).
const META_FRAME = [
  /\bque (?:sabes|puedes|haces|ofreces|eres|es esto|es ace)\b/,
  /\bpara que (?:sirves|sirve|se usa|puedo usarte|puedo usar)\b/,
  /\bcomo (?:funcionas|funciona esto|funciona ace|te uso|se usa|se utiliza|puedo usarte|puedo usar esto|empiezo a usar)\b/,
  /\bquien eres\b/,
  /\bcomo (?:me puedes|puedes) ayudar\b/,
  /\bque (?:tipo de )?(?:preguntas|consultas) (?:puedo|puedes|se pueden)\b/,
  /\b(?:en que|con que) (?:me )?(?:puedes|podrias) ayud/,
  /^(?:hola|holi|buenas|buenos dias|buenas tardes|buenas noches|saludos|hey)\b/,
];

// Palabras del marco y de la propia conversación con el asistente: no aportan tema.
const FILLER = new Set(
  ("sabes puedes haces hacer ofreces eres sirves sirve funcionas funciona usar uso usarte utiliza utiliza ayudar ayudas ayuda ayudame " +
    "asistente chat ace herramienta aplicacion sistema esto aqui tipo tipos preguntas pregunta consultas consulta empiezo empezar " +
    "hola holi buenas buenos dias tardes noches saludos hey gracias favor podrias podria puedo mi mis tu tus").split(" "),
);

/** ¿Pregunta por el asistente (qué hace, cómo se usa) o solo saluda? */
export function isMetaQuestion(question: string): boolean {
  const tokens = questionWords(question);
  if (!tokens.length || tokens.length > 10) return false;
  const text = tokens.join(" ");
  if (!META_FRAME.some((patron) => patron.test(text))) return false;
  return strongQuestionWords(tokens).filter((palabra) => !FILLER.has(palabra)).length === 0;
}

/**
 * Los ejemplos que se ofrecen en la pantalla inicial del chat y en esta guía. Cada uno ejercita un camino
 * DISTINTO del motor —definición citada, régimen por fecha de convocatoria, aritmética de un plazo,
 * disposición derogatoria, Reglamento más criterio de la OECE—, porque la pantalla inicial solo traía
 * ejemplos de requisitos y nadie descubría el resto. Son preguntas: ninguno afirma un plazo, un porcentaje
 * ni un artículo (lo comprueba tests/chat-meta.test.ts).
 *
 * Los cinco están PROBADOS contra el chat real: un ejemplo que no rinde deja peor la pantalla inicial que
 * no tener ninguno. Al cambiar uno, vuelve a enviarlo antes de darlo por bueno. Dos candidatos se
 * descartaron ahí: «¿qué requisitos tiene una compra por comparación de precios?» y «¿cuándo no se exige la
 * garantía de fiel cumplimiento?» devolvían una definición suelta, porque la auditoría de evidencia recorta
 * las enumeraciones que el modelo no puede sostener fragmento a fragmento. Las preguntas de lista son las
 * que peor salen; las de regla única y las de cálculo, las que mejor.
 */
export const EJEMPLOS_CHAT = [
  "¿Qué es el requerimiento y quién lo elabora?",
  "Mi procedimiento se convocó en junio de 2026, ¿puedo aplicar la Ley 30225?",
  // El año es imprescindible: `extractDates` no reconoce «el 12 de marzo» a secas, así que sin él
  // `detectarCalculoPlazo` no se dispara y el ejemplo devolvía la regla del cómputo sin la fecha.
  "¿Hasta qué fecha vence un plazo de ocho días hábiles contado desde el 12 de marzo de 2026?",
  "¿Qué norma derogó la Ley 30225 y desde cuándo?",
  "¿Qué penalidades se aplican por mora y cómo se calculan?",
] as const;

/** Qué corpus cubre el asistente. Una sola redacción para la guía y la pantalla inicial. */
export const COBERTURA_CHAT =
  "la Ley 32069 y su Reglamento, y la Ley 30225 para los procedimientos convocados antes";

/** Lo que distingue a este asistente de un chat cualquiera. Va en la guía y en la pantalla inicial. */
export const PROMESA_SIN_RESPALDO =
  "Si no encuentro respaldo en las normas disponibles, te lo digo en lugar de inventar una respuesta.";

/**
 * La guía de uso. Es una respuesta fija: no cita normas ni afirma nada jurídico; solo dice qué cubre el chat y cómo
 * preguntar para que la respuesta salga con fuente. Los ejemplos son PREGUNTAS, no respuestas.
 */
export function metaQuestionAnswer(): string {
  return (
    "**Soy el asistente jurídico de ACE**\n" +
    `Respondo dudas sobre contrataciones públicas en el Perú —${COBERTURA_CHAT}—, ` +
    "y te muestro la norma en la que se apoya cada respuesta para que puedas comprobarla.\n\n" +
    "**Puedes preguntarme, por ejemplo:**\n" +
    `${EJEMPLOS_CHAT.map((ejemplo) => `- ${ejemplo}`).join("\n")}\n\n` +
    "**Para una respuesta más precisa**\n" +
    "1. Indica **qué se contrata** (bienes, servicios, obras o consultoría) y **en qué etapa** estás.\n" +
    "2. Di **cuándo se convocó** el procedimiento: de eso depende qué ley se aplica.\n" +
    "3. Si tienes un documento del caso, adjúntalo, o completa «Añadir datos del caso» debajo de la caja de pregunta.\n\n" +
    `${PROMESA_SIN_RESPALDO} ` +
    "También puedes usar **Búsqueda documental** para encontrar normas, opiniones y resoluciones por número o por tema."
  );
}
