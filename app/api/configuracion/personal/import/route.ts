import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/auth";
import {
  filaAPersonal,
  mapaCabecerasPersonal,
  personalACelda,
  personalActivo,
  type Personal,
} from "@/lib/personal";
import { getSupabaseServerConfig, supabaseRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/configuracion/personal/import
//
// Carga el padrón de personal desde el .xls del SIGA (personal.XLS). Body:
// FormData con `file` (.xls/.xlsx), opcional `mode=merge|replace` y `dryRun=true`.
//
// - merge (default): inserta/actualiza cada persona por su `codigo`.
// - replace: además, elimina del padrón a quien ya no venga en el archivo (RR.HH.
//   exportó la plantilla completa). Nadie referencia todavía `personal.id`, así
//   que el borrado no arrastra dependencias.
// - dryRun: no escribe; devuelve el conteo y una muestra para revisar antes.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    getSupabaseServerConfig();

    const formData = await request.formData();
    const file = formData.get("file");
    const mode = (formData.get("mode") as string | null) ?? "merge";
    const dryRun = (formData.get("dryRun") as string | null) === "true";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Adjunta un archivo .xls o .xlsx" }, { status: 400 });
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xls") && !name.endsWith(".xlsx")) {
      return NextResponse.json({ error: "Solo se aceptan archivos .xls o .xlsx" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo supera 10 MB" }, { status: 400 });
    }
    if (mode !== "merge" && mode !== "replace") {
      return NextResponse.json({ error: "mode debe ser 'merge' o 'replace'" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: "El archivo no tiene hojas" }, { status: 400 });
    }
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      raw: false,
      defval: "",
    });
    if (rows.length < 2) {
      return NextResponse.json({ error: "El archivo está vacío (sin filas de datos)" }, { status: 400 });
    }

    const headerRow = (rows[0] as unknown[]).map((c) => String(c ?? ""));
    const mapa = mapaCabecerasPersonal(headerRow);
    if (!mapa.has("codigo")) {
      return NextResponse.json(
        {
          error: "Falta la columna del código de empleado (acepta: empleado, codigo).",
          detectedHeaders: headerRow,
        },
        { status: 400 },
      );
    }

    // Reconciliación por `codigo`: la última fila gana si el archivo trae el
    // mismo empleado repetido (no debería, pero no rompemos el upsert).
    const porCodigo = new Map<string, Personal>();
    let vacias = 0;
    for (let i = 1; i < rows.length; i++) {
      const fila = rows[i] as unknown[];
      if (!fila || fila.every((c) => c === "" || c == null)) continue;
      const persona = filaAPersonal(fila, mapa);
      if (!persona) {
        vacias += 1;
        continue;
      }
      porCodigo.set(persona.codigo, persona);
    }

    const personas = [...porCodigo.values()];
    if (personas.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron filas válidas (sin código de empleado)." },
        { status: 400 },
      );
    }

    const activos = personas.filter(personalActivo).length;
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        total: personas.length,
        activos,
        inactivos: personas.length - activos,
        omitidas: vacias,
        mode,
        muestra: personas.slice(0, 8),
      });
    }

    // Upsert por `codigo` en lotes: una sola llamada por lote en vez de una por
    // persona (el padrón ronda las 800 filas). PostgREST resuelve el conflicto
    // fusionando (Prefer: resolution=merge-duplicates) sobre el índice único.
    const LOTE = 500;
    const filas = personas.map(personalACelda);
    for (let i = 0; i < filas.length; i += LOTE) {
      const lote = filas.slice(i, i + LOTE);
      await supabaseRest("personal?on_conflict=codigo", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(lote),
      });
    }

    // replace: retira a quien ya no está en el archivo. Se hace por lista
    // explícita de códigos conservados (nunca un DELETE sin filtro) y solo tras
    // el upsert, para no dejar el padrón vacío si algo falla a mitad.
    let eliminados = 0;
    if (mode === "replace") {
      const previos = await supabaseRest<Array<{ id: string; codigo: string }>>(
        "personal?select=id,codigo",
      ).catch(() => []);
      const enArchivo = new Set(personas.map((p) => p.codigo));
      const sobrantes = previos.filter((p) => !enArchivo.has(p.codigo)).map((p) => p.id);
      if (sobrantes.length > 0) {
        const ids = sobrantes.map((id) => encodeURIComponent(id)).join(",");
        await supabaseRest(`personal?id=in.(${ids})`, {
          method: "DELETE",
          headers: { Prefer: "return=minimal" },
        })
          .then(() => {
            eliminados = sobrantes.length;
          })
          .catch(() => {
            // Los datos ya se cargaron; el sobrante se informa como no eliminado.
          });
      }
    }

    await writeAuditLog({
      action: "personal.import",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        mode,
        fileName: file.name,
        fileSize: file.size,
        total: personas.length,
        activos,
        eliminados,
      },
      entityType: "personal",
      module: "configuracion",
    });

    return NextResponse.json({
      ok: true,
      mode,
      summary: {
        total: personas.length,
        activos,
        inactivos: personas.length - activos,
        eliminados,
        omitidas: vacias,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo importar el padrón" },
      { status: 500 },
    );
  }
}
