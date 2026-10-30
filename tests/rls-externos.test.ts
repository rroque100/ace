import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Guarda de docs/supabase/rls-bloquear-externos.sql. El SQL no se puede ejecutar en un test, pero sí se pueden vigilar las dos
// cosas que lo hacen peligroso: cerrar una tabla que las cuentas externas SÍ necesitan (se les rompe el Centro Jurídico o el
// simulador), o dejar abierta una que no deben ver.

const SQL = readFileSync("docs/supabase/rls-bloquear-externos.sql", "utf8");
const sinComentarios = SQL.split("\n").filter((linea) => !linea.trim().startsWith("--")).join("\n");

const tablasCerradas = new Set(
  [...(sinComentarios.split("tablas text[] := array[")[1] ?? "").split("];")[0].matchAll(/'([a-z_0-9]+)'/g)].map((m) => m[1]),
);

// Lo que las cuentas externas usan con su propio token (RLS): el corpus normativo, el chat y los exámenes. Cerrarlas rompe sus módulos.
const NECESITAN_LOS_EXTERNOS = [
  "documents", "document_chunks", "document_summaries", "norma_articulos", "norma_concordancias", "normativa_adjuntos",
  "chat_sessions", "chat_messages", "chat_sources", "chat_response_notes", "ai_feedback_examples", "profiles",
  "exam_questions", "exam_authoring_batches",
];

// Las tablas con `using (true)` que había en producción el 2026-10-30 (consulta a pg_policies). Cada una está cerrada a las
// cuentas externas aquí, o es una de las que necesitan; no puede quedar una tercera categoría por olvido.
const ABIERTAS_EN_PRODUCCION = [
  "archivo_chunks", "archivo_documentos", "boletin_eventos", "cmn_pia_2027", "document_chunks", "document_summaries", "documents",
  "eval_corridas", "eval_preguntas", "eval_resultados", "expedientes_doc_counters", "expedientes_oficinas", "necesidad_admisibilidad",
  "necesidad_documentos", "necesidad_items", "necesidad_observaciones", "necesidad_versiones", "necesidades", "norma_articulos",
  "norma_concordancias", "normativa_adjuntos", "personal", "process_cotizaciones", "process_documents", "process_evaluations",
  "process_risks", "processing_jobs", "procurement_processes", "riesgo_necesidad",
];

describe("cierre de las tablas del personal a las cuentas externas", () => {
  it("lee la lista de tablas del SQL (si cambia el formato, este test debe seguir viéndola)", () => {
    expect(tablasCerradas.size).toBeGreaterThan(20);
    expect(tablasCerradas.has("necesidades")).toBe(true);
    expect(tablasCerradas.has("procurement_processes")).toBe(true);
  });

  it("no cierra ninguna tabla que las cuentas externas necesitan", () => {
    for (const tabla of NECESITAN_LOS_EXTERNOS) expect(tablasCerradas.has(tabla), tabla).toBe(false);
    // Ni ninguna de los exámenes, que se añaden de a poco.
    for (const tabla of tablasCerradas) expect(tabla.startsWith("exam_") || tabla.startsWith("chat_"), tabla).toBe(false);
  });

  it("cubre toda tabla abierta a cualquier autenticado: cerrada aquí, o de las que las cuentas externas necesitan", () => {
    for (const tabla of ABIERTAS_EN_PRODUCCION) {
      const cerrada = tablasCerradas.has(tabla) || sinComentarios.includes(`public.${tabla}`);
      const necesaria = NECESITAN_LOS_EXTERNOS.includes(tabla);
      expect(cerrada || necesaria, `${tabla} está abierta y no está contemplada`).toBe(true);
      // Una no puede ser las dos cosas: o se cierra o se necesita.
      expect(cerrada && necesaria, `${tabla} figura cerrada y necesaria a la vez`).toBe(false);
    }
  });

  it("solo añade políticas RESTRICTIVAS: se suman a las existentes, nunca abren nada nuevo", () => {
    expect(sinComentarios).not.toMatch(/as permissive/i);
    expect(sinComentarios.match(/as restrictive/gi)?.length ?? 0).toBeGreaterThanOrEqual(3);
    // Las que crea llevan `to authenticated` (o `anon, authenticated` en la tabla pública); ninguna «to public».
    expect(sinComentarios).not.toMatch(/\bto public\b/i);
  });

  it("solo borra las políticas que él mismo crea, para poder repetirse sin llevarse las del proyecto", () => {
    const borradas = [...sinComentarios.matchAll(/drop policy if exists (\w+)/gi)].map((m) => m[1]);
    expect(borradas.length).toBeGreaterThan(0);
    for (const nombre of borradas) expect(["bloquear_externos", "solo_personal_autenticado", "personal_solo_colaboradores"], nombre).toContain(nombre);
    expect(sinComentarios).not.toMatch(/drop table|truncate|delete from/i);
  });

  it("identifica a la cuenta externa por lo mismo que el proxy: app_metadata.tipo = 'externo'", () => {
    expect(sinComentarios).toMatch(/auth\.jwt\(\) -> 'app_metadata' ->> 'tipo'/);
    expect(sinComentarios).toMatch(/= 'externo'/);
  });

  it("protege además el padrón y la tabla pública, cada uno con su política", () => {
    expect(sinComentarios).toMatch(/personal_solo_colaboradores on public\.personal as restrictive for select/);
    expect(sinComentarios).toMatch(/cmn_pia_2027 as restrictive for all to anon, authenticated/);
    expect(sinComentarios).toMatch(/auth\.uid\(\) is not null/);
  });
});
