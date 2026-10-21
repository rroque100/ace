import { beforeEach, expect, it, vi } from "vitest";
import type { ExpedienteArchivo } from "../lib/expedientes-archivo";
const rest = vi.hoisted(() => vi.fn());
vi.mock("../lib/supabase-server", () => ({ supabaseRest: rest }));
import { archivoNeedsRecovery, claimArchivoProcessing } from "../lib/archivo-processing-lease";
beforeEach(() => vi.resetAllMocks());
it("no trata una creación antigua como procesamiento atascado", () => {
  expect(archivoNeedsRecovery({ status: "processing", updated_at: new Date().toISOString() })).toBe(false);
  expect(archivoNeedsRecovery({ status: "processing", updated_at: new Date(Date.now() - 11 * 60_000).toISOString() })).toBe(true);
  expect(archivoNeedsRecovery({ status: "uploaded" })).toBe(false);
});
it("rechaza un procesamiento activo sin escribir", async () => {
  await expect(claimArchivoProcessing({ status: "processing", updated_at: new Date().toISOString() } as ExpedienteArchivo)).rejects.toThrow("ya está");
  expect(rest).not.toHaveBeenCalled();
});
it("solo una reserva concurrente gana el CAS", async () => {
  const row = { id: "doc", status: "uploaded", updated_at: "2020-01-01" } as ExpedienteArchivo;
  rest.mockResolvedValueOnce([{ ...row, status: "processing" }]).mockResolvedValueOnce([]);
  const results = await Promise.allSettled([claimArchivoProcessing(row), claimArchivoProcessing(row)]);
  expect(results.map(r => r.status)).toEqual(["fulfilled", "rejected"]);
  expect(rest.mock.calls[0][0]).toContain("updated_at=eq.2020-01-01");
});
