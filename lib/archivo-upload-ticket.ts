import { createHmac, timingSafeEqual } from "node:crypto";

export type UploadTicket = { userId: string; path: string; name: string; size: number; expires: number };
export function signUploadTicket(data: UploadTicket, secret: string) {
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}
/**
 * `prefijo` acota a qué carpeta del bucket puede apuntar la referencia. Por
 * defecto es la temporal del archivo de expedientes; el EETT/TDR de una necesidad
 * usa la suya, para que una referencia emitida para un módulo no sirva en el otro.
 */
export function verifyUploadTicket(
  ticket: string,
  userId: string,
  secret: string,
  prefijo = `archivo-temp/${userId}/`,
): UploadTicket {
  const [body, signature, extra] = ticket.split(".");
  const expected = createHmac("sha256", secret).update(body || "").digest();
  const actual = Buffer.from(signature || "", "base64url");
  if (extra || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("Referencia de archivo inválida");
  const data = JSON.parse(Buffer.from(body, "base64url").toString()) as UploadTicket;
  if (data.userId !== userId || data.expires <= Date.now() || !data.path.startsWith(prefijo) || data.path.includes("..")) throw new Error("Referencia de archivo vencida o no autorizada");
  return data;
}
