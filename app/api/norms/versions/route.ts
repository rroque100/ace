import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { loadSearchCatalogue } from "@/lib/document-search-server";
import { normativeVersions } from "@/lib/normative-library";
export const dynamic="force-dynamic";
export async function GET() {
  const auth=await requireUser(); if("error" in auth) return auth.error;
  try { return NextResponse.json({versions:normativeVersions(await loadSearchCatalogue())},{headers:{"Cache-Control":"no-store"}}); }
  catch { return NextResponse.json({error:"No se pudieron comprobar las versiones relacionadas. Reintenta."},{status:503}); }
}
