// Historial de conversación que se entrega al modelo. Antes se leían solo 6
// turnos enteros: en conversaciones largas el modelo perdía el hilo (régimen,
// objeto, fecha) y los seguimientos («¿y en mi caso?») volvían a pedir lo que
// la sesión ya había dado. Ahora se recuperan más turnos y se COMPACTAN los
// viejos en vez de descartarlos: lo reciente entra casi entero y lo antiguo
// entra recortado, dentro de un presupuesto total de caracteres.
//
// Módulo puro (sin red ni BD) para poder probar el recorte con Vitest.

export type HistoryTurn = { role: "user" | "assistant" | "system"; content: string };

/** Turnos recientes que se conservan casi completos. */
const TURNOS_COMPLETOS = 8;
/** Tope de caracteres por turno reciente (las respuestas traen pies de fuentes largos). */
const TOPE_RECIENTE = 1600;
/** Tope de caracteres por turno antiguo compactado. */
const TOPE_ANTIGUO = 420;
/** Presupuesto total del bloque de historial: pasado esto se sueltan turnos desde el más viejo. */
const PRESUPUESTO_TOTAL = 14000;

function etiqueta(role: HistoryTurn["role"]) {
  return role === "user" ? "Usuario" : role === "assistant" ? "Asistente" : "Sistema";
}

function recortar(text: string, tope: number) {
  const limpio = text.trim();
  if (limpio.length <= tope) return limpio;
  return `${limpio.slice(0, tope)}… (texto recortado por longitud)`;
}

/**
 * Historial compactado para el prompt: los últimos `TURNOS_COMPLETOS` turnos
 van casi enteros; los anteriores entran muy recortados (mantienen régimen,
 * fechas y objeto, que es lo que un seguimiento necesita). Si el total supera
 * el presupuesto, se descartan primero los turnos antiguos recortados.
 */
export function compactHistoryForPrompt(messages: HistoryTurn[]): string {
  const turnos = messages.filter((message) => message.role === "user" || message.role === "assistant");
  if (turnos.length === 0) return "Sin historial previo en esta sesion.";

  const recientes = turnos.slice(-TURNOS_COMPLETOS).map((message) => ({
    contenido: recortar(message.content, TOPE_RECIENTE),
    role: message.role,
  }));
  const antiguos = turnos.slice(0, -TURNOS_COMPLETOS).map((message) => ({
    contenido: recortar(message.content, TOPE_ANTIGUO),
    role: message.role,
  }));

  let presupuesto = PRESUPUESTO_TOTAL - recientes.reduce((total, message) => total + message.contenido.length, 0);
  const antiguosQueEntran: Array<{ contenido: string; role: HistoryTurn["role"] }> = [];
  // Del más reciente al más viejo: si hay que soltar algo, se suelta lo más viejo.
  for (let index = antiguos.length - 1; index >= 0; index -= 1) {
    const mensaje = antiguos[index];
    if (presupuesto - mensaje.contenido.length < 0) break;
    presupuesto -= mensaje.contenido.length;
    antiguosQueEntran.unshift(mensaje);
  }

  const render = (message: { contenido: string; role: HistoryTurn["role"] }) =>
    `${etiqueta(message.role)}: ${message.contenido}`;

  return [...antiguosQueEntran, ...recientes].map(render).join("\n\n");
}
