/** Keep device acquisition failures distinct from recorder/encoding failures. */
export function voiceCaptureError(failure: unknown, stage: "microphone" | "recorder"): string {
  const name = typeof failure === "object" && failure !== null && "name" in failure ? String(failure.name) : "";
  const code = name ? ` (${name})` : "";
  if (stage === "recorder") return `El micrófono se abrió, pero el navegador no pudo iniciar la grabación${code}. Actualiza Chrome o Edge y vuelve a intentarlo.`;
  if (name === "NotAllowedError" || name === "SecurityError") return `El acceso al micrófono está bloqueado${code}. En Chrome, abre el icono junto a la dirección, permite Micrófono y recarga. En Windows, revisa Configuración > Privacidad y seguridad > Micrófono y permite el acceso a las aplicaciones de escritorio.`;
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return `No se encontró un micrófono${code}. Conéctalo y comprueba que aparezca en Windows > Configuración > Sistema > Sonido > Entrada.`;
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return `El navegador no pudo usar el micrófono${code}. Comprueba que funcione en Windows > Sistema > Sonido > Entrada, cierra otras aplicaciones que puedan estar usándolo y vuelve a intentar.`;
  if (name === "OverconstrainedError") return `El micrófono no admite la configuración solicitada${code}. Prueba otro dispositivo de entrada en la configuración del navegador.`;
  return `No se pudo acceder al micrófono${code}. Comprueba los permisos del navegador y de Windows, y el dispositivo de entrada. Puedes continuar por escrito.`;
}

export async function acquireVoiceStream(devices: Pick<MediaDevices, "getUserMedia">): Promise<MediaStream> {
  try {
    return await devices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (error) {
    // Retry only rejected constraints, never denied permissions or a busy/missing device.
    if (typeof error === "object" && error !== null && "name" in error && error.name === "OverconstrainedError") return devices.getUserMedia({ audio: true });
    throw error;
  }
}
