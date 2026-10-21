// Prueba transaccional local. argv[2]: ruta al módulo @electric-sql/pglite instalado temporalmente.
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table expedientes_archivo (
      id uuid primary key, expediente_id uuid, updated_at timestamptz not null,
      anio int, asunto text, body_text text, folio text, materia text, tipo_documento text,
      oficina text, metadata jsonb, serie_documento text, resumen text, file_name text,
      file_size bigint, mime_type text, storage_bucket text, storage_path text, status text, error_message text
    );
    create table expedientes_archivo_chunks (
      id uuid primary key, documento_id uuid references expedientes_archivo(id), expediente_id uuid,
      chunk_index int, content text not null, page_start int, page_end int, pinecone_vector_id text,
      metadata jsonb, unique(documento_id, chunk_index)
    );
    insert into expedientes_archivo(id,updated_at,status,body_text) values
      ('00000000-0000-4000-8000-000000000001','2026-09-18T00:00:00Z','indexed','anterior');
    insert into expedientes_archivo_chunks(id,documento_id,chunk_index,content,pinecone_vector_id) values
      ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001',0,'anterior','old');
  `);
  await db.exec(await readFile(new URL("../docs/supabase/archivo-publicar-indice.sql", import.meta.url), "utf8"));
  const id = "00000000-0000-4000-8000-000000000001";
  const base = "2026-09-18T00:00:00Z";
  const chunk = { id: "00000000-0000-4000-8000-000000000003", chunk_index: 0, content: "nuevo", pinecone_vector_id: "new", metadata: {} };
  const publish = (chunks, stamp = base) => db.query("select archivo_publicar_indice($1,$2,$3,$4) as result", [id, stamp, JSON.stringify(chunks), JSON.stringify({ body_text: "nuevo", status: "indexed" })]);
  await assert.rejects(() => publish([{ ...chunk, content: null }]));
  assert.equal((await db.query("select content from expedientes_archivo_chunks")).rows[0].content, "anterior");
  assert.equal((await db.query("select body_text from expedientes_archivo")).rows[0].body_text, "anterior");
  await assert.rejects(() => publish([chunk], "2026-09-17T00:00:00Z"));
  assert.equal((await db.query("select content from expedientes_archivo_chunks")).rows[0].content, "anterior");
  const result = await publish([chunk]);
  assert.deepEqual(result.rows[0].result.oldVectorIds, ["old"]);
  assert.equal((await db.query("select content from expedientes_archivo_chunks")).rows[0].content, "nuevo");
  await assert.rejects(() => publish([chunk])); // segundo escritor con base antigua
  const permissions = await db.query("select has_function_privilege('authenticated', 'archivo_publicar_indice(uuid,timestamptz,jsonb,jsonb)', 'execute') as allowed");
  assert.equal(permissions.rows[0].allowed, false);
  console.log("SQL verificado: rollback, publicación atómica, conflicto de versión y permisos.");
} finally { await db.close(); }
