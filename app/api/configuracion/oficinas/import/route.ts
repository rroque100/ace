import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { seedCounters } from "@/lib/oficinas";
import { getSupabaseServerConfig, supabaseRest, writeAuditLog } from "@/lib/supabase-server";
import { getYearFromRequest } from "@/lib/year-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Esquema de cada fila del Excel. Valido nombre obligatorio; el resto es opcional.
const OficinaRowSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre es obligatorio (mín. 2 caracteres)").max(200),
  entidad: z.string().trim().max(200).optional().nullable(),
  ruc: z
    .string()
    .trim()
    .max(20)
    .optional()
    .nullable()
    .or(z.literal(""))
    .refine(
      (v) => !v || /^\d{11}$/.test(v),
      "El RUC debe tener 11 dígitos numéricos",
    ),
  responsable_nombre: z.string().trim().max(200).optional().nullable(),
  responsable_cargo: z.string().trim().max(200).optional().nullable(),
  sufijo: z.string().trim().max(60).optional().nullable(),
  ancho: z.coerce.number().int().min(1).max(6).optional().default(3),
  activo: z.union([z.boolean(), z.string()]).optional().default(true),
});

type OficinaRowKey = keyof z.infer<typeof OficinaRowSchema>;
type ParsedRow = z.infer<typeof OficinaRowSchema> & { _row: number };

// Modo "simple": el archivo trae columnas tipo nombre, entidad, ruc, etc.
const SIMPLE_ALIASES: Record<OficinaRowKey, string[]> = {
  nombre: ["nombre", "oficina", "area", "area_usuario", "área", "usuario"],
  entidad: ["entidad", "institucion", "institución", "municipalidad"],
  ruc: ["ruc", "ruc_entidad"],
  responsable_nombre: ["responsable", "responsable_nombre", "firma", "firma_nombre"],
  responsable_cargo: ["cargo", "responsable_cargo", "cargo_responsable"],
  sufijo: ["sufijo", "siglas"],
  ancho: ["ancho", "ancho_numeracion", "padding"],
  activo: ["activo", "estado"],
};

// Modo "siaf": archivo del SIAF/MEF (ej. area.XLS) con su nomenclatura.
// El admin lo sube tal cual; mapeamos automáticamente a nuestro modelo.
const SIAF_ALIASES: Record<OficinaRowKey, string[]> = {
  nombre: ["nombre_depend", "dependencia", "area", "oficina"],
  entidad: ["nombre_sede", "entidad"],
  ruc: [],
  responsable_nombre: [],
  responsable_cargo: [],
  sufijo: ["abreviado_depend", "siglas", "abreviatura"],
  ancho: [],
  activo: ["estado"],
};

// Columnas SIAF adicionales (no se mapean a oficinas pero se usan para
// componer responsable_nombre / responsable_cargo en una sola pasada).
const SIAF_EXTRA_HEADERS = {
  paterno: ["paterno", "apellido_paterno"],
  materno: ["materno", "apellido_materno"],
  nombres: ["nombres", "nombre"],
  empleado: ["empleado", "dni"],
  cargo: ["cargo_depend", "cargo", "denominacion_cargo"],
  centro_costo: ["centro_costo", "ccosto"],
  tipo_depend: ["tipo_depend", "tipo"],
  sec_ejec: ["sec_ejec", "unidad_ejecutora"],
  nombre_entidad: ["nombre_entidad", "razon_social"],
  ruc_entidad: ["ruc_entidad", "ruc"],
};

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildHeaderMap(
  headerRow: string[],
  aliases: Record<OficinaRowKey, string[]>,
): Map<OficinaRowKey, number> {
  const map = new Map<OficinaRowKey, number>();
  const normalized = headerRow.map(normalizeHeader);
  (Object.keys(aliases) as OficinaRowKey[]).forEach((key) => {
    const list = aliases[key].map(normalizeHeader);
    const idx = normalized.findIndex((n) => list.includes(n));
    if (idx !== -1) map.set(key, idx);
  });
  return map;
}

function buildExtraHeaderMap(
  headerRow: string[],
  extras: Record<string, string[]>,
): Map<string, number> {
  const map = new Map<string, number>();
  const normalized = headerRow.map(normalizeHeader);
  Object.keys(extras).forEach((key) => {
    const list = extras[key].map(normalizeHeader);
    const idx = normalized.findIndex((n) => list.includes(n));
    if (idx !== -1) map.set(key, idx);
  });
  return map;
}

function asText(value: unknown, max = 200): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    // En archivos SIAF/MEF, "A" = Activo, "I" = Inactivo.
    if (v === "a") return true;
    if (v === "i") return false;
    return v === "true" || v === "1" || v === "si" || v === "sí" || v === "activo" || v === "x";
  }
  return true;
}

function asInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : fallback;
}

// POST /api/configuracion/oficinas/import
// Body: FormData con `file` (.xls/.xlsx) y opcional `mode=merge|replace` y `dryRun=true`.
// mode=merge (default): crea nuevas oficinas; las existentes por nombre se actualizan.
// mode=replace: borra todas las oficinas previas y crea las del archivo.
// dryRun=true: NO escribe; solo devuelve el preview parseado + errores.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    getSupabaseServerConfig();
    const year = getYearFromRequest(request);

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
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: "El archivo no tiene hojas" }, { status: 400 });
    }
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });

    if (rows.length < 2) {
      return NextResponse.json({ error: "El archivo está vacío (sin filas de datos)" }, { status: 400 });
    }

    const headerRow = (rows[0] as unknown[]).map((c) => String(c ?? ""));
    const normalized = headerRow.map(normalizeHeader);

    // Auto-detectamos el modo segun los headers presentes.
    // SIAF: aparece nombre_depend + (centro_costo o sec_ejec o tipo_depend)
    const isSiaf =
      normalized.includes("nombre_depend") &&
      (normalized.includes("centro_costo") ||
        normalized.includes("sec_ejec") ||
        normalized.includes("tipo_depend"));

    const headerMap = isSiaf
      ? buildHeaderMap(headerRow, SIAF_ALIASES)
      : buildHeaderMap(headerRow, SIMPLE_ALIASES);
    const extraMap = isSiaf ? buildExtraHeaderMap(headerRow, SIAF_EXTRA_HEADERS) : null;

    if (!headerMap.has("nombre")) {
      return NextResponse.json(
        {
          error:
            "Falta la columna 'nombre' (acepta: nombre, oficina, area, area_usuario, nombre_depend)",
          detectedHeaders: headerRow,
          detectedFormat: isSiaf ? "siaf" : "unknown",
        },
        { status: 400 },
      );
    }

    type RowError = { row: number; error: string };
    const errors: RowError[] = [];
    const parsed: ParsedRow[] = [];

    // En SIAF, derivamos la entidad una sola vez (de la primera fila tipo 1).
    let cachedEntidad: string | null = null;
    let cachedRuc: string | null = null;

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] as unknown[];
      if (!r || r.every((c) => c === "" || c == null)) continue;

      // En SIAF saltamos la fila tipo 1 (la entidad misma) y filas inactivas.
      let tipo: number | null = null;
      let estado: string | null = null;
      if (isSiaf && extraMap) {
        const tIdx = extraMap.get("tipo_depend");
        const eIdx = extraMap.get("estado");
        if (tIdx !== undefined) tipo = Number(r[tIdx]) || null;
        if (eIdx !== undefined) estado = String(r[eIdx] ?? "").trim().toUpperCase();
        if (estado && estado !== "A") continue;
        if (tipo === 1) {
          // Fila entidad: capturo nombre y ruc y sigo.
          // En el archivo SIAF, nombre_depend de la fila tipo 1 ES la entidad
          // (ej. "MUNICIPALIDAD DISTRITAL DE CHALLHUAHUACHO").
          const nombreEntidadIdx = extraMap.get("nombre_entidad");
          const rucEntidadIdx = extraMap.get("ruc_entidad");
          if (nombreEntidadIdx !== undefined && !cachedEntidad) {
            cachedEntidad = asText(r[nombreEntidadIdx], 200);
          } else if (!cachedEntidad) {
            // Fallback: nombre_depend de la fila tipo 1
            const nIdx = headerMap.get("nombre");
            if (nIdx !== undefined) cachedEntidad = asText(r[nIdx], 200);
          }
          if (rucEntidadIdx !== undefined && !cachedRuc) {
            cachedRuc = asText(r[rucEntidadIdx], 20);
          }
          continue;
        }
      }

      const raw: Record<string, unknown> = {};
      headerMap.forEach((colIdx, key) => {
        raw[String(key)] = r[colIdx];
      });

      // En SIAF, componemos responsable_nombre y responsable_cargo desde
      // las columnas sueltas (paterno + materno + nombres) y (cargo_depend).
      if (isSiaf && extraMap) {
        const pIdx = extraMap.get("paterno");
        const mIdx = extraMap.get("materno");
        const nIdx = extraMap.get("nombres");
        const cIdx = extraMap.get("cargo");
        const paterno = pIdx !== undefined ? asText(r[pIdx], 100) : null;
        const materno = mIdx !== undefined ? asText(r[mIdx], 100) : null;
        const nombres = nIdx !== undefined ? asText(r[nIdx], 100) : null;
        const composedName = [paterno, materno, nombres].filter(Boolean).join(" ").trim() || null;
        if (composedName) raw.responsable_nombre = composedName;
        if (cIdx !== undefined) {
          const cargo = asText(r[cIdx], 200);
          if (cargo) raw.responsable_cargo = cargo;
        }
        // Sufijo por defecto: si no hay abreviado_depend, usamos centro_costo.
        if (!raw.sufijo) {
          const ccIdx = extraMap.get("centro_costo");
          if (ccIdx !== undefined) {
            const cc = asText(r[ccIdx], 60);
            if (cc) raw.sufijo = cc;
          }
        }
        // Entidad: de la fila entidad cacheada o de la columna nombre_sede.
        if (!raw.entidad && cachedEntidad) raw.entidad = cachedEntidad;
        if (!raw.ruc && cachedRuc) raw.ruc = cachedRuc;
        // ruc vacio en siaf no es error
        if (raw.ruc === "" || raw.ruc === undefined) delete raw.ruc;
      }

      const result = OficinaRowSchema.safeParse(raw);
      if (!result.success) {
        const msg = result.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; ");
        errors.push({ row: i + 1, error: msg });
        continue;
      }
      parsed.push({ ...result.data, _row: i + 1 });
    }

    if (parsed.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron filas válidas para importar", errors, preview: [] },
        { status: 400 },
      );
    }

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        preview: parsed,
        errors,
        total: parsed.length,
        mode,
        detectedFormat: isSiaf ? "siaf" : "simple",
        cachedEntidad,
        cachedRuc,
      });
    }

    // `replace` NO borra antes de importar.
    //
    // Antes se hacía `DELETE expedientes_oficinas` sin filtro y DESPUÉS se
    // insertaba: si el archivo fallaba a mitad, el rollback solo deshacía las
    // creaciones —lo borrado no se recuperaba— y la entidad se quedaba sin
    // ninguna oficina (y sin sus correlativos, que cuelgan de ellas).
    //
    // Ahora el reemplazo es: importar todo primero (creando o actualizando por
    // nombre) y, SOLO si todo fue bien, borrar las que no venían en el archivo.
    // Un fallo a mitad deja el registro intacto, y las oficinas que siguen
    // existiendo conservan su numeración en vez de perderla y recrearse.
    type OfficeRow = { id: string; nombre: string };
    const existing = await supabaseRest<OfficeRow[]>(
      `expedientes_oficinas?select=id,nombre`,
    ).catch(() => []);
    const nameToId = new Map(existing.map((o) => [o.nombre.trim().toLowerCase(), o.id]));

    const created: string[] = [];
    const updated: string[] = [];
    const failed: RowError[] = [...errors];
    let rolledBack = false;

    // Rollback: elimina las oficinas creadas si falla la importación.
    async function rollbackCreated() {
      if (created.length === 0) return;
      const ids = created.map((id) => encodeURIComponent(id)).join(",");
      await supabaseRest(`expedientes_oficinas?id=in.(${ids})`, {
        method: "DELETE",
      }).catch(() => undefined);
      rolledBack = true;
    }

    // Antes era fila a fila con un `await` por iteración (~57 PATCH/POST + un
    // seedCounters por creada, todo en SERIE → varios segundos de pared). Ahora se
    // procesa en TANDAS PARALELAS. Se conserva la semántica de reemplazo: si
    // CUALQUIER fila falla, se revierten las creaciones y NO se purga nada; solo un
    // import completo purga los sobrantes al final. `Promise.allSettled` deja que
    // el resto del lote termine para recoger todos los errores, no solo el primero.
    const CHUNK = 15;
    let huboFallo = false;
    for (let i = 0; i < parsed.length && !huboFallo; i += CHUNK) {
      const lote = parsed.slice(i, i + CHUNK);
      const resultados = await Promise.allSettled(
        lote.map(async (row) => {
          const id = nameToId.get(row.nombre.trim().toLowerCase());
          const payload = {
            nombre: row.nombre,
            entidad: asText(row.entidad),
            ruc: asText(row.ruc, 20),
            responsable_nombre: asText(row.responsable_nombre),
            responsable_cargo: asText(row.responsable_cargo),
            sufijo: asText(row.sufijo, 60),
            ancho: asInt(row.ancho, 1, 6, 3),
            activo: asBool(row.activo),
            updated_at: new Date().toISOString(),
          };
          if (id) {
            await supabaseRest(`expedientes_oficinas?id=eq.${id}`, {
              body: JSON.stringify(payload),
              method: "PATCH",
            });
            return { tipo: "updated" as const, id };
          }
          const [inserted] = await supabaseRest<Array<{ id: string }>>(
            "expedientes_oficinas?select=id",
            { body: JSON.stringify({ ...payload, created_by: auth.user.id }), method: "POST" },
          );
          if (!inserted?.id) return { tipo: "noop" as const };
          // seedCounters va DENTRO de la tarea: al paralelizar las filas, los
          // sembrados de contadores de las creadas también corren en paralelo.
          await seedCounters(inserted.id, year);
          return { tipo: "created" as const, id: inserted.id };
        }),
      );
      for (let j = 0; j < resultados.length; j++) {
        const r = resultados[j];
        if (r.status === "fulfilled") {
          if (r.value.tipo === "created") created.push(r.value.id);
          else if (r.value.tipo === "updated") updated.push(r.value.id);
        } else {
          huboFallo = true;
          const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
          failed.push({ row: lote[j]._row, error: msg });
        }
      }
    }

    if (huboFallo) {
      // Cualquier fallo revierte las creaciones y aborta SIN purgar (las oficinas
      // existentes no se tocan). `rolledBack` refleja si de hecho se borró algo.
      await rollbackCreated().catch(() => undefined);
      const sampleErrors = failed.slice(0, 3).map((e) => `Fila ${e.row}: ${e.error}`).join(" | ");
      return NextResponse.json({ error: `Importación interrumpida y revertida. No se eliminó ninguna oficina existente. ${failed.length} error(es). Ej: ${sampleErrors}`, failed, rolledBack }, { status: 500 });
    }

    // Reemplazo: ahora que la importación terminó bien, se retiran las oficinas
    // que no venían en el archivo. Se hace por lista explícita de ids (nunca un
    // DELETE sin filtro) y no bloquea la respuesta si falla.
    let eliminadas = 0;
    if (mode === "replace") {
      const conservadas = new Set([...created, ...updated]);
      const sobrantes = existing.filter((o) => !conservadas.has(o.id)).map((o) => o.id);
      if (sobrantes.length > 0) {
        const ids = sobrantes.map((id) => encodeURIComponent(id)).join(",");
        await supabaseRest(`expedientes_oficinas?id=in.(${ids})`, {
          method: "DELETE",
          headers: { Prefer: "return=minimal" },
        })
          .then(() => {
            eliminadas = sobrantes.length;
          })
          .catch(() => {
            // Se informa como no eliminadas; los datos importados ya están.
          });
      }
    }

    await writeAuditLog({
      action: "oficinas.import",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        mode,
        fileName: file.name,
        fileSize: file.size,
        created: created.length,
        updated: updated.length,
        failed: failed.length,
        eliminadas,
      },
      entityType: "oficina",
      module: "configuracion",
    });

    return NextResponse.json({
      ok: true,
      mode,
      summary: {
        totalRows: parsed.length,
        created: created.length,
        updated: updated.length,
        eliminadas,
        failed: failed.length,
        errors: failed,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo importar el archivo" },
      { status: 500 },
    );
  }
}
