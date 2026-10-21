import { beforeEach, expect, it, vi } from "vitest";
import type { ExpedienteArchivo } from "../lib/expedientes-archivo";
const mocks = vi.hoisted(() => ({ rest: vi.fn(), block: vi.fn(), publish: vi.fn(), download: vi.fn() }));
vi.mock("../lib/supabase-server", () => ({ supabaseRest: mocks.rest, downloadStorageObject: mocks.download }));
vi.mock("../lib/pdf-processing", () => ({ extractPdfOcrBlock: mocks.block }));
vi.mock("../lib/expedientes-archivo-processing", () => ({ processExpedienteDocument: mocks.publish }));
import { advanceRagDocument } from "../lib/archivo-rag-worker";
const row = { id: "doc", status: "uploaded", updated_at: "2020-01-01", metadata: { uploadSource: "rag-folder" }, storage_bucket: "bucket", storage_path: "path", file_name: "a.pdf" } as unknown as ExpedienteArchivo;
const block = (start: number) => ({ extractionMethod: "openai-ocr", pages: [start, start+1, start+2].map(pageNumber => ({ pageNumber, text: "texto" })), pageCount: 6, text: "texto", ocrPartial: start === 1 });
beforeEach(() => { vi.resetAllMocks(); mocks.download.mockResolvedValue(new Blob(["pdf"])); mocks.block.mockResolvedValue(block(1)); });
it("no hace OCR si otra petición ganó la reserva", async () => {
  mocks.rest.mockResolvedValue([]); await advanceRagDocument(row);
  expect(mocks.block).not.toHaveBeenCalled(); expect(mocks.download).not.toHaveBeenCalled();
});
it("guarda un bloque sin publicar un índice incompleto", async () => {
  mocks.rest.mockImplementation(async (path: string, init?: RequestInit) => path.includes("select=*") ? [row] : init?.method === "POST" ? undefined : []);
  await advanceRagDocument(row);
  expect(mocks.block).toHaveBeenCalledOnce(); expect(mocks.publish).not.toHaveBeenCalled();
  const last = JSON.parse(mocks.rest.mock.calls.at(-1)![1].body);
  expect(last).toMatchObject({ status: "uploaded", metadata: { ragPagesDone: 3, pageCount: 6, ocrPartial: true } });
});
it("reanuda desde páginas 4 a 6 sin repetir el bloque guardado", async () => {
  let read = 0;
  mocks.rest.mockImplementation(async (path: string) => path.includes("select=*") ? [row] : path.includes("select=extracted") ? (++read === 1 ? [{ extracted: block(1) }] : []) : undefined);
  mocks.block.mockResolvedValue(block(4)); await advanceRagDocument(row);
  expect(mocks.block).toHaveBeenCalledWith(expect.any(File), 4);
  expect(mocks.publish).not.toHaveBeenCalled();
});
it("publica todas las páginas originales cuando la caché está completa", async () => {
  let read = 0;
  mocks.rest.mockImplementation(async (path: string) => path.includes("select=*") ? [row] : [{ extracted: block(++read === 1 ? 1 : 4) }]);
  await advanceRagDocument(row);
  expect(mocks.block).not.toHaveBeenCalled();
  expect(mocks.publish.mock.calls[0][2]).toMatchObject({ pageCount: 6, ocrPartial: false });
  expect(mocks.publish.mock.calls[0][2].pages.map((p: { pageNumber: number }) => p.pageNumber)).toEqual([1,2,3,4,5,6]);
});
