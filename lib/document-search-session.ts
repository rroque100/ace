import { z } from "zod";
import { documentSearchRequestSchema, type DocumentSearchInput } from "./document-search";
export const searchSessionSchema = z.object({
  version: z.literal(1), savedAt: z.number(), input: documentSearchRequestSchema,
  selected: z.array(z.object({ documentId: z.string().uuid(), title: z.string().max(1000) })).max(8).default([]),
  scroll: z.number().min(0).max(10000000).default(0),
});
export function searchSessionKey(owner: string, context = "") { return `ace:document-search:v1:${owner}:${encodeURIComponent(context)}`; }
export function readSearchSession(raw: string | null, now = Date.now()) {
  try {
    const state = searchSessionSchema.parse(JSON.parse(raw ?? "null"));
    return now >= state.savedAt && now - state.savedAt < 4 * 60 * 60 * 1000 ? state : null;
  } catch { return null; }
}
export function sameSearchInput(left: DocumentSearchInput, right: DocumentSearchInput) {
  const a=documentSearchRequestSchema.safeParse({...left,page:1});
  const b=documentSearchRequestSchema.safeParse({...right,page:1});
  return a.success && b.success && JSON.stringify(a.data)===JSON.stringify(b.data);
}
