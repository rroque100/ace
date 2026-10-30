import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rest: vi.fn(), embed: vi.fn() }));
vi.mock("../lib/supabase-server", () => ({ supabaseUserRest: mocks.rest }));
vi.mock("../lib/embeddings", () => ({ embedTexts: mocks.embed }));
import { buscarVecinosPgvector } from "../lib/expedientes-archivo-vectors";
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("EXPEDIENTES_VECTOR_READ", "pgvector"); mocks.embed.mockResolvedValue([[1, 2]]); });
afterEach(() => vi.unstubAllEnvs());
it("conserva Pinecone hasta activar expresamente pgvector", async () => {
  vi.stubEnv("EXPEDIENTES_VECTOR_READ", "pinecone");
  expect(await buscarVecinosPgvector("jwt", "consulta", 8, {})).toBeNull();
  expect(mocks.rest).not.toHaveBeenCalled(); expect(mocks.embed).not.toHaveBeenCalled();
});
it("una migración parcial conserva todos los resultados del índice anterior", async () => {
  mocks.rest.mockResolvedValueOnce([{ id: "chunk-without-embedding" }]);
  expect(await buscarVecinosPgvector("jwt", "consulta", 8, {})).toBeNull();
  expect(mocks.embed).not.toHaveBeenCalled();
});
it("una búsqueda vacía en un índice completo es un resultado válido", async () => {
  mocks.rest.mockResolvedValue([]);
  expect(await buscarVecinosPgvector("jwt", "consulta", 8, {})).toEqual([]);
  expect(mocks.rest.mock.calls[1][1]).toBe("rpc/expedientes_buscar_vecinos");
});
it("propaga errores reales aunque el mensaje contenga el nombre del RPC", async () => {
  mocks.rest.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("permission denied expedientes_buscar_vecinos"));
  await expect(buscarVecinosPgvector("jwt", "consulta", 8, {})).rejects.toThrow("permission denied");
});
it("tolera la columna pendiente de migración", async () => {
  mocks.rest.mockRejectedValue(new Error('42703 column embedding does not exist'));
  expect(await buscarVecinosPgvector("jwt", "consulta", 8, {})).toBeNull();
});
