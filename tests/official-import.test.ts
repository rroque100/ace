import { afterEach, expect, it, vi } from "vitest";
vi.mock("node:dns/promises",()=>({lookup:vi.fn(async()=>[{address:"8.8.8.8",family:4}])}));
import { downloadOfficialPdf, validateOfficialUrl } from "../lib/official-import/download";
afterEach(()=>vi.unstubAllGlobals());
it.each(["http://www.gob.pe/a.pdf", "https://127.0.0.1/a.pdf", "https://localhost/a.pdf", "https://www.gob.pe.evil.test/a.pdf", "https://u:p@www.gob.pe/a.pdf", "https://www.gob.pe:444/a.pdf"])("rechaza destino no autorizado %s", url => {
  expect(()=>validateOfficialUrl(url)).toThrow();
});
it("admite el CDN oficial sin comodines de dominios",()=>{
  expect(validateOfficialUrl("https://cdn.www.gob.pe/uploads/a.pdf").hostname).toBe("cdn.www.gob.pe");
});
it("valida los bytes PDF y rechaza respuestas HTML",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>new Response("%PDF-1.7 ejemplo")));
  expect((await downloadOfficialPdf("https://cdn.www.gob.pe/a.pdf")).subarray(0,5).toString()).toBe("%PDF-");
  vi.stubGlobal("fetch",vi.fn(async()=>new Response("<html>error</html>")));
  await expect(downloadOfficialPdf("https://cdn.www.gob.pe/a.pdf")).rejects.toThrow("no es PDF");
});
it("no sigue una redirección a un destino no permitido",async()=>{
  const fetchMock=vi.fn(async()=>new Response(null,{status:302,headers:{location:"https://evil.test/a.pdf"}}));
  vi.stubGlobal("fetch",fetchMock);
  await expect(downloadOfficialPdf("https://www.gob.pe/a.pdf")).rejects.toThrow("no autorizado");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("rechaza tamaño declarado excesivo antes de leer el archivo",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>new Response("%PDF-1.7",{headers:{"content-length":String(51*1024*1024)}})));
  await expect(downloadOfficialPdf("https://cdn.www.gob.pe/a.pdf")).rejects.toThrow("50 MiB");
});
