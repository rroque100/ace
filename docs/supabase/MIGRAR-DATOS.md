# Migrar TODOS los datos del proyecto viejo al nuevo (pg_dump)

Copia **datos + usuarios Auth + Storage** de `uxpitcawohjnpkzeexiz` (viejo) a
`djlhzrkjgwkjeucmulqg` (nuevo), conservando los **UUIDs** (así las FKs y los
vectores de Pinecone siguen apuntando bien).

> Enfoque **modular**: el ESQUEMA lo crea `schema-completo.sql` (que ya
> controlamos); con `pg_dump` traemos **solo los datos**. Evita los líos de
> volcar los esquemas gestionados `auth`/`storage`.

---

## 0. Requisitos

- **Cliente de Postgres 15+** (`pg_dump` y `psql`). En Windows: instala
  "PostgreSQL" (o solo las *Command Line Tools*) desde postgresql.org, o
  `winget install PostgreSQL.PostgreSQL`. Comprueba: `pg_dump --version`.
- **Node** (ya lo tienes) para el paso de Storage.
- Las **cadenas de conexión** de cada proyecto:
  Panel → **Settings → Database** → *Connection string* → pestaña **Session pooler**
  (la de IPv4, `...pooler.supabase.com:5432`). Tienen la forma:
  ```
  postgresql://postgres.<REF>:<DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres
  ```
  Si no recuerdas la `DB_PASSWORD`, resetéala en esa misma pantalla.

Define las dos (PowerShell):
```powershell
$env:OLD = "postgresql://postgres.uxpitcawohjnpkzeexiz:<PASS_VIEJO>@aws-0-<region>.pooler.supabase.com:5432/postgres"
$env:NEW = "postgresql://postgres.djlhzrkjgwkjeucmulqg:<PASS_NUEVO>@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

---

## 1. Esquema en el proyecto nuevo (una vez)

Si aún no lo hiciste: pega **`docs/supabase/schema-completo.sql`** entero en el
**SQL Editor** del proyecto nuevo y ejecútalo. Crea tablas, funciones, triggers,
RLS, índices y el bucket `documents`.

## 2. Volcar SOLO los datos del viejo

```powershell
# Datos de las tablas de la app (esquema public)
pg_dump "$env:OLD" --data-only --no-owner --no-privileges --schema=public --file=public-data.sql

# Usuarios de Auth (solo estas dos tablas)
pg_dump "$env:OLD" --data-only --no-owner --no-privileges -t auth.users -t auth.identities --file=auth-data.sql
```

## 3. Restaurar en el nuevo

El orden importa (los datos de `public` referencian `auth.users`) y hay que
**desactivar triggers/FKs durante la carga** (`session_replication_role = replica`),
si no el trigger `handle_new_user` duplicaría filas de `profiles` y las FKs se
quejarían del orden:

```powershell
psql "$env:NEW" --single-transaction -v ON_ERROR_STOP=1 `
  -c "set session_replication_role = replica;" `
  -f auth-data.sql `
  -f public-data.sql `
  -c "set session_replication_role = default;"
```

Si algo falla, `--single-transaction` deja la BD **sin tocar** (todo o nada);
lees el error y reintentas.

## 4. Storage (los ~95 MB de PDFs) — script Node

`pg_dump` NO copia los ficheros del bucket (son binarios en el almacenamiento).
Usa el script `scripts/migrar-storage.mjs` (lee las claves de variables de
entorno; NO las pongas en el fichero):

```powershell
$env:OLD_SUPABASE_URL = "https://uxpitcawohjnpkzeexiz.supabase.co"
$env:OLD_SERVICE_ROLE = "<service_role del VIEJO>"
$env:NEW_SUPABASE_URL = "https://djlhzrkjgwkjeucmulqg.supabase.co"
$env:NEW_SERVICE_ROLE = "<service_role del NUEVO>"
$env:SUPABASE_STORAGE_BUCKET = "documents"

node scripts/migrar-storage.mjs
```
Descarga cada objeto del bucket viejo y lo sube al nuevo con la **misma ruta**
(así los `storage_path` de las filas siguen siendo válidos).

## 5. Pinecone

Como conservamos los **UUIDs**, los vectores de Pinecone (que referencian esos
IDs) **siguen válidos**: NO hace falta re-indexar, siempre que sigas usando el
**mismo índice y los mismos namespaces** (`PINECONE_*` sin cambios). Si cambias
de índice/namespace, entonces sí habría que re-indexar.

## 6. Verificación

```sql
-- en el SQL Editor del NUEVO, comprueba conteos frente al viejo
select 'necesidades' t, count(*) from necesidades
union all select 'procurement_processes', count(*) from procurement_processes
union all select 'documents', count(*) from documents
union all select 'document_chunks', count(*) from document_chunks
union all select 'personal', count(*) from personal
union all select 'expedientes_archivo', count(*) from expedientes_archivo
union all select 'profiles', count(*) from profiles;
```
Y en el panel: **Authentication → Users** (deben salir los 13) y **Storage →
documents** (deben estar los PDFs).

---

## Resumen

| Pieza | Herramienta |
|---|---|
| Esquema | `schema-completo.sql` (SQL Editor) |
| Datos `public` + Auth | `pg_dump --data-only` → `psql` (con `session_replication_role=replica`) |
| Storage (PDFs) | `scripts/migrar-storage.mjs` |
| Pinecone | nada (UUIDs preservados) |
