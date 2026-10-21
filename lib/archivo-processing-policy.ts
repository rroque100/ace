export const ARCHIVO_LEASE_MS = 10 * 60_000;
export const ARCHIVO_PENDING_MS = 120_000;

export function archivoNeedsRecovery(row: { status: string; updated_at?: string }, now = Date.now()) {
  const updated = Date.parse(row.updated_at ?? "");
  if (!Number.isFinite(updated)) return false;
  return row.status === "error" ||
    (row.status === "uploaded" && now - updated > ARCHIVO_PENDING_MS) ||
    (row.status === "processing" && now - updated > ARCHIVO_LEASE_MS);
}
