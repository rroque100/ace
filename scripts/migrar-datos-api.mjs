// Carga los datos del proyecto viejo (ya volcados en docs/supabase/datos/*.sql)
// en el proyecto NUEVO usando la Management API de Supabase — el mismo endpoint
// que usa el MCP por debajo, pero apuntando al ref que le indiques. Sirve cuando
// el proyecto nuevo está en OTRA cuenta y el MCP de la sesión no lo alcanza.
//
// El token se lee de una variable de entorno; NO lo escribas en este fichero.
//
//   SUPABASE_NEW_TOKEN  -> Personal Access Token de la cuenta dueña del proyecto nuevo
//                          (Dashboard -> Account -> Access Tokens). Empieza por sbp_
//   NEW_REF             -> ref del proyecto nuevo (por defecto djlhzrkjgwkjeucmulqg)
//
// Uso (PowerShell):
//   $env:SUPABASE_NEW_TOKEN = "sbp_..."
//   node scripts/migrar-datos-api.mjs
//
// Idempotente: cada INSERT lleva "on conflict do nothing", así que se puede
// reejecutar sin duplicar. Si un fichero falla, para y muestra el error.

import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const token = process.env.SUPABASE_NEW_TOKEN;
if (!token) {
  console.error("Falta SUPABASE_NEW_TOKEN (el PAT sbp_... de la cuenta nueva).");
  process.exit(1);
}
const ref = process.env.NEW_REF || "djlhzrkjgwkjeucmulqg";
const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "supabase", "datos");

// Cloudflare bloquea el User-Agent por defecto de fetch (error 1010); mandamos
// uno de navegador, como hace cualquier cliente HTTP normal.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": UA,
      Accept: "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      msg = JSON.parse(text).message || text;
    } catch {}
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return text ? JSON.parse(text) : null;
}

// 1) Red de seguridad: confirmar que apuntamos al proyecto nuevo y vacío.
console.log(`Proyecto destino: ${ref}`);
const [{ n: tablas }] = await query(
  "select count(*)::int n from information_schema.tables where table_schema='public'",
);
const [{ n: usuarios }] = await query("select count(*)::int n from auth.users");
console.log(`  tablas public: ${tablas}   ·   auth.users: ${usuarios}`);
if (tablas < 50) {
  console.error(`\nAbortado: el proyecto nuevo tiene ${tablas} tablas (<50). ¿Corriste schema-completo.sql?`);
  process.exit(1);
}
if (usuarios > 0) {
  console.log(
    `\nAviso: ya hay ${usuarios} usuarios. La carga es idempotente (on conflict do nothing), sigo.`,
  );
}

// 2) Ejecutar los ficheros de datos en orden.
const ficheros = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
console.log(`\nCargando ${ficheros.length} ficheros de ${dir}\n`);
for (const f of ficheros) {
  const sql = await readFile(join(dir, f), "utf8");
  process.stdout.write(`  ${f} … `);
  try {
    await query(sql);
    console.log("ok");
  } catch (e) {
    console.log("ERROR");
    console.error(`\n  Falló ${f}:\n  ${e.message}\n`);
    process.exit(1);
  }
}

// 3) Verificación de conteos.
console.log("\n=== Conteos en el proyecto nuevo ===");
const filas = await query(`
  select 'auth.users' t, count(*)::int c from auth.users
  union all select 'profiles', count(*)::int from profiles
  union all select 'necesidades', count(*)::int from necesidades
  union all select 'procurement_processes', count(*)::int from procurement_processes
  union all select 'documents', count(*)::int from documents
  union all select 'document_chunks', count(*)::int from document_chunks
  union all select 'personal', count(*)::int from personal
  union all select 'expedientes_archivo', count(*)::int from expedientes_archivo
  order by t
`);
for (const r of filas) console.log(`  ${r.t.padEnd(24)} ${r.c}`);
console.log("\nHecho. Revisa Authentication -> Users (13) y luego migra Storage.");
