import { z } from "zod";
export const syncSettingsSchema = z.object({
  enabled: z.boolean(),
  dailyLimit: z.number().int().min(1).max(100),
});
export const syncSourceSchema = z.object({
  sourceId: z.string().uuid(),
  enabled: z.boolean(),
  documentTypes: z.array(z.string().min(1).max(70)).max(20),
  regimes: z.array(z.enum(["32069", "30225"])).max(2),
  codePrefix: z.enum(["", "TCP-S"]),
});
export function syncListingTypeMatches(type: string | null, allowed: string[]) {
  if (allowed.length === 1 && allowed[0] === "informe_vicio_nulidad")
    return type === "informe_vicio_nulidad";
  return !type || !allowed.length || allowed.includes(type);
}
export function syncCodeMatches(title: string, prefix: string) {
  return !prefix || /TCP\s*[-/]\s*S\s*\d*\b/i.test(title);
}
export function isSyncCreditError(error: string) {
  return /\b402\b|prepayment credits|credits are depleted|créditos.*agotad/i.test(
    error,
  );
}
export function syncQuoteMatches(page: string, quote: string) {
  return (
    quote.trim().length >= 30 &&
    page.replace(/\s+/g, " ").includes(quote.replace(/\s+/g, " ").trim())
  );
}
export function syncPrintedPagesIncomplete(pages: Array<{ text: string }>) {
  const labels = pages.map((p) =>
    p.text.match(/p[aá]gina\s+(\d+)\s+de\s+(\d+)/i),
  );
  if (!labels.length || labels.some((x) => !x)) return false;
  const totals = new Set(labels.map((x) => Number(x![2])));
  return totals.size === 1 && Number(labels[0]![2]) > pages.length;
}
export function syncHistoricalNext(
  source: string,
  next: string | null,
  dates: Array<string | null>,
) {
  if (!next) return null;
  const u = new URL(next);
  if (Number(u.searchParams.get("sheet")) <= 100) return u.href;
  const oldest = dates.filter((d): d is string => Boolean(d)).sort()[0];
  if (!oldest) throw Error("No hay fecha para continuar el intervalo oficial.");
  const root = new URL(source);
  const currentEnd = root.searchParams.get("filter[end_date]");
  if (currentEnd && oldest >= currentEnd)
    throw Error(
      "El intervalo de un día supera el límite del catálogo; requiere revisión.",
    );
  root.searchParams.set("filter[end_date]", oldest);
  root.searchParams.set("filter[order]", "publication_desc");
  root.searchParams.set("filter[per_page]", "100");
  root.searchParams.delete("sheet");
  return root.href;
}
export const syncStateLabels: Record<string, string> = {
  download: "Pendiente de descarga",
  classify: "Revisar régimen",
  index: "Pendiente de indexación",
  done: "Disponible",
  review: "Requiere revisión",
  queued: "En cola",
  running: "En proceso",
  blocked: "Bloqueado",
};
