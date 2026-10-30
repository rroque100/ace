import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
const hosts = new Set(["www.gob.pe", "cdn.www.gob.pe", "mef.gob.pe", "www.mef.gob.pe", "leyes.congreso.gob.pe", "www.leyes.congreso.gob.pe", "busquedas.elperuano.pe", "diariooficial.elperuano.pe"]);
export function validateOfficialUrl(value: string): URL {
  const url = new URL(value);
  const archivedOsceLaudo=url.hostname==='www.osce.gob.pe'&&url.pathname.startsWith('/descarga/arbitraje/laudos/EXTERNO/')&&url.pathname.toLowerCase().endsWith('.pdf');
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || (!hosts.has(url.hostname)&&!archivedOsceLaudo) || isIP(url.hostname)) throw new Error("Destino no autorizado");
  return url;
}
function publicAddress(ip: string) {
  if (ip.includes(":")) return /^2[0-9a-f]{3}:/i.test(ip);
  const p = ip.split(".").map(Number);
  return !(p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127));
}
export async function downloadOfficialPdf(value: string): Promise<Buffer> {
  const signal = AbortSignal.timeout(45000);
  let url = validateOfficialUrl(value);
  for (let redirect = 0; redirect <= 5; redirect++) {
    const addresses = await lookup(url.hostname, {all:true});
    if (!addresses.length || addresses.some(x => !publicAddress(x.address))) throw new Error("Dirección de red no permitida");
    const response = await fetch(url, {redirect:"manual", signal});
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error("Redirección sin destino");
      url = validateOfficialUrl(new URL(location,url).href); continue;
    }
    if (!response.ok || !response.body) throw new Error(`Descarga HTTP ${response.status}`);
    const max = 50 * 1024 * 1024;
    if (Number(response.headers.get("content-length")) > max) {await response.body.cancel(); throw new Error("PDF supera 50 MiB");}
    const chunks: Buffer[] = []; let size = 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const {done, value:chunk} = await reader.read();
        if (done) break;
        size += chunk.length;
        if (size > max) { await reader.cancel(); throw new Error("PDF supera 50 MiB"); }
        chunks.push(Buffer.from(chunk));
      }
    } finally { reader.releaseLock(); }
    const bytes = Buffer.concat(chunks);
    if (bytes.subarray(0,5).toString() !== "%PDF-") throw new Error("El archivo no es PDF");
    return bytes;
  }
  throw new Error("Demasiadas redirecciones");
}
