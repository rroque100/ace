import { z } from "zod";
export const ENTITY_ROLES = ["issuer", "requester", "contracting"] as const;
export function isValidRuc(value: string) {
  if (!/^(10|15|16|17|20)\d{9}$/.test(value)) return false;
  const sum = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2].reduce(
    (n, w, i) => n + w * Number(value[i]),
    0,
  );
  const check = 11 - (sum % 11);
  return Number(value[10]) === (check === 10 ? 0 : check === 11 ? 1 : check);
}
export const officialEvidenceUrl = z
  .string()
  .url()
  .max(1500)
  .refine((v) => {
    const u = new URL(v);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === "443") &&
      (/(^|\.)gob\.pe$/.test(u.hostname) ||
        /^(www\.)congreso\.gob\.pe$/.test(u.hostname))
    );
  }, "Registra una URL de procedencia oficial en gob.pe.");
export const entityQuerySchema = z.object({
  q: z.string().trim().max(150).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export const entityReviewSchema = z
  .object({
    id: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    name: z.string().trim().min(3).max(250),
    aliases: z.array(z.string().trim().min(2).max(100)).max(12).default([]),
    ruc: z
      .string()
      .refine(
        (v) => v === "" || isValidRuc(v),
        "Comprueba el RUC y su dígito de control.",
      )
      .default(""),
    status: z.enum(["detected", "verified", "rejected"]),
    rucVerified: z.boolean().default(false),
    sourceUrl: officialEvidenceUrl,
    evidence: z.string().trim().min(15).max(3000),
    reason: z.string().trim().min(10).max(1000),
  })
  .refine(
    (d) => !d.rucVerified || Boolean(d.ruc),
    "No se puede verificar un RUC ausente.",
  );
export type DirectoryEntity = {
  id: string;
  name: string;
  aliases: string[];
  ruc: string | null;
  status: "detected" | "verified" | "rejected";
  ruc_verified: boolean;
  source_url: string | null;
  evidence: string;
  revision: number;
  reviewed_at: string | null;
  document_count?: number;
};
