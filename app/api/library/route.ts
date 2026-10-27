import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-server";
import { libraryFiltersSchema } from "@/lib/library-workspace";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = libraryFiltersSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Revisa los filtros." },
      { status: 400 },
    );
  try {
    if (
      parsed.data.publishedFrom &&
      parsed.data.publishedTo &&
      parsed.data.publishedFrom > parsed.data.publishedTo
    )
      return NextResponse.json(
        { error: "La fecha final debe ser posterior a la inicial." },
        { status: 400 },
      );
    const result = await supabaseRest("rpc/ace_library_catalogue_v1", {
      method: "POST",
      body: JSON.stringify({
        p_filters: parsed.data,
        p_page: parsed.data.page,
      }),
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "No se pudo consultar la biblioteca. Esto no significa que no existan documentos.",
      },
      { status: 503 },
    );
  }
}
