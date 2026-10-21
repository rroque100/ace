// Copia todos los objetos del bucket de Storage del proyecto viejo al nuevo,
// conservando la MISMA ruta (para que los storage_path de las filas migradas
// sigan siendo válidos). Las claves se leen de variables de entorno; NO las
// escribas en este fichero.
//
//   OLD_SUPABASE_URL / OLD_SERVICE_ROLE   -> proyecto viejo
//   NEW_SUPABASE_URL / NEW_SERVICE_ROLE   -> proyecto nuevo
//   SUPABASE_STORAGE_BUCKET               -> nombre del bucket (por defecto 'documents')
//
// Uso:  node scripts/migrar-storage.mjs
//
// Se apoya en @supabase/supabase-js (ya es dependencia de la app) y usa la
// service_role de cada proyecto (salta RLS), como hace el servidor.

import { createClient } from "@supabase/supabase-js";

const need = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error(`Falta la variable de entorno ${k}`);
    process.exit(1);
  }
  return v;
};

const OLD = createClient(need("OLD_SUPABASE_URL"), need("OLD_SERVICE_ROLE"), {
  auth: { persistSession: false },
});
const NEW = createClient(need("NEW_SUPABASE_URL"), need("NEW_SERVICE_ROLE"), {
  auth: { persistSession: false },
});
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "documents";

// Lista recursiva: la API de Storage pagina y devuelve las carpetas con id=null.
async function listarTodo(client, prefix = "") {
  const rutas = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await client.storage
      .from(BUCKET)
      .list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list ${prefix || "/"}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const item of data) {
      const ruta = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        rutas.push(...(await listarTodo(client, ruta))); // carpeta
      } else {
        rutas.push(ruta);
      }
    }
    if (data.length < 100) break;
    offset += data.length;
  }
  return rutas;
}

const rutas = await listarTodo(OLD);
console.log(`Bucket "${BUCKET}": ${rutas.length} objetos a copiar.`);

let ok = 0;
let fallidos = 0;
for (const ruta of rutas) {
  const bajada = await OLD.storage.from(BUCKET).download(ruta);
  if (bajada.error) {
    console.error(`  ✗ descarga ${ruta}: ${bajada.error.message}`);
    fallidos++;
    continue;
  }
  const buf = Buffer.from(await bajada.data.arrayBuffer());
  const subida = await NEW.storage.from(BUCKET).upload(ruta, buf, {
    upsert: true,
    contentType: bajada.data.type || "application/pdf",
  });
  if (subida.error) {
    console.error(`  ✗ subida ${ruta}: ${subida.error.message}`);
    fallidos++;
    continue;
  }
  ok++;
  if (ok % 10 === 0 || ok === rutas.length) console.log(`  ${ok}/${rutas.length}`);
}

console.log(`\nHecho. Copiados: ${ok} · Fallidos: ${fallidos}`);
process.exit(fallidos > 0 ? 1 : 0);
