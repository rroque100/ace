import { createHmac, timingSafeEqual } from "node:crypto";

export type UploadTicket = { userId: string; path: string; name: string; size: number; expires: number };
export function signUploadTicket(data: UploadTicket, secret: string) {
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}
export function verifyUploadTicket(ticket: string, userId: string, secret: string): UploadTicket {
  const [body, signature, extra] = ticket.split(".");
  const expected = createHmac("sha256", secret).update(body || "").digest();
  const actual = Buffer.from(signature || "", "base64url");
  if (extra || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("Referencia de archivo inválida");
  const data = JSON.parse(Buffer.from(body, "base64url").toString()) as UploadTicket;
  if (data.userId !== userId || data.expires <= Date.now() || !data.path.startsWith(`archivo-temp/${userId}/`)) throw new Error("Referencia de archivo vencida o no autorizada");
  return data;
}
