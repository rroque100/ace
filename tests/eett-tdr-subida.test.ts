import { afterEach, describe, expect, it, vi } from "vitest";
import { signUploadTicket, verifyUploadTicket } from "../lib/archivo-upload-ticket";
import { leerRespuesta, subirEettTdr } from "../lib/eett-tdr-subida-cliente";
import { prefijoEettTdr, tipoFicheroEett } from "../lib/eett-tdr-subida";

afterEach(() => vi.unstubAllGlobals());

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("subida del EETT/TDR sin pasar el fichero por la función", () => {
  it("sube el fichero directo a Storage y al servidor solo le manda la referencia", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(200, { url: "https://storage.example/firmada", ticket: "firmado" }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(json(202, { document: { id: "d1", tipo: "tdr", file_name: "tdr.pdf" }, text: "hola" }));
    vi.stubGlobal("fetch", fetcher);
    // 6 MB: por encima del límite de 4,5 MB de Vercel que provocaba el fallo.
    const file = new File([new Uint8Array(6 * 1024 * 1024)], "tdr.pdf", { type: "application/pdf" });

    const res = await subirEettTdr("n1", file, "tdr");

    expect(res.document.id).toBe("d1");
    expect(fetcher.mock.calls[0][0]).toBe("/api/necesidades/n1/eett-tdr/subida");
    expect(fetcher.mock.calls[1][0]).toBe("https://storage.example/firmada");
    expect(fetcher.mock.calls[1][1].body).toBe(file);
    const fd = fetcher.mock.calls[2][1].body as FormData;
    expect(fd.has("file")).toBe(false);
    expect(fd.get("uploadTicket")).toBe("firmado");
    expect(fd.get("tipo")).toBe("tdr");
  });

  it("deduce el mime de un .docx cuando el navegador no lo informa", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(200, { url: "https://s/u", ticket: "t" }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(json(202, { document: { id: "d", tipo: "eett", file_name: "e.docx" } }));
    vi.stubGlobal("fetch", fetcher);
    await subirEettTdr("n1", new File(["x"], "e.docx", { type: "" }), "eett");
    expect(fetcher.mock.calls[1][1].headers["Content-Type"]).toMatch(/wordprocessingml/);
  });
});

describe("lectura de respuestas", () => {
  it("un 413 en texto plano de la plataforma se explica como tamaño, no como conexión", async () => {
    const res = new Response("Request Entity Too Large\n\nFUNCTION_PAYLOAD_TOO_LARGE", { status: 413 });
    await expect(leerRespuesta(res, "x")).rejects.toThrow(/demasiado grande/);
  });
  it("un 504 se explica como tiempo de lectura", async () => {
    await expect(leerRespuesta(new Response("timeout", { status: 504 }), "x")).rejects.toThrow(/tardó demasiado/);
  });
  it("prefiere el mensaje que manda la ruta", async () => {
    await expect(leerRespuesta(json(400, { error: "Solo PDF" }), "x")).rejects.toThrow("Solo PDF");
  });
});

describe("referencia firmada del EETT/TDR", () => {
  const data = {
    userId: "alice",
    path: `${prefijoEettTdr("alice")}2026/11/u-tdr.pdf`,
    name: "tdr.pdf",
    size: 10,
    expires: Date.now() + 100000,
  };
  it("solo vale para la carpeta del EETT/TDR del propio usuario", () => {
    const t = signUploadTicket(data, "s");
    expect(verifyUploadTicket(t, "alice", "s", prefijoEettTdr("alice"))).toEqual(data);
    // Una referencia de este módulo no sirve en el archivo de expedientes.
    expect(() => verifyUploadTicket(t, "alice", "s")).toThrow();
    expect(() => verifyUploadTicket(t, "bob", "s", prefijoEettTdr("bob"))).toThrow();
  });
  it("rechaza rutas que intentan salir de la carpeta", () => {
    const t = signUploadTicket({ ...data, path: `${prefijoEettTdr("alice")}../otro/x.pdf` }, "s");
    expect(() => verifyUploadTicket(t, "alice", "s", prefijoEettTdr("alice"))).toThrow();
  });
  it("clasifica PDF y Word por mime o extensión", () => {
    expect(tipoFicheroEett("a.PDF", "")).toBe("pdf");
    expect(tipoFicheroEett("a.docx", "")).toBe("docx");
    expect(tipoFicheroEett("a.doc", "application/msword")).toBeNull();
  });
});
