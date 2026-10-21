import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), rest: vi.fn(), vector: vi.fn(), pg: vi.fn() }));
vi.mock("../lib/supabase-server", () => ({ supabaseUserRest: mocks.user, supabaseRest: mocks.rest }));
vi.mock("../lib/pinecone", () => ({ searchTextRecords: mocks.vector }));
vi.mock("../lib/expedientes-archivo-vectors", () => ({ buscarVecinosPgvector: mocks.pg }));
import { containsExactNumber, searchArchivoExactNumbers } from "../lib/archivo-exact-search";
import { searchExpedientes } from "../lib/expedientes-archivo-search";
const doc = { id: "doc", title: "CP 2956", serie_documento: "CP002956", sgd_expediente: null, uploaded_by: "owner" };
beforeEach(() => { vi.resetAllMocks(); });
it("distingue 2956 de 12956 y conserva ceros de presentación", () => {
  expect(containsExactNumber("CP12956", "2956")).toBe(false);
  expect(containsExactNumber("CP002956-2022", "2956")).toBe(true);
});
it("encuentra el código fuera de los candidatos semánticos sin llamar a los vectores", async () => {
  mocks.user.mockImplementation(async (_jwt: string, path: string) => path.startsWith("expedientes_archivo?") ? [doc] : [{ id: "chunk", documento_id: "doc", page_start: 1, page_end: 1, chunk_index: 0 }]);
  mocks.rest.mockImplementation(async (path: string) => path.startsWith("expedientes_archivo_chunks") ? [{ id: "chunk", content: "comprobante 2956" }] : [doc]);
  const result = await searchExpedientes({ query: "comprobante nro 2956", accessToken: "jwt", uploadedBy: "owner" });
  expect(result.map(r => r.expedienteId)).toEqual(["doc"]);
  expect(mocks.vector).not.toHaveBeenCalled(); expect(mocks.pg).not.toHaveBeenCalled();
  expect(mocks.user.mock.calls.every(([jwt]) => jwt === "jwt")).toBe(true);
  const params = new URLSearchParams(mocks.user.mock.calls[0][1].split("?")[1]);
  expect(params.get("uploaded_by")).toBe("eq.owner");
});
it("pagina candidatos parecidos y aplica filtros antes de limitar", async () => {
  mocks.user.mockResolvedValueOnce(Array.from({ length: 200 }, (_, i) => ({ ...doc, id: String(i), title: "12956", serie_documento: null })))
    .mockResolvedValueOnce([doc]).mockResolvedValueOnce([{ id: "chunk", documento_id: "doc" }]);
  const hits = await searchArchivoExactNumbers({ query: "2956", accessToken: "jwt", anio: 2022, oficina: "Oficina A", materia: "pagos" }, ["2956"]);
  expect(hits).toHaveLength(1);
  const params = new URLSearchParams(mocks.user.mock.calls[1][1].split("?")[1]);
  expect(params.get("offset")).toBe("200"); expect(params.get("anio")).toBe("eq.2022");
  expect(params.get("oficina")).toContain("Oficina A"); expect(params.get("materia")).toContain("pagos");
});
it("sin coincidencia exacta usa la búsqueda semántica", async () => {
  mocks.user.mockResolvedValue([]); mocks.pg.mockResolvedValue(null); mocks.vector.mockResolvedValue([]);
  expect(await searchExpedientes({ query: "2956", accessToken: "jwt" })).toEqual([]);
  expect(mocks.vector).toHaveBeenCalledOnce();
});
it("no convierte errores de base de datos en ausencia de coincidencias", async () => {
  mocks.user.mockRejectedValue(new Error("database offline"));
  await expect(searchExpedientes({ query: "2956", accessToken: "jwt" })).rejects.toThrow("database offline");
  expect(mocks.vector).not.toHaveBeenCalled();
});
